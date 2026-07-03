"""Imports history + soft-delete endpoints for the /imports page.

One logical import = one ImportBatch row. The table can list rows 1:1 with no
SQL grouping logic.

DELETE is a SOFT delete: the achat/vente rows are still removed (true undo
for transactional data), but the batch row stays with `deleted_at` +
`deleted_by_user_id` populated, so the /imports page can show it as history.
Stock batches: data not removed (UPSERT can't be undone — the snapshot already
overwrote prior values); only the batch row is marked deleted.

Per-role visibility + authz (mirrors the listing scope):
  - admin    → only batches they created (in practice ~empty)
  - owner    → batches they created OR created by an employee in their pharmacy
  - employee → only batches they created
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import BaseModel
from sqlalchemy import desc, func, or_
from sqlalchemy.orm import Query as OrmQuery, Session, aliased

from database import DbDep
from models import Achat, ImportBatch, User, Vente
from permissions import require_pharmacy_owner
from schemas.transactions import Pagination, paginate
from security import CurrentUserDep


router = APIRouter(tags=["data"])


class ImportRow(BaseModel):
    id:                    int
    file_type:             str
    filename:              str | None
    rows_inserted:         int
    rows_skipped:          int
    status:                str
    error_message:         str | None
    imported_at:           datetime
    created_by_full_name:  str | None
    created_by_email:      str | None
    deleted_at:            datetime | None
    deleted_by_full_name:  str | None
    deleted_by_email:      str | None


class ImportsListResponse(BaseModel):
    data:       list[ImportRow]
    pagination: Pagination


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
            db.query(User.id)
            .filter(User.pharmacy_id == user.pharmacy_id, User.role == "employee")
            .subquery()
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


def _serialize(batch: ImportBatch, creator: User | None, deletor: User | None) -> dict:
    return {
        "id":                   batch.id,
        "file_type":            batch.file_type,
        "filename":             batch.filename,
        "rows_inserted":        batch.rows_inserted,
        "rows_skipped":         batch.rows_skipped,
        "status":               batch.status,
        "error_message":        batch.error_message,
        "imported_at":          batch.imported_at,
        "created_by_full_name": creator.name  if creator else None,
        "created_by_email":     creator.email if creator else None,
        "deleted_at":           batch.deleted_at,
        "deleted_by_full_name": deletor.name  if deletor else None,
        "deleted_by_email":     deletor.email if deletor else None,
    }


@router.get("/data/imports", response_model=ImportsListResponse)
def list_imports(
    user: CurrentUserDep,
    db:   DbDep,
    page:  Annotated[int, Query(ge=1)]            = 1,
    limit: Annotated[int, Query(ge=1, le=200)]    = 50,
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
        "data":       [_serialize(b, c, d) for b, c, d in rows],
        "pagination": paginate(total, page, limit),
    }


@router.delete("/data/imports/{batch_id}")
def delete_import(
    batch_id: Annotated[int, Path(ge=1)],
    user:     CurrentUserDep,
    db:       DbDep,
) -> dict:
    """Soft-delete: removes the Achat/Vente rows belonging to this batch (stock
    skipped — UPSERT can't be undone), then marks the batch row with
    `deleted_at` + `deleted_by_user_id`. The row remains visible on /imports
    as history.

    Per-role authz mirrors the list scope (see `_visible_batches_query`):
    if you can see it, you can delete it. 404 on out-of-scope to avoid
    leaking existence."""
    if user.role != "admin":
        require_pharmacy_owner(user, db, feature="import")

    batch = _visible_batches_query(db, user).filter(ImportBatch.id == batch_id).first()
    if batch is None:
        raise HTTPException(status_code=404, detail="Lot d'import introuvable.")
    if batch.deleted_at is not None:
        raise HTTPException(status_code=409, detail="Ce lot a déjà été supprimé.")

    deleted_rows = 0
    if batch.file_type == "achat":
        deleted_rows = db.query(Achat).filter(Achat.import_batch_id == batch.id).delete()
    elif batch.file_type == "vente":
        deleted_rows = db.query(Vente).filter(Vente.import_batch_id == batch.id).delete()
    # stock: no row-level undo (UPSERT semantics)

    batch.deleted_at = datetime.now(timezone.utc)
    batch.deleted_by_user_id = user.id
    db.commit()
    return {"id": batch_id, "deleted_rows": deleted_rows, "file_type": batch.file_type}
