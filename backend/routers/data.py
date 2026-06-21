"""Imports history + cascade-delete endpoints for the /parametres > Imports tab.

Thanks to the batch_id threading fix in Page 2 (chunks 2..N reuse the batch_id
from chunk 1), one logical import = one ImportBatch row. The tab can list rows
1:1 with no SQL grouping logic.

DELETE cascades to the underlying Achat/Vente rows when applicable. Stock
batches: the snapshot UPSERT already overwrote prior values, so there's
nothing to undo at the row level — we only drop the audit row.
"""
from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query
from pydantic import BaseModel
from sqlalchemy import desc, func

from database import DbDep
from models import Achat, ImportBatch, Vente
from permissions import require_pharmacy_owner
from schemas.transactions import Pagination, paginate
from security import CurrentUserDep


router = APIRouter(tags=["data"])


class ImportRow(BaseModel):
    id:             int
    file_type:      str
    filename:       str | None
    rows_inserted:  int
    rows_skipped:   int
    status:         str
    error_message:  str | None
    imported_at:    datetime


class ImportsListResponse(BaseModel):
    data:       list[ImportRow]
    pagination: Pagination


@router.get("/data/imports", response_model=ImportsListResponse)
def list_imports(
    user: CurrentUserDep,
    db:   DbDep,
    page:  Annotated[int, Query(ge=1)]            = 1,
    limit: Annotated[int, Query(ge=1, le=200)]    = 50,
) -> dict:
    pharmacy_id = require_pharmacy_owner(user, db)
    q = db.query(ImportBatch).filter(ImportBatch.pharmacy_id == pharmacy_id)
    total = q.with_entities(func.count(ImportBatch.id)).scalar() or 0
    rows = (
        q.order_by(desc(ImportBatch.imported_at))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return {
        "data": [ImportRow.model_validate(r, from_attributes=True) for r in rows],
        "pagination": paginate(total, page, limit),
    }


@router.delete("/data/imports/{batch_id}")
def delete_import(
    batch_id: Annotated[int, Path(ge=1)],
    user:     CurrentUserDep,
    db:       DbDep,
) -> dict:
    """Cascade-delete: removes the Achat/Vente rows belonging to this batch,
    then removes the ImportBatch audit row itself. Stock batches skip the row
    delete (UPSERT already overwrote prior snapshot values)."""
    pharmacy_id = require_pharmacy_owner(user, db)
    batch = db.get(ImportBatch, batch_id)
    if batch is None or batch.pharmacy_id != pharmacy_id:
        raise HTTPException(status_code=404, detail="Lot d'import introuvable.")

    deleted_rows = 0
    if batch.file_type == "achat":
        deleted_rows = db.query(Achat).filter(Achat.import_batch_id == batch.id).delete()
    elif batch.file_type == "vente":
        deleted_rows = db.query(Vente).filter(Vente.import_batch_id == batch.id).delete()

    db.delete(batch)
    db.commit()
    return {"id": batch_id, "deleted_rows": deleted_rows, "file_type": batch.file_type}