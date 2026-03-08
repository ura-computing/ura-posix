from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Pharmacy
from schemas import PharmacyPublic

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/pharmacies", response_model=List[PharmacyPublic])
def list_pharmacies_public(db: Session = Depends(get_db)):
    """Public endpoint — returns pharmacy names for employee registration dropdown."""
    return db.query(Pharmacy).order_by(Pharmacy.name).all()
