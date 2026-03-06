from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Achat, Medicament, User, Vente
from routers.auth import get_current_user

router = APIRouter(prefix="/data", tags=["data"])


@router.delete("/achats")
def clear_achats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    deleted = db.query(Achat).delete()
    db.commit()
    return {"deleted": deleted}


@router.delete("/ventes")
def clear_ventes(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    deleted = db.query(Vente).delete()
    db.commit()
    return {"deleted": deleted}
