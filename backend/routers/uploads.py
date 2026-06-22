"""Sobrus CSV ingestion endpoints.

Six endpoints in two flavours:
  • Multipart CSV uploads (browser file picker):
      POST /v1/uploads/achat
      POST /v1/uploads/vente
      POST /v1/uploads/stock
  • JSON payload (Chrome extension DOM-scrapes Sobrus tables → POSTs rows directly):
      POST /v1/uploads/achat-json
      POST /v1/uploads/vente-json
  • Cancel a running batch (audit Decision 3):
      PATCH /v1/uploads/batches/{id}

Achats/Ventes support chunked uploads via `batch_id`: chunk 1 returns a fresh
ImportBatch id, subsequent chunks pass that id so a 2 000-row file produces ONE
audit row (fixes apcm-pharma's batch_id threading bug).

Stock is single-shot — Sobrus stock exports are point-in-time snapshots, no
chunking needed. Uses Postgres `ON CONFLICT (pharmacy_id, medicament_id)` upsert
so re-importing yesterday's stock seamlessly updates today's row.

File-size limit: 10 MB across all endpoints.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Any, Callable

from fastapi import APIRouter, File, Form, HTTPException, Path, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from csv_parse import (
    col, parse_catalog_csv, parse_csv, parse_float, parse_int, parse_iso_date,
    upsert_medicament,
)
from database import DbDep
from models import Achat, ImportBatch, Medicament, PharmacyStock, Vente
from permissions import require_admin, require_pharmacy_owner
from schemas.catalog import CatalogImportResponse
from security import CurrentUserDep


router = APIRouter(tags=["uploads"])


MAX_FILE_BYTES = 10 * 1024 * 1024   # 10 MB
ALLOWED_STATUSES = {"in_progress", "success", "cancelled", "error"}
EMPTY_FILE_DETAIL = "Aucune donnée trouvée dans le fichier."


# ─── Pydantic bodies (JSON variants + PATCH) ─────────────────────────────────

class JsonRow(BaseModel):
    """Single Sobrus-row scraped from the DOM. Keys are the column labels."""
    key:   str
    value: str | None = None


class JsonUploadBody(BaseModel):
    rows:     list[dict[str, str]]    # the extension serializes one row as {label: value, ...}
    filename: str | None = None
    batch_id: int | None = None


class PatchBatchBody(BaseModel):
    status:        str
    error_message: str | None = None


# ─── Shared helpers ──────────────────────────────────────────────────────────

def _check_size(content: bytes) -> None:
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Fichier trop volumineux (max {MAX_FILE_BYTES // (1024*1024)} Mo).",
        )


def _check_csv(file: UploadFile) -> None:
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Seuls les fichiers CSV sont acceptés.",
        )


def _get_or_create_batch(db: Session, *, pharmacy_id: int, file_type: str, filename: str | None,
                        batch_id: int | None) -> ImportBatch:
    """Returns the existing batch if `batch_id` is given AND it belongs to this pharmacy.
    Otherwise creates a fresh `in_progress` batch and returns it. New batches start at
    rows_inserted=0 / rows_skipped=0; chunked uploads accumulate on later calls."""
    if batch_id is not None:
        batch = db.get(ImportBatch, batch_id)
        if batch and batch.pharmacy_id == pharmacy_id and batch.file_type == file_type:
            return batch
        # silently fall through to create — caller passed a stale/foreign id
    batch = ImportBatch(
        pharmacy_id=pharmacy_id, file_type=file_type, filename=filename,
        rows_inserted=0, rows_skipped=0, status="in_progress",
    )
    db.add(batch)
    db.flush()
    return batch


# ─── Sobrus CSV column name constants (catch typos at import time) ───────────

COL_PID         = "PID"
COL_PRODUCT     = "Produit"
COL_CATEGORY    = "Catégorie"
COL_TVA         = "TVA"
COL_PPH         = "PPH"
COL_PPV         = "PPV"
COL_ZONE        = "Zone"
COL_QUANTITY    = "Quantité"
COL_TOTAL       = "Total"
COL_UNIT_PRICE  = "Prix unitaire"
# Achat-only
COL_DELIVERY_REF  = "Référence de livraison"
COL_DELIVERY_DATE = "Date Bon de Livraison"
COL_CREATED      = "Créée le"
COL_SUPPLIER     = "Fournisseur"
COL_EXPIRY       = "Date de péremption"
COL_STOCK_MIN    = "Stock min"
COL_STOCK_MAX    = "Stock max"
# Vente-only
COL_TXN_REF      = "Numéro de transaction"
COL_DATE         = "Date"
COL_CLIENT       = "Client"
COL_DISCOUNT     = "Remise"


# ─── Per-type config + one generic insert pipeline (replaces _insert_achats + _insert_ventes) ─

@dataclass(frozen=True)
class TransactionConfig:
    """Captures the 5 things that differ between an Achat ingest and a Vente ingest.
    Everything else (medicament upsert, dedup, batch accounting, commit) is in
    `_insert_transactions` and runs against either config unchanged."""
    file_type:    str                                              # "achat" | "vente"
    model:        type                                             # Achat | Vente (SQLAlchemy class)
    dedup_column: str                                              # CSV column to dedup on
    dedup_attr:   str                                              # corresponding model attribute name
    build_row:    Callable[[dict[str, Any], int, int, int], Any]   # (row, pharmacy_id, med_id, batch_id) → model instance


ACHAT_CFG = TransactionConfig(
    file_type="achat",
    model=Achat,
    dedup_column=COL_DELIVERY_REF,
    dedup_attr="delivery_ref",
    build_row=lambda row, pharm_id, med_id, batch_id: Achat(
        pharmacy_id=pharm_id, medicament_id=med_id, import_batch_id=batch_id,
        created_at_source=col(row, COL_CREATED),
        delivery_date=col(row, COL_DELIVERY_DATE),
        delivery_ref=col(row, COL_DELIVERY_REF),
        supplier=col(row, COL_SUPPLIER),
        quantity=parse_float(col(row, COL_QUANTITY)),
        unit_price=parse_float(col(row, COL_UNIT_PRICE)),
        expiry_date=col(row, COL_EXPIRY),
        stock_min=parse_float(col(row, COL_STOCK_MIN)),
        stock_max=parse_float(col(row, COL_STOCK_MAX)),
        total=parse_float(col(row, COL_TOTAL)),
    ),
)

VENTE_CFG = TransactionConfig(
    file_type="vente",
    model=Vente,
    dedup_column=COL_TXN_REF,
    dedup_attr="transaction_ref",
    build_row=lambda row, pharm_id, med_id, batch_id: Vente(
        pharmacy_id=pharm_id, medicament_id=med_id, import_batch_id=batch_id,
        date=col(row, COL_DATE),
        transaction_ref=col(row, COL_TXN_REF),
        client=col(row, COL_CLIENT),
        quantity=parse_float(col(row, COL_QUANTITY)),
        discount=parse_float(col(row, COL_DISCOUNT)),
        unit_price=parse_float(col(row, COL_UNIT_PRICE)),
        total=parse_float(col(row, COL_TOTAL)),
    ),
)


def _preload_existing_keys(db: Session, cfg: TransactionConfig, pharmacy_id: int,
                          refs: set[str]) -> set[tuple[str, int]]:
    """Cheap O(1) dedup membership test: pre-load every (dedup_value, med_id) pair
    already in DB for this pharmacy, so the per-row check is a Python `in`."""
    if not refs:
        return set()
    dedup_col = getattr(cfg.model, cfg.dedup_attr)
    rows = (
        db.query(dedup_col, cfg.model.medicament_id)
          .filter(cfg.model.pharmacy_id == pharmacy_id, dedup_col.in_(refs))
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
    cfg: TransactionConfig,
) -> dict:
    """Generic ingest for Achat or Vente rows. Differences captured by `cfg`."""
    batch = _get_or_create_batch(
        db, pharmacy_id=pharmacy_id, file_type=cfg.file_type,
        filename=filename, batch_id=batch_id,
    )
    refs = {r.get(cfg.dedup_column) for r in rows if r.get(cfg.dedup_column)}
    existing = _preload_existing_keys(db, cfg, pharmacy_id, refs)

    inserted = 0
    skipped  = 0
    for row in rows:
        pid = col(row, COL_PID)
        if not pid:
            skipped += 1
            continue
        med = upsert_medicament(
            db, pid=pid,
            product=col(row, COL_PRODUCT) or pid,
            tva=col(row, COL_TVA),
            pph=parse_float(col(row, COL_PPH)),
            ppv=parse_float(col(row, COL_PPV)),
            category=col(row, COL_CATEGORY),
            zone=col(row, COL_ZONE),
        )
        if not med:
            skipped += 1
            continue
        ref = col(row, cfg.dedup_column)
        if ref and (ref, med.id) in existing:
            skipped += 1
            continue
        db.add(cfg.build_row(row, pharmacy_id, med.id, batch.id))
        if ref:
            existing.add((ref, med.id))
        inserted += 1

    batch.rows_inserted += inserted
    batch.rows_skipped  += skipped
    batch.status = "success"
    db.commit()
    return {"inserted": inserted, "skipped": skipped, "batch_id": batch.id}


def _insert_stock(db: Session, rows: list[dict[str, Any]], *, pharmacy_id: int,
                  filename: str | None) -> dict:
    """Single-shot stock import. Postgres ON CONFLICT upsert by (pharmacy_id, medicament_id)
    so re-uploading tomorrow's stock cleanly replaces today's snapshot. Within one CSV we
    also dedup on medicament_id so multi-row Sobrus exports don't blow up the upsert."""
    batch = _get_or_create_batch(db, pharmacy_id=pharmacy_id, file_type="stock",
                                 filename=filename, batch_id=None)

    seen_meds: set[int] = set()
    inserted_rows: list[dict] = []
    skipped_unknown: list[dict[str, str | None]] = []

    for row in rows:
        pid = col(row, COL_PID)
        if not pid:
            continue
        med = upsert_medicament(
            db, pid=pid,
            product=col(row, COL_PRODUCT) or pid,
            tva=col(row, COL_TVA),
            pph=parse_float(col(row, COL_PPH)),
            ppv=parse_float(col(row, COL_PPV)),
            category=col(row, COL_CATEGORY),
            zone=col(row, COL_ZONE),
        )
        if not med:
            skipped_unknown.append({"pid": pid, "product": col(row, COL_PRODUCT)})
            continue
        if med.id in seen_meds:
            continue
        seen_meds.add(med.id)
        inserted_rows.append({
            "pharmacy_id":   pharmacy_id,
            "medicament_id": med.id,
            "current_stock": parse_int(col(row, "Stock")) or 0,
            "stock_min":     parse_int(col(row, COL_STOCK_MIN)),
            "stock_max":     parse_int(col(row, COL_STOCK_MAX)),
            "expiry_date":   parse_iso_date(col(row, COL_EXPIRY)),
            "zone":          col(row, COL_ZONE),
        })

    if inserted_rows:
        stmt = pg_insert(PharmacyStock).values(inserted_rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=["pharmacy_id", "medicament_id"],
            set_={
                "current_stock": stmt.excluded.current_stock,
                "stock_min":     stmt.excluded.stock_min,
                "stock_max":     stmt.excluded.stock_max,
                "expiry_date":   stmt.excluded.expiry_date,
                "zone":          stmt.excluded.zone,
            },
        )
        db.execute(stmt)

    batch.rows_inserted = len(inserted_rows)
    batch.rows_skipped  = len(skipped_unknown)
    batch.status = "success"
    db.commit()
    return {
        "inserted":        len(inserted_rows),
        "skipped_unknown": skipped_unknown,
        "total_rows":      len(rows),
        "batch_id":        batch.id,
    }


# ─── Permission gate ─────────────────────────────────────────────────────────

# ─── Multipart endpoints ─────────────────────────────────────────────────────

async def _read_csv_or_400(file: UploadFile) -> list[dict[str, str]]:
    """Validate + read + parse a CSV upload in one shot. Raises 400/413 on failure."""
    _check_csv(file)
    content = await file.read()
    _check_size(content)
    rows = parse_csv(content)
    if not rows:
        raise HTTPException(status_code=400, detail=EMPTY_FILE_DETAIL)
    return rows


@router.post("/uploads/achat")
async def upload_achat(
    user: CurrentUserDep,
    db: DbDep,
    file: Annotated[UploadFile, File(description="Sobrus Achats CSV")],
    batch_id: Annotated[int | None, Form()] = None,
) -> dict:
    pharmacy_id = require_pharmacy_owner(user, db, feature="import")
    rows = await _read_csv_or_400(file)
    return _insert_transactions(db, rows, pharmacy_id=pharmacy_id,
                                filename=file.filename, batch_id=batch_id, cfg=ACHAT_CFG)


@router.post("/uploads/vente")
async def upload_vente(
    user: CurrentUserDep,
    db: DbDep,
    file: Annotated[UploadFile, File(description="Sobrus Ventes CSV")],
    batch_id: Annotated[int | None, Form()] = None,
) -> dict:
    pharmacy_id = require_pharmacy_owner(user, db, feature="import")
    rows = await _read_csv_or_400(file)
    return _insert_transactions(db, rows, pharmacy_id=pharmacy_id,
                                filename=file.filename, batch_id=batch_id, cfg=VENTE_CFG)


@router.post("/uploads/stock")
async def upload_stock(
    user: CurrentUserDep,
    db: DbDep,
    file: Annotated[UploadFile, File(description="Sobrus Stock CSV")],
) -> dict:
    pharmacy_id = require_pharmacy_owner(user, db, feature="import")
    rows = await _read_csv_or_400(file)
    return _insert_stock(db, rows, pharmacy_id=pharmacy_id, filename=file.filename)


@router.post("/uploads/catalog", response_model=CatalogImportResponse)
async def upload_catalog(
    user: CurrentUserDep,
    db:   DbDep,
    file: Annotated[UploadFile, File(description="Sobrus catalogue CSV (comma-delimited)")],
) -> dict:
    """Admin-only catalog import. Upsert by synthetic PID:
       - INSERT new rows
       - UPDATE mutable fields on existing rows (PRESERVE product_type — admin override)
       - rows in DB that disappear from the CSV are kept (no destructive delete)

    Mojibake fix runs automatically via `parse_csv()` → `clean_value()`."""
    require_admin(user)
    _check_csv(file)
    content = await file.read()
    _check_size(content)
    parsed, errors = parse_catalog_csv(content)
    if not parsed and not errors:
        raise HTTPException(status_code=400, detail=EMPTY_FILE_DETAIL)

    pids = [r["pid"] for r in parsed]
    existing = {
        m.pid: m for m in db.query(Medicament).filter(Medicament.pid.in_(pids)).all()
    }
    inserted = updated = 0
    mutable_cols = ("product", "tva", "pph", "ppv", "category", "barcode1", "barcode2", "laboratoire")
    for row in parsed:
        m = existing.get(row["pid"])
        if m:
            for c in mutable_cols:
                v = row.get(c)
                if v is not None:
                    setattr(m, c, v)
            updated += 1
        else:
            db.add(Medicament(**row, product_type=None))
            inserted += 1
    db.commit()
    return {
        "total_rows": len(parsed),
        "inserted":   inserted,
        "updated":    updated,
        "skipped":    len(errors),
        "errors":     errors[:10],
    }


# ─── JSON endpoints (Chrome extension) ───────────────────────────────────────

@router.post("/uploads/achat-json")
def upload_achat_json(body: JsonUploadBody, user: CurrentUserDep, db: DbDep) -> dict:
    pharmacy_id = require_pharmacy_owner(user, db, feature="import")
    if not body.rows:
        raise HTTPException(status_code=400, detail="Aucune ligne dans la requête.")
    return _insert_transactions(db, body.rows, pharmacy_id=pharmacy_id,
                                filename=body.filename, batch_id=body.batch_id, cfg=ACHAT_CFG)


@router.post("/uploads/vente-json")
def upload_vente_json(body: JsonUploadBody, user: CurrentUserDep, db: DbDep) -> dict:
    pharmacy_id = require_pharmacy_owner(user, db, feature="import")
    if not body.rows:
        raise HTTPException(status_code=400, detail="Aucune ligne dans la requête.")
    return _insert_transactions(db, body.rows, pharmacy_id=pharmacy_id,
                                filename=body.filename, batch_id=body.batch_id, cfg=VENTE_CFG)


# ─── PATCH batch status (cancel) ─────────────────────────────────────────────

@router.patch("/uploads/batches/{batch_id}")
def patch_batch_status(
    batch_id: Annotated[int, Path(ge=1)],
    body: PatchBatchBody,
    user: CurrentUserDep,
    db: DbDep,
) -> dict:
    """Update a batch's status. Two semantics:

    - `status="cancelled"`: TRUE UNDO. Deletes every Achat / Vente row that was
      inserted under this batch_id and resets the audit counters to 0. The
      ImportBatch row stays for auditing ("this user attempted then cancelled").
      Stock batches are exempt — they use UPSERT, so the prior snapshot is
      already gone and there's nothing to roll back.
    - `status="error"`: same audit-only flip + carry the error_message. Rows
      already inserted stay (the failing chunk was likely network-side, not data-side).
    """
    if body.status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail=f"Statut invalide. Attendu : {sorted(ALLOWED_STATUSES)}")

    batch = db.get(ImportBatch, batch_id)
    if batch is None:
        raise HTTPException(status_code=404, detail="Lot d'import introuvable.")
    if batch.pharmacy_id != user.pharmacy_id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès refusé à ce lot d'import.")

    deleted_rows = 0
    if body.status == "cancelled":
        if batch.file_type == "achat":
            deleted_rows = db.query(Achat).filter(Achat.import_batch_id == batch.id).delete()
        elif batch.file_type == "vente":
            deleted_rows = db.query(Vente).filter(Vente.import_batch_id == batch.id).delete()
        # stock: UPSERT replaced prior state, no undo possible — leave rows.
        if batch.file_type in ("achat", "vente"):
            batch.rows_inserted = 0
            batch.rows_skipped = 0

    batch.status = body.status
    if body.error_message is not None:
        batch.error_message = body.error_message
    db.commit()
    return {
        "id":             batch.id,
        "status":         batch.status,
        "error_message":  batch.error_message,
        "deleted_rows":   deleted_rows,
    }