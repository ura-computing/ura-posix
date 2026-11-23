"""Imports: catalogue CSV (admin), achat / vente / stock JSON chunks from the
browser wizard, batch status, import history + delete."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, File, Path, Query, status, UploadFile
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import aliased, Query as OrmQuery, Session

from app.ingestion.csv_parse import (
    classify_product_type,
    existing_by_name,
    normalized_name,
    parse_catalog_csv,
)
from app.core.audit import AuditAction, log_action
from app.core.database import DbDep
from app.core.errors import ApiError, ErrorCode
from app.core.models import Achat, ImportBatch, Medicament, PharmacyStock, SobrusImportedYear, User, Vente
from app.core.permissions import AdminDep, is_staff, member, require_pharmacy_owner
from app.catalog.schemas import CatalogImportResponse
from app.ingestion.schemas import ImportsListResponse, JsonUploadBody, PatchBatchBody
from app.ingestion.service import (
    ACHAT_CFG,
    VENTE_CFG,
    analyze,
    end_batch,
    insert_stock,
    insert_transactions,
)
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


# ─── JSON endpoints (import page) ────────────────────────────────────────────


def _insert_rows(body: JsonUploadBody, pharmacy_id: int, user_id: int, db: DbDep, cfg) -> dict:
    """One chunk of an Achats / Ventes import: refused when empty or damaged, else inserted into its batch."""
    if not body.rows:
        raise ApiError(400, ErrorCode.EMPTY_BODY, EMPTY_BODY_DETAIL)
    _reject_corrupted(body.rows)
    return insert_transactions(
        db, body.rows, pharmacy_id=pharmacy_id, filename=body.filename, batch_id=body.batch_id, user_id=user_id, cfg=cfg
    )


@router.post("/uploads/achat-json")
def upload_achat_json(
    body: JsonUploadBody, pharmacy_id: Annotated[int, member("import", "achats")], user: CurrentUserDep, db: DbDep
) -> dict:
    return _insert_rows(body, pharmacy_id, user.id, db, ACHAT_CFG)


@router.post("/uploads/vente-json")
def upload_vente_json(
    body: JsonUploadBody, pharmacy_id: Annotated[int, member("import", "ventes")], user: CurrentUserDep, db: DbDep
) -> dict:
    return _insert_rows(body, pharmacy_id, user.id, db, VENTE_CFG)


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
    return insert_stock(
        db, body.rows, pharmacy_id=pharmacy_id, filename=body.filename, batch_id=body.batch_id, user_id=user.id
    )


# ─── PATCH batch status (cancel) ─────────────────────────────────────────────


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
    if batch.pharmacy_id != user.pharmacy_id and not is_staff(user):
        raise ApiError(403, ErrorCode.BATCH_FORBIDDEN, "Accès refusé à ce lot d'import.")

    deleted_rows = end_batch(db, batch, body.status, user, body.error_message)
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
    if is_staff(user):
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
    # Non-staff must have the `import` feature; staff bypasses.
    if not is_staff(user):
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
    if not is_staff(user):
        require_pharmacy_owner(user, db, feature="import")

    batch = _visible_batches_query(db, user).filter(ImportBatch.id == batch_id).first()
    if batch is None:
        raise ApiError(404, ErrorCode.BATCH_NOT_FOUND, "Lot d'import introuvable.")
    if batch.deleted_at is not None:
        raise ApiError(409, ErrorCode.BATCH_ALREADY_DELETED, "Ce lot a déjà été supprimé.")
    if batch.file_type == "closing":  # « Clôture de caisse »: read again from Sobrus at every run, nothing to undo
        raise ApiError(409, ErrorCode.BATCH_READ_ONLY, "La clôture de caisse est lue depuis Sobrus : rien à supprimer.")

    deleted_rows = 0
    if batch.file_type in ("achat", "vente"):
        # Its years are no longer complete: the Sobrus robot reads them again (« déjà importé » forgotten).
        day = Achat.delivery_date if batch.file_type == "achat" else Vente.date
        table = Achat if batch.file_type == "achat" else Vente
        years = {
            int(y)
            for (y,) in db.query(func.substr(day, 1, 4)).filter(table.import_batch_id == batch.id).distinct()
            if y and y.isdigit()
        }
        db.query(SobrusImportedYear).filter(
            SobrusImportedYear.pharmacy_id == batch.pharmacy_id,
            SobrusImportedYear.kind == batch.file_type,
            or_(SobrusImportedYear.year.in_(years), SobrusImportedYear.batch_id == batch.id),
        ).delete(synchronize_session=False)
    if batch.file_type == "achat":
        deleted_rows = db.query(Achat).filter(Achat.import_batch_id == batch.id).delete()
    elif batch.file_type == "vente":
        deleted_rows = db.query(Vente).filter(Vente.import_batch_id == batch.id).delete()
    else:
        deleted_rows = db.query(PharmacyStock).filter(PharmacyStock.import_batch_id == batch.id).delete()

    batch.deleted_at = datetime.now(timezone.utc)
    batch.deleted_by_user_id = user.id
    log_action(
        db,
        user,
        batch.pharmacy_id,
        AuditAction.IMPORT_DELETED,
        {"batch_id": batch.id, "type": batch.file_type, "file": batch.filename, "lines": deleted_rows},
    )
    db.commit()
    analyze(db, batch.file_type)
    return {"id": batch_id, "deleted_rows": deleted_rows, "file_type": batch.file_type}
