from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import Achat, ImportBatch, Medicament, User, Vente
from routers.auth import get_current_user

router = APIRouter(prefix="/data", tags=["data"])


@router.delete("/achats")
def clear_achats(
    category: List[str] = Query(default=[]),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (
        db.query(Achat.id)
        .join(Medicament, Achat.medicament_id == Medicament.id, isouter=True)
    )
    if current_user.pharmacy_id:
        q = q.filter(Achat.pharmacy_id == current_user.pharmacy_id)
    if category:
        q = q.filter(Medicament.category.in_(category))
    if date_from:
        q = q.filter(Achat.delivery_date >= date_from)
    if date_to:
        q = q.filter(Achat.delivery_date <= date_to)
    ids = [row[0] for row in q.all()]
    deleted = db.query(Achat).filter(Achat.id.in_(ids)).delete(synchronize_session=False)
    db.commit()
    return {"deleted": deleted}


@router.delete("/ventes")
def clear_ventes(
    category: List[str] = Query(default=[]),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (
        db.query(Vente.id)
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
    )
    if current_user.pharmacy_id:
        q = q.filter(Vente.pharmacy_id == current_user.pharmacy_id)
    if category:
        q = q.filter(Medicament.category.in_(category))
    if date_from:
        q = q.filter(Vente.date >= date_from)
    if date_to:
        q = q.filter(Vente.date <= date_to)
    ids = [row[0] for row in q.all()]
    deleted = db.query(Vente).filter(Vente.id.in_(ids)).delete(synchronize_session=False)
    db.commit()
    return {"deleted": deleted}


@router.get("/imports")
def list_imports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List import batches for the current pharmacy, newest first."""
    q = db.query(ImportBatch).order_by(ImportBatch.imported_at.desc())
    if current_user.pharmacy_id:
        q = q.filter(ImportBatch.pharmacy_id == current_user.pharmacy_id)
    batches = q.all()
    return [
        {
            "id": b.id,
            "file_type": b.file_type,
            "filename": b.filename,
            "rows_inserted": b.rows_inserted,
            "rows_skipped": b.rows_skipped,
            "imported_at": b.imported_at.isoformat() if b.imported_at else None,
        }
        for b in batches
    ]


@router.delete("/imports/{batch_id}")
def delete_import_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete all rows from a specific import batch."""
    batch = db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Import introuvable")
    if current_user.pharmacy_id and batch.pharmacy_id != current_user.pharmacy_id:
        raise HTTPException(status_code=403, detail="Accès refusé")

    if batch.file_type == "achat":
        deleted = db.query(Achat).filter(Achat.import_batch_id == batch_id).delete(synchronize_session=False)
    elif batch.file_type == "vente":
        deleted = db.query(Vente).filter(Vente.import_batch_id == batch_id).delete(synchronize_session=False)
    else:
        # Stock imports are snapshots — `PharmacyStock` doesn't link back to
        # a batch, so deleting the history row alone is the safe behavior.
        # The current snapshot rows are preserved (they remain the truth).
        deleted = 0

    db.delete(batch)
    db.commit()
    return {"deleted": deleted}
