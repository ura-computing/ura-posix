from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import Achat, Medicament, User, Vente
from routers.auth import get_current_user

router = APIRouter(prefix="/data", tags=["data"])


@router.delete("/achats")
def clear_achats(
    category: List[str] = Query(default=[]),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if category or date_from or date_to:
        q = (
            db.query(Achat.id)
            .join(Medicament, Achat.medicament_id == Medicament.id, isouter=True)
        )
        if category:
            q = q.filter(Medicament.category.in_(category))
        if date_from:
            q = q.filter(Achat.delivery_date >= date_from)
        if date_to:
            q = q.filter(Achat.delivery_date <= date_to)
        ids = [row[0] for row in q.all()]
        deleted = db.query(Achat).filter(Achat.id.in_(ids)).delete(synchronize_session=False)
    else:
        deleted = db.query(Achat).delete()
    db.commit()
    return {"deleted": deleted}


@router.delete("/ventes")
def clear_ventes(
    category: List[str] = Query(default=[]),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    if category or date_from or date_to:
        q = (
            db.query(Vente.id)
            .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
        )
        if category:
            q = q.filter(Medicament.category.in_(category))
        if date_from:
            q = q.filter(Vente.date >= date_from)
        if date_to:
            q = q.filter(Vente.date <= date_to)
        ids = [row[0] for row in q.all()]
        deleted = db.query(Vente).filter(Vente.id.in_(ids)).delete(synchronize_session=False)
    else:
        deleted = db.query(Vente).delete()
    db.commit()
    return {"deleted": deleted}
