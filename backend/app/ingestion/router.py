"""Imports: catalogue CSV (admin), achat / vente / stock JSON chunks from the
browser wizard, batch status, import history + delete."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any, Callable

from fastapi import APIRouter, File, Path, Query, status, UploadFile
from sqlalchemy import desc, func, or_, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import aliased, Query as OrmQuery, Session

from app.ingestion.csv_parse import (
    classify_product_type,
    col,
    existing_by_name,
    normalize_date,
    normalize_datetime,
    normalized_name,
    parse_catalog_csv,
    parse_date,
    parse_float,
    parse_int,
)
from app.core.database import DbDep
from app.core.errors import ApiError, ErrorCode
from app.core.models import Achat, ImportBatch, Medicament, PharmacyStock, User, Vente
from app.core.permissions import AdminDep, member, require_pharmacy_owner
from app.catalog.schemas import CatalogImportResponse
from app.ingestion.schemas import ImportsListResponse, JsonUploadBody, PatchBatchBody
from app.ledger.schemas import paginate
from app.core.security import CurrentUserDep


router = APIRouter(tags=["imports"])


# ═══ Uploads ═════════════════════════════════════════════════════════════════
# Sobrus CSV ingestion endpoints.
#
#   • JSON chunks (the /upload-file wizard parses the CSV in the browser and
#     POSTs 500-row chunks):
#       POST /v1/uploads/achat-json
#       POST /v1/uploads/vente-json
#       POST /v1/uploads/stock-json
#   • Catalogue CSV (admin, multipart):
#       POST /v1/uploads/catalog
#   • Cancel / fail a running batch:
#       PATCH /v1/uploads/batches/{id}
#
# Chunked uploads thread `batch_id`: chunk 1 returns a fresh ImportBatch id,
# later chunks pass it, so one file = ONE audit row.
#
# Stock uses Postgres `ON CONFLICT (pharmacy_id, medicament_id)` upsert, so
# re-importing a newer stock snapshot updates the existing rows.
#
# Catalogue file-size limit: MAX_FILE_BYTES (100 MB).

MAX_FILE_BYTES = 100 * 1024 * 1024  # 100 MB
ALLOWED_STATUSES = {"in_progress", "success", "cancelled", "error"}
EMPTY_FILE_DETAIL = "Aucune donnée trouvée dans le fichier."
EMPTY_BODY_DETAIL = "Aucune ligne dans la requête."


# ─── Shared helpers ──────────────────────────────────────────────────────────


def _check_size(content: bytes) -> None:
    if len(content) > MAX_FILE_BYTES:
        raise ApiError(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            ErrorCode.FILE_TOO_LARGE,
            f"Fichier trop volumineux (max {MAX_FILE_BYTES // (1024 * 1024)} Mo).",
            max_mb=MAX_FILE_BYTES // (1024 * 1024),
        )


def _check_csv(file: UploadFile) -> None:
    if not (file.filename or "").lower().endswith(".csv"):
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            ErrorCode.CSV_ONLY,
            "Seuls les fichiers CSV sont acceptés.",
        )


def _get_or_create_batch(
    db: Session, *, pharmacy_id: int, file_type: str, filename: str | None, batch_id: int | None, user_id: int
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
    `_insert_transactions` and runs against either config unchanged."""

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


def _batch_resolve_medicaments(
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
        # Fill missing TVA / zone, refresh prices. Category intentionally NOT
        # overwritten — admin-curated.
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


def _preload_existing_keys(
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


def _insert_transactions(
    db: Session,
    rows: list[dict[str, Any]],
    *,
    pharmacy_id: int,
    filename: str | None,
    batch_id: int | None,
    user_id: int,
    cfg: TransactionConfig,
) -> dict:
    """Generic ingest for Achat or Vente rows. Differences captured by `cfg`.

    Fast path: batch-resolve all PIDs in one SELECT + insert all transaction rows
    in one executemany. What was N+1 SELECT/flush per chunk is now 2 queries total
    (medicament resolve + dedup preload) plus 1 bulk INSERT."""
    batch = _get_or_create_batch(
        db,
        pharmacy_id=pharmacy_id,
        file_type=cfg.file_type,
        filename=filename,
        batch_id=batch_id,
        user_id=user_id,
    )
    med_id_by_pid, new_medicaments = _batch_resolve_medicaments(db, rows)
    refs = {r.get(cfg.dedup_column) for r in rows if r.get(cfg.dedup_column)}
    existing = _preload_existing_keys(db, cfg, pharmacy_id, refs, batch.id)

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


def _insert_stock(
    db: Session,
    rows: list[dict[str, Any]],
    *,
    pharmacy_id: int,
    filename: str | None,
    batch_id: int | None,
    user_id: int,
) -> dict:
    """Chunked stock import. Postgres ON CONFLICT upsert by (pharmacy_id, medicament_id)
    so re-uploading tomorrow's stock cleanly replaces today's snapshot. The UPSERT is
    chunk-safe — re-applying the same row is idempotent. Within ONE chunk we still
    dedup on medicament_id so a duplicate PID inside the chunk doesn't blow up the
    values list (rare but cheap to guard against).

    batch_id threading: first chunk passes None → creates an ImportBatch and returns
    its id. Subsequent chunks pass that id → _get_or_create_batch reuses the row and
    we accumulate rows_inserted / rows_skipped on it. Mirrors achat/vente.

    Each row keeps `import_batch_id` = this import: deleting / cancelling it removes them."""
    batch = _get_or_create_batch(
        db, pharmacy_id=pharmacy_id, file_type="stock", filename=filename, batch_id=batch_id, user_id=user_id
    )
    med_id_by_pid, new_medicaments = _batch_resolve_medicaments(db, rows)

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
    # Stays `in_progress` until the final PATCH « success » (see _insert_transactions).
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


# ─── Catalogue CSV (admin, multipart) ────────────────────────────────────────

_CATALOG_MUTABLE_COLS = ("product", "tva", "pph", "ppv", "category", "barcode1", "barcode2", "laboratoire")


def _apply_catalog_row(db: Session, existing: Medicament | None, row: dict) -> tuple[Medicament, bool]:
    """Apply one parsed catalog row. Returns (medicament, was_update): was_update
    True updated an existing row, False inserted a new one. Catch-up: classifies
    NULL product_type on existing rows (catalogue is the source of truth — see
    F19). Admin-edited types stay untouched."""
    if existing:
        for c in _CATALOG_MUTABLE_COLS:
            v = row.get(c)
            if v is not None:
                setattr(existing, c, v)
        if existing.product_type is None:
            existing.product_type = classify_product_type(row.get("category"))
        return existing, True
    med = Medicament(**row, product_type=classify_product_type(row.get("category")))
    db.add(med)
    return med, False


FILE_CORRUPTED_DETAIL = "Ce fichier est abîmé. Téléchargez-le à nouveau depuis Sobrus, puis réessayez."


def _reject_corrupted(rows: list[dict[str, str]]) -> None:
    """A NUL byte = damaged file (Postgres refuses it in any text): stop before writing
    anything, with a message the user can act on (the browser checks first, see
    frontend pages/imports/upload/hooks.ts)."""
    if any("\x00" in v for r in rows for v in r.values()):
        raise ApiError(400, ErrorCode.FILE_CORRUPTED, FILE_CORRUPTED_DETAIL)


@router.post("/uploads/catalog", response_model=CatalogImportResponse)
def upload_catalog(
    user: AdminDep,
    db: DbDep,
    file: Annotated[UploadFile, File(description="Sobrus catalogue CSV (comma-delimited)")],
) -> dict:
    """Admin-only catalog import. Upsert by synthetic PID:
       - INSERT new rows
       - UPDATE mutable fields on existing rows (PRESERVE product_type — admin override)
       - rows in DB that disappear from the CSV are kept (no destructive delete)

    Mojibake fix runs automatically via `parse_csv()` → `clean_value()`."""
    _check_csv(file)
    # Plain `def` (FastAPI runs it in a thread): the DB work below is blocking, so an
    # `async def` here froze every other request during a big catalogue upload.
    content = file.file.read()
    _check_size(content)
    if b"\x00" in content:
        raise ApiError(400, ErrorCode.FILE_CORRUPTED, FILE_CORRUPTED_DETAIL)
    parsed, errors = parse_catalog_csv(content)
    if not parsed and not errors:
        raise ApiError(400, ErrorCode.EMPTY_FILE, EMPTY_FILE_DETAIL)

    pids = [r["pid"] for r in parsed]
    by_pid = {m.pid: m for m in db.query(Medicament).filter(Medicament.pid.in_(pids)).all()}
    # Name-dedup: a catalog row whose PID is new but whose product name already
    # exists (under a different PID — e.g. a row the sales import created) MERGES
    # onto that row (adding the laboratoire) instead of forking a duplicate.
    by_name = existing_by_name(db, (r.get("product") for r in parsed if r["pid"] not in by_pid))
    inserted = updated = 0
    for row in parsed:
        match = by_pid.get(row["pid"]) or by_name.get(normalized_name(row.get("product")))
        med, was_update = _apply_catalog_row(db, match, row)
        if was_update:
            updated += 1
        else:
            inserted += 1
            nkey = normalized_name(row.get("product"))
            if nkey:
                by_name[nkey] = med  # later same-name rows in this CSV merge onto it
    db.commit()
    return {
        "total_rows": len(parsed),
        "inserted": inserted,
        "updated": updated,
        "skipped": len(errors),
        "errors": errors[:10],
    }


# ─── JSON endpoints (Chrome extension) ───────────────────────────────────────


@router.post("/uploads/achat-json")
def upload_achat_json(
    body: JsonUploadBody, pharmacy_id: Annotated[int, member("import", "achats")], user: CurrentUserDep, db: DbDep
) -> dict:
    if not body.rows:
        raise ApiError(400, ErrorCode.EMPTY_BODY, EMPTY_BODY_DETAIL)
    _reject_corrupted(body.rows)
    return _insert_transactions(
        db,
        body.rows,
        pharmacy_id=pharmacy_id,
        filename=body.filename,
        batch_id=body.batch_id,
        user_id=user.id,
        cfg=ACHAT_CFG,
    )


@router.post("/uploads/vente-json")
def upload_vente_json(
    body: JsonUploadBody, pharmacy_id: Annotated[int, member("import", "ventes")], user: CurrentUserDep, db: DbDep
) -> dict:
    if not body.rows:
        raise ApiError(400, ErrorCode.EMPTY_BODY, EMPTY_BODY_DETAIL)
    _reject_corrupted(body.rows)
    return _insert_transactions(
        db,
        body.rows,
        pharmacy_id=pharmacy_id,
        filename=body.filename,
        batch_id=body.batch_id,
        user_id=user.id,
        cfg=VENTE_CFG,
    )


@router.post("/uploads/stock-json")
def upload_stock_json(
    body: JsonUploadBody, pharmacy_id: Annotated[int, member("import", "stock")], user: CurrentUserDep, db: DbDep
) -> dict:
    """Chunked stock import — same JSON shape as achat/vente. First chunk passes
    batch_id=None (creates the ImportBatch); subsequent chunks reuse it via the
    returned batch_id. Postgres ON CONFLICT keeps the per-chunk UPSERTs idempotent."""
    if not body.rows:
        raise ApiError(400, ErrorCode.EMPTY_BODY, EMPTY_BODY_DETAIL)
    _reject_corrupted(body.rows)
    return _insert_stock(
        db, body.rows, pharmacy_id=pharmacy_id, filename=body.filename, batch_id=body.batch_id, user_id=user.id
    )


# ─── PATCH batch status (cancel) ─────────────────────────────────────────────

_TABLES = {"achat": Achat.__tablename__, "vente": Vente.__tablename__, "stock": PharmacyStock.__tablename__}


def _analyze(db: Session, file_type: str) -> None:
    """Fresh table statistics right after an import / undo. Without them Postgres
    plans the first Rapport queries blind until autoanalyze runs (~1 min later):
    100k ventes → /stats 39 s instead of 0.5 s."""
    table = _TABLES.get(file_type)
    if table:
        db.execute(text(f"ANALYZE {table}"))
        db.commit()


@router.patch("/uploads/batches/{batch_id}")
def patch_batch_status(
    batch_id: Annotated[int, Path(ge=1)],
    body: PatchBatchBody,
    user: CurrentUserDep,
    db: DbDep,
) -> dict:
    """Update a batch's status. Two semantics:

    - `status="cancelled"`: TRUE UNDO. Deletes every Achat / Vente / stock row that
      was written under this batch_id and resets the audit counters to 0. The
      ImportBatch row stays for auditing ("this user attempted then cancelled").
      Stock: the values the file replaced are not brought back (UPSERT).
    - `status="error"`: same audit-only flip + carry the error_message. Rows
      already inserted stay (the failing chunk was likely network-side, not data-side).
    - `status="success"`: sent once after the last chunk → refresh table statistics.
    """
    if body.status not in ALLOWED_STATUSES:
        raise ApiError(
            400,
            ErrorCode.INVALID_BATCH_STATUS,
            f"Statut invalide. Attendu : {sorted(ALLOWED_STATUSES)}",
            allowed=", ".join(sorted(ALLOWED_STATUSES)),
        )

    batch = db.get(ImportBatch, batch_id)
    if batch is None:
        raise ApiError(404, ErrorCode.BATCH_NOT_FOUND, "Lot d'import introuvable.")
    if batch.pharmacy_id != user.pharmacy_id and user.role != "admin":
        raise ApiError(403, ErrorCode.BATCH_FORBIDDEN, "Accès refusé à ce lot d'import.")

    deleted_rows = 0
    if body.status == "cancelled":
        if batch.file_type == "achat":
            deleted_rows = db.query(Achat).filter(Achat.import_batch_id == batch.id).delete()
        elif batch.file_type == "vente":
            deleted_rows = db.query(Vente).filter(Vente.import_batch_id == batch.id).delete()
        else:
            deleted_rows = db.query(PharmacyStock).filter(PharmacyStock.import_batch_id == batch.id).delete()
        batch.rows_inserted = 0
        batch.rows_skipped = 0

    batch.status = body.status
    if body.error_message is not None:
        batch.error_message = body.error_message
    db.commit()
    if body.status in ("success", "cancelled"):
        _analyze(db, batch.file_type)
    return {
        "id": batch.id,
        "status": batch.status,
        "error_message": batch.error_message,
        "deleted_rows": deleted_rows,
    }


# ═══ Import history ══════════════════════════════════════════════════════════
# Imports history + soft-delete endpoints for the /imports page.
#
# One logical import = one ImportBatch row. The table can list rows 1:1 with no
# SQL grouping logic.
#
# DELETE is a SOFT delete: the achat/vente rows are still removed (true undo
# for transactional data), but the batch row stays with `deleted_at` +
# `deleted_by_user_id` populated, so the /imports page can show it as history.
# Stock batches: the stock rows this import wrote last are removed too (the values it
# replaced are not brought back: UPSERT).
#
# Per-role visibility + authz (mirrors the listing scope):
#   - admin    → only batches they created (in practice ~empty)
#   - owner    → batches they created OR created by an employee in their pharmacy
#   - employee → only batches they created


def _visible_batches_query(db: Session, user: User) -> OrmQuery:
    """Returns the base query over ImportBatch filtered by the caller's
    per-role visibility rules. Reused by list (page through it) and delete
    (find-by-id and 404 if outside scope).

    - admin    → batches whose creator is the admin themselves
    - owner    → caller's own batches OR batches whose creator is an active
                 employee in the caller's pharmacy
    - employee → caller's own batches
    """
    base = db.query(ImportBatch)
    if user.role == "admin":
        return base.filter(ImportBatch.created_by_user_id == user.id)
    if user.role == "owner":
        employee_ids_sq = (
            db.query(User.id).filter(User.pharmacy_id == user.pharmacy_id, User.role == "employee").subquery()
        )
        # Legacy batches (created before migration 0014) have NULL creator. They
        # belong to the pharmacy, so the owner — manager of pharmacy-scoped state
        # — sees + can delete them. Employees stay NULL-exclusive.
        return base.filter(
            ImportBatch.pharmacy_id == user.pharmacy_id,
            or_(
                ImportBatch.created_by_user_id == user.id,
                ImportBatch.created_by_user_id.in_(employee_ids_sq.select()),
                ImportBatch.created_by_user_id.is_(None),
            ),
        )
    # employee
    return base.filter(
        ImportBatch.pharmacy_id == user.pharmacy_id,
        ImportBatch.created_by_user_id == user.id,
    )


# The browser sends the next chunk as soon as the previous one is stored (a few seconds
# at most): no chunk for this long while `in_progress` = closed / refreshed / offline.
INTERRUPTED_AFTER = timedelta(minutes=1)


def _shown_status(batch: ImportBatch) -> str:
    """`interrupted` (never stored): `in_progress` with no chunk for INTERRUPTED_AFTER."""
    last = batch.last_chunk_at or batch.imported_at
    if batch.status == "in_progress" and last < datetime.now(timezone.utc) - INTERRUPTED_AFTER:
        return "interrupted"
    return batch.status


def _serialize(batch: ImportBatch, creator: User | None, deletor: User | None) -> dict:
    return {
        "id": batch.id,
        "file_type": batch.file_type,
        "filename": batch.filename,
        "rows_inserted": batch.rows_inserted,
        "rows_skipped": batch.rows_skipped,
        "status": _shown_status(batch),
        "error_message": batch.error_message,
        "imported_at": batch.imported_at,
        "created_by_full_name": creator.name if creator else None,
        "created_by_email": creator.email if creator else None,
        "deleted_at": batch.deleted_at,
        "deleted_by_full_name": deletor.name if deletor else None,
        "deleted_by_email": deletor.email if deletor else None,
    }


@router.get("/data/imports", response_model=ImportsListResponse)
def list_imports(
    user: CurrentUserDep,
    db: DbDep,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> dict:
    # Non-admin must have the `import` feature; admin bypasses.
    if user.role != "admin":
        require_pharmacy_owner(user, db, feature="import")

    creator = aliased(User)
    deletor = aliased(User)
    scope = _visible_batches_query(db, user)
    total = scope.with_entities(func.count(ImportBatch.id)).scalar() or 0

    rows = (
        scope.outerjoin(creator, creator.id == ImportBatch.created_by_user_id)
        .outerjoin(deletor, deletor.id == ImportBatch.deleted_by_user_id)
        .with_entities(ImportBatch, creator, deletor)
        .order_by(desc(ImportBatch.imported_at))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {
        "data": [_serialize(b, c, d) for b, c, d in rows],
        "pagination": paginate(total, page, limit),
    }


@router.delete("/data/imports/{batch_id}")
def delete_import(
    batch_id: Annotated[int, Path(ge=1)],
    user: CurrentUserDep,
    db: DbDep,
) -> dict:
    """Soft-delete: removes the Achat / Vente / stock rows belonging to this batch, then
    marks the batch row with `deleted_at` + `deleted_by_user_id`. The row remains
    visible on /imports as history.

    Per-role authz mirrors the list scope (see `_visible_batches_query`):
    if you can see it, you can delete it. 404 on out-of-scope to avoid
    leaking existence."""
    if user.role != "admin":
        require_pharmacy_owner(user, db, feature="import")

    batch = _visible_batches_query(db, user).filter(ImportBatch.id == batch_id).first()
    if batch is None:
        raise ApiError(404, ErrorCode.BATCH_NOT_FOUND, "Lot d'import introuvable.")
    if batch.deleted_at is not None:
        raise ApiError(409, ErrorCode.BATCH_ALREADY_DELETED, "Ce lot a déjà été supprimé.")

    deleted_rows = 0
    if batch.file_type == "achat":
        deleted_rows = db.query(Achat).filter(Achat.import_batch_id == batch.id).delete()
    elif batch.file_type == "vente":
        deleted_rows = db.query(Vente).filter(Vente.import_batch_id == batch.id).delete()
    else:
        deleted_rows = db.query(PharmacyStock).filter(PharmacyStock.import_batch_id == batch.id).delete()

    batch.deleted_at = datetime.now(timezone.utc)
    batch.deleted_by_user_id = user.id
    db.commit()
    _analyze(db, batch.file_type)
    return {"id": batch_id, "deleted_rows": deleted_rows, "file_type": batch.file_type}
