"""Import pipeline shared by the browser wizard (`router.py`, JSON chunks) and the Sobrus robot
(`app/sobrus/sync.py`): one batch per file, its rows resolved to products, lines already stored by
ANOTHER import skipped, the batch's end written in the history. Moved as-is from router.py."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable

from sqlalchemy import or_, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.notifications.service import sync_unclassified
from app.core.audit import AuditAction, log_action
from app.core.models import Achat, ImportBatch, Medicament, PharmacyStock, User, Vente
from app.ingestion.csv_parse import (
    col,
    existing_by_name,
    normalize_date,
    normalize_datetime,
    normalized_name,
    parse_date,
    parse_float,
    parse_int,
)


# A batch's end → its line in the history.
IMPORT_ENDS = {
    "success": AuditAction.IMPORT_DONE,
    "cancelled": AuditAction.IMPORT_CANCELLED,
    "error": AuditAction.IMPORT_FAILED,
}


def get_or_create_batch(
    db: Session, *, pharmacy_id: int, file_type: str, filename: str | None, batch_id: int | None, user_id: int | None
) -> ImportBatch:
    """Returns the existing batch if `batch_id` is given AND it belongs to this pharmacy.
    Otherwise creates a fresh `in_progress` batch and returns it. New batches start at
    rows_inserted=0 / rows_skipped=0; chunked uploads accumulate on later calls.

    `user_id` is recorded on NEW batches only — subsequent chunks that reuse an
    existing batch preserve the original creator."""
    if batch_id is not None:
        batch = db.get(ImportBatch, batch_id)
        if batch and batch.pharmacy_id == pharmacy_id and batch.file_type == file_type:
            return batch
        # silently fall through to create — caller passed a stale/foreign id
    batch = ImportBatch(
        pharmacy_id=pharmacy_id,
        file_type=file_type,
        filename=filename,
        rows_inserted=0,
        rows_skipped=0,
        status="in_progress",
        created_by_user_id=user_id,
    )
    db.add(batch)
    db.flush()
    return batch


# ─── Sobrus CSV column name constants (catch typos at import time) ───────────

COL_PID = "PID"
COL_PRODUCT = "Produit"
COL_CATEGORY = "Catégorie"
COL_TVA = "TVA"
COL_PPH = "PPH"
COL_PPV = "PPV"
COL_ZONE = "Zone"
COL_QUANTITY = "Quantité"
COL_TOTAL = "Total"
COL_UNIT_PRICE = "Prix unitaire"
# Achat-only
COL_DELIVERY_REF = "Référence de livraison"
COL_DELIVERY_DATE = "Date Bon de Livraison"
COL_CREATED = "Créée le"
COL_SUPPLIER = "Fournisseur"
COL_EXPIRY = "Date de péremption"
COL_STOCK_MIN = "Stock min"
COL_STOCK_MAX = "Stock max"
# Stock-only
COL_BARCODE1 = "Code barre 1"
COL_BARCODE2 = "Code barre 2"
# Vente-only
COL_TXN_REF = "Numéro de transaction"
COL_DATE = "Date"
COL_CLIENT = "Client"
COL_DISCOUNT = "Remise"


# ─── Per-type config + one generic insert pipeline (replaces _insert_achats + _insert_ventes) ─


@dataclass(frozen=True)
class TransactionConfig:
    """Captures the 6 things that differ between an Achat ingest and a Vente ingest.
    Everything else (medicament resolve, dedup, batch accounting, commit) is in
    `insert_transactions` and runs against either config unchanged."""

    file_type: str  # "achat" | "vente"
    model: type  # Achat | Vente (SQLAlchemy class)
    dedup_column: str  # CSV column to dedup on
    dedup_attr: str  # corresponding model attribute name
    date_column: str  # CSV column of the line's date: unreadable → line skipped
    build_row_dict: Callable[
        [dict[str, Any], int, int, int], dict[str, Any]
    ]  # (row, pharmacy_id, med_id, batch_id) → dict for bulk_insert


ACHAT_CFG = TransactionConfig(
    file_type="achat",
    model=Achat,
    dedup_column=COL_DELIVERY_REF,
    dedup_attr="delivery_ref",
    date_column=COL_DELIVERY_DATE,
    build_row_dict=lambda row, pharm_id, med_id, batch_id: {
        "pharmacy_id": pharm_id,
        "medicament_id": med_id,
        "import_batch_id": batch_id,
        "created_at_source": normalize_datetime(col(row, COL_CREATED)),
        "delivery_date": normalize_date(col(row, COL_DELIVERY_DATE)),
        "delivery_ref": col(row, COL_DELIVERY_REF),
        "supplier": col(row, COL_SUPPLIER),
        "quantity": parse_float(col(row, COL_QUANTITY)),
        "unit_price": parse_float(col(row, COL_UNIT_PRICE)),
        "expiry_date": normalize_date(col(row, COL_EXPIRY)),
        "stock_min": parse_float(col(row, COL_STOCK_MIN)),
        "stock_max": parse_float(col(row, COL_STOCK_MAX)),
        "total": parse_float(col(row, COL_TOTAL)),
    },
)

VENTE_CFG = TransactionConfig(
    file_type="vente",
    model=Vente,
    dedup_column=COL_TXN_REF,
    dedup_attr="transaction_ref",
    date_column=COL_DATE,
    build_row_dict=lambda row, pharm_id, med_id, batch_id: {
        "pharmacy_id": pharm_id,
        "medicament_id": med_id,
        "import_batch_id": batch_id,
        "date": normalize_date(col(row, COL_DATE)),
        "transaction_ref": col(row, COL_TXN_REF),
        "client": col(row, COL_CLIENT),
        "quantity": parse_float(col(row, COL_QUANTITY)),
        "discount": parse_float(col(row, COL_DISCOUNT)),
        "unit_price": parse_float(col(row, COL_UNIT_PRICE)),
        "total": parse_float(col(row, COL_TOTAL)),
    },
)


def batch_resolve_medicaments(
    db: Session,
    rows: list[dict[str, Any]],
) -> tuple[dict[str, int], list[Medicament]]:
    """Resolve every unique PID in `rows` to a Medicament.id using ONE SELECT + ONE
    INSERT batch (+ one SELECT for the name merge below).

    Returns (`{pid → med_id}`, `[newly-created Medicaments]`). The list is used by
    the response so the frontend can surface "N new products" to the owner (F19)."""
    # Collect unique PIDs; keep the first row we see for a given PID as the source
    # of catalog field updates (tva/pph/ppv/zone).
    first_row_by_pid: dict[str, dict[str, Any]] = {}
    for r in rows:
        pid = col(r, COL_PID)
        if pid and pid not in first_row_by_pid:
            first_row_by_pid[pid] = r
    if not first_row_by_pid:
        return {}, []

    pids = list(first_row_by_pid.keys())
    existing: dict[str, Medicament] = {m.pid: m for m in db.query(Medicament).filter(Medicament.pid.in_(pids)).all()}

    def _update_fields(med: Medicament, r: dict[str, Any]) -> None:
        # Fill missing TVA / zone / barcodes (stock file: « Code barre 1 / 2 », they find
        # the product's photos), refresh prices. Category and a barcode already there
        # intentionally NOT overwritten — admin-curated.
        tva = col(r, COL_TVA)
        pph = parse_float(col(r, COL_PPH))
        ppv = parse_float(col(r, COL_PPV))
        zone = col(r, COL_ZONE)
        if tva and not med.tva:
            med.tva = tva
        if pph is not None:
            med.pph = pph
        if ppv is not None:
            med.ppv = ppv
        if zone and not med.zone:
            med.zone = zone
        for attr, column in (("barcode1", COL_BARCODE1), ("barcode2", COL_BARCODE2)):
            code = (col(r, column) or "").strip()
            if code and not getattr(med, attr):
                setattr(med, attr, code)

    # Name-dedup: a row whose PID is new but whose product NAME already exists
    # (under a different PID — e.g. a catalog row that carries the laboratoire)
    # MERGES onto that row instead of forking a duplicate. One batched query keeps
    # this at 1 SELECT (the N+1 name lookup was why it was dropped originally).
    unmatched = {pid: r for pid, r in first_row_by_pid.items() if pid not in existing}
    by_name = existing_by_name(db, (col(r, COL_PRODUCT) for r in unmatched.values()))

    med_for_pid: dict[str, Medicament] = {}
    new_rows: dict[str, dict[str, Any]] = {}  # pid → values of a product to create
    same_name: dict[str, str] = {}  # pid → pid of a product created in this batch with the same name
    new_by_name: dict[str, str] = {}  # normalized name → pid created in this batch
    for pid, r in first_row_by_pid.items():
        med = existing.get(pid)
        nkey = normalized_name(col(r, COL_PRODUCT))
        if med is None:
            med = by_name.get(nkey)
            if med is None and nkey in new_by_name:
                same_name[pid] = new_by_name[nkey]
                continue
        if med is not None:
            _update_fields(med, r)
            med_for_pid[pid] = med
            continue
        # F19: leave product_type=NULL — catalog is the source of truth; admin classifies.
        new_rows[pid] = {
            "pid": pid,
            "product": col(r, COL_PRODUCT) or pid,
            "tva": col(r, COL_TVA),
            "pph": parse_float(col(r, COL_PPH)),
            "ppv": parse_float(col(r, COL_PPV)),
            "category": col(r, COL_CATEGORY),
            "zone": col(r, COL_ZONE),
            "barcode1": (col(r, COL_BARCODE1) or "").strip() or None,
            "barcode2": (col(r, COL_BARCODE2) or "").strip() or None,
        }
        if nkey:
            new_by_name[nkey] = pid

    new_meds: list[Medicament] = []
    if new_rows:
        # Two imports (2 tabs, 2 pharmacies) can create the same new PID at the same moment:
        # ON CONFLICT keeps whichever came first, the other just reads it back (no 500).
        created = set(
            db.execute(
                pg_insert(Medicament)
                .values(list(new_rows.values()))
                .on_conflict_do_nothing(index_elements=["pid"])
                .returning(Medicament.pid)
            ).scalars()
        )
        for med in db.query(Medicament).filter(Medicament.pid.in_(list(new_rows))).all():
            med_for_pid[med.pid] = med
        new_meds = [med_for_pid[pid] for pid in new_rows if pid in created]
    for pid, first_pid in same_name.items():
        med_for_pid[pid] = med_for_pid[first_pid]

    resolved: dict[str, int] = {pid: med.id for pid, med in med_for_pid.items()}
    return resolved, new_meds


def preload_existing_keys(
    db: Session, cfg: TransactionConfig, pharmacy_id: int, refs: set[str], batch_id: int
) -> set[tuple[str, int]]:
    """(BL or ticket, med_id) pairs stored by the pharmacy's OTHER imports: the same
    file imported again adds nothing. Lines of this import are never skipped: the
    same BL + product twice in one file = 2 real purchases (G1)."""
    if not refs:
        return set()
    dedup_col = getattr(cfg.model, cfg.dedup_attr)
    other_import = or_(cfg.model.import_batch_id.is_(None), cfg.model.import_batch_id != batch_id)
    rows = (
        db.query(dedup_col, cfg.model.medicament_id)
        .filter(cfg.model.pharmacy_id == pharmacy_id, other_import, dedup_col.in_(refs))
        .all()
    )
    return {(ref, med_id) for ref, med_id in rows if ref and med_id}


def insert_transactions(
    db: Session,
    rows: list[dict[str, Any]],
    *,
    pharmacy_id: int,
    filename: str | None,
    batch_id: int | None,
    user_id: int | None,
    cfg: TransactionConfig,
) -> dict:
    """Generic ingest for Achat or Vente rows. Differences captured by `cfg`.

    Fast path: batch-resolve all PIDs in one SELECT + insert all transaction rows
    in one executemany. What was N+1 SELECT/flush per chunk is now 2 queries total
    (medicament resolve + dedup preload) plus 1 bulk INSERT."""
    batch = get_or_create_batch(
        db,
        pharmacy_id=pharmacy_id,
        file_type=cfg.file_type,
        filename=filename,
        batch_id=batch_id,
        user_id=user_id,
    )
    med_id_by_pid, new_medicaments = batch_resolve_medicaments(db, rows)
    refs = {r.get(cfg.dedup_column) for r in rows if r.get(cfg.dedup_column)}
    existing = preload_existing_keys(db, cfg, pharmacy_id, refs, batch.id)

    to_insert: list[dict[str, Any]] = []
    skipped_no_pid = 0
    skipped_no_med = 0
    skipped_dup = 0
    skipped_bad_date = 0
    for row in rows:
        pid = col(row, COL_PID)
        if not pid:
            skipped_no_pid += 1
            continue
        med_id = med_id_by_pid.get(pid)
        if not med_id:
            skipped_no_med += 1
            continue
        day = col(row, cfg.date_column)
        if (day or "").strip() and not normalize_date(day):  # « 31/02/2026 », « hier »: no date to file it under
            skipped_bad_date += 1
            continue
        ref = col(row, cfg.dedup_column)
        if ref and (ref, med_id) in existing:
            skipped_dup += 1
            continue
        to_insert.append(cfg.build_row_dict(row, pharmacy_id, med_id, batch.id))

    if to_insert:
        # render_nulls: one INSERT shape for every row. Without it, rows with
        # different empty columns got their own statement (107 INSERTs per 500 rows).
        db.bulk_insert_mappings(cfg.model, to_insert, render_nulls=True)

    inserted = len(to_insert)
    skipped = skipped_no_pid + skipped_no_med + skipped_dup + skipped_bad_date
    batch.rows_inserted += inserted
    batch.rows_skipped += skipped
    # Stays `in_progress`: only the browser's final PATCH « success » (after the last
    # chunk) closes the batch, so a half import never looks finished.
    batch.last_chunk_at = datetime.now(timezone.utc)
    db.commit()
    return {
        "inserted": inserted,
        "skipped": skipped,
        "skipped_no_pid": skipped_no_pid,
        "skipped_no_medicament": skipped_no_med,
        "skipped_duplicate": skipped_dup,
        "skipped_bad_date": skipped_bad_date,
        "batch_id": batch.id,
        "new_medicaments": {
            "count": len(new_medicaments),
            "sample": [m.product or m.pid for m in new_medicaments[:10]],
        },
    }


def insert_stock(
    db: Session,
    rows: list[dict[str, Any]],
    *,
    pharmacy_id: int,
    filename: str | None,
    batch_id: int | None,
    user_id: int | None,
) -> dict:
    """Chunked stock import. Postgres ON CONFLICT upsert by (pharmacy_id, medicament_id)
    so re-uploading tomorrow's stock cleanly replaces today's snapshot. The UPSERT is
    chunk-safe — re-applying the same row is idempotent. Within ONE chunk we still
    dedup on medicament_id so a duplicate PID inside the chunk doesn't blow up the
    values list (rare but cheap to guard against).

    batch_id threading: first chunk passes None → creates an ImportBatch and returns
    its id. Subsequent chunks pass that id → get_or_create_batch reuses the row and
    we accumulate rows_inserted / rows_skipped on it. Mirrors achat/vente.

    Each row keeps `import_batch_id` = this import: deleting / cancelling it removes them."""
    batch = get_or_create_batch(
        db, pharmacy_id=pharmacy_id, file_type="stock", filename=filename, batch_id=batch_id, user_id=user_id
    )
    med_id_by_pid, new_medicaments = batch_resolve_medicaments(db, rows)

    seen_meds: set[int] = set()
    inserted_rows: list[dict] = []
    skipped_unknown: list[dict[str, str | None]] = []

    for row in rows:
        pid = col(row, COL_PID)
        if not pid:
            continue
        med_id = med_id_by_pid.get(pid)
        if not med_id:
            skipped_unknown.append({"pid": pid, "product": col(row, COL_PRODUCT)})
            continue
        if med_id in seen_meds:
            continue
        seen_meds.add(med_id)
        inserted_rows.append(
            {
                "pharmacy_id": pharmacy_id,
                "medicament_id": med_id,
                "current_stock": parse_int(col(row, "Stock")) or 0,
                "stock_min": parse_int(col(row, COL_STOCK_MIN)),
                "stock_max": parse_int(col(row, COL_STOCK_MAX)),
                "expiry_date": parse_date(col(row, COL_EXPIRY)),
                "zone": col(row, COL_ZONE),
                "import_batch_id": batch.id,
            }
        )

    if inserted_rows:
        stmt = pg_insert(PharmacyStock).values(inserted_rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=["pharmacy_id", "medicament_id"],
            set_={
                "current_stock": stmt.excluded.current_stock,
                "stock_min": stmt.excluded.stock_min,
                "stock_max": stmt.excluded.stock_max,
                "expiry_date": stmt.excluded.expiry_date,
                "zone": stmt.excluded.zone,
                "import_batch_id": stmt.excluded.import_batch_id,
            },
        )
        db.execute(stmt)

    batch.rows_inserted += len(inserted_rows)
    batch.rows_skipped += len(skipped_unknown)
    # Stays `in_progress` until the final PATCH « success » (see insert_transactions).
    batch.last_chunk_at = datetime.now(timezone.utc)
    db.commit()
    return {
        "inserted": len(inserted_rows),
        "skipped_unknown": skipped_unknown,
        "total_rows": len(rows),
        "batch_id": batch.id,
        "new_medicaments": {
            "count": len(new_medicaments),
            "sample": [m.product or m.pid for m in new_medicaments[:10]],
        },
    }


_TABLES = {"achat": Achat.__tablename__, "vente": Vente.__tablename__, "stock": PharmacyStock.__tablename__}


def analyze(db: Session, file_type: str) -> None:
    """Fresh table statistics right after an import / undo. Without them Postgres
    plans the first Rapport queries blind until autoanalyze runs (~1 min later):
    100k ventes → /stats 39 s instead of 0.5 s."""
    table = _TABLES.get(file_type)
    if table:
        db.execute(text(f"ANALYZE {table}"))
        db.commit()


def end_batch(db: Session, batch: ImportBatch, status: str, user: User | None, error_message: str | None = None) -> int:
    """A batch's new status (the wizard's PATCH, the Sobrus robot). « cancelled » = true undo: its
    Achat / Vente / stock rows deleted, counters back to 0 (stock: the values it replaced don't come
    back). The first time it ends (success / cancelled / error): its line in the history. success /
    cancelled: fresh table statistics. Returns the number of rows deleted."""
    deleted_rows = 0
    if status == "cancelled":
        if batch.file_type == "achat":
            deleted_rows = db.query(Achat).filter(Achat.import_batch_id == batch.id).delete()
        elif batch.file_type == "vente":
            deleted_rows = db.query(Vente).filter(Vente.import_batch_id == batch.id).delete()
        else:
            deleted_rows = db.query(PharmacyStock).filter(PharmacyStock.import_batch_id == batch.id).delete()
        batch.rows_inserted = 0
        batch.rows_skipped = 0

    ended = status != batch.status and status in IMPORT_ENDS
    batch.status = status
    if error_message is not None:
        batch.error_message = error_message
    if ended:  # « Historique des modifications »: how the import ended
        details = {
            "batch_id": batch.id,
            "type": batch.file_type,
            "file": batch.filename,
            "imported": batch.rows_inserted,
            "skipped": batch.rows_skipped,
        }
        if status == "error":
            details["error"] = batch.error_message
        log_action(db, user, batch.pharmacy_id, IMPORT_ENDS[status], details)
    if status == "success":  # new products of the file: the admin's and Support's « N produits à classer »
        sync_unclassified(db)
    db.commit()
    if status in ("success", "cancelled"):
        analyze(db, batch.file_type)
    return deleted_rows
