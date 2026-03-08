from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Achat, Medicament, User
from routers.auth import get_current_user

router = APIRouter(prefix="/achat", tags=["achat"])


def _build_row(a: Achat) -> dict:
    return {
        "id": a.id,
        "delivery_date": a.delivery_date,
        "delivery_ref": a.delivery_ref,
        "supplier": a.supplier,
        "pid": a.medicament.pid if a.medicament else None,
        "product": a.medicament.product if a.medicament else None,
        "category": a.medicament.category if a.medicament else None,
        "tva": a.medicament.tva if a.medicament else None,
        "pph": a.medicament.pph if a.medicament else None,
        "ppv": a.medicament.ppv if a.medicament else None,
        "quantity": a.quantity,
        "unit_price": a.unit_price,
        "expiry_date": a.expiry_date,
        "total": a.total,
    }


def _base_query(
    db: Session,
    search: str,
    categories: List[str],
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    tva: Optional[List[str]] = None,
):
    q = (
        db.query(Achat)
        .options(joinedload(Achat.medicament))
        .join(Medicament, Achat.medicament_id == Medicament.id, isouter=True)
    )
    if search:
        term = f"%{search}%"
        q = q.filter(
            Medicament.product.ilike(term)
            | Medicament.pid.ilike(term)
            | Achat.supplier.ilike(term)
            | Achat.delivery_ref.ilike(term)
        )
    if categories:
        q = q.filter(Medicament.category.in_(categories))
    if tva:
        q = q.filter(Medicament.tva.in_(tva))
    if date_from:
        q = q.filter(Achat.delivery_date >= date_from)
    if date_to:
        q = q.filter(Achat.delivery_date <= date_to)
    return q


@router.get("/categories")
def get_achat_categories(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = (
        db.query(Medicament.category)
        .join(Achat, Achat.medicament_id == Medicament.id)
        .filter(Medicament.category.isnot(None))
        .distinct()
        .order_by(Medicament.category)
        .all()
    )
    return [r[0] for r in rows]


@router.get("/tva-rates")
def get_achat_tva_rates(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = (
        db.query(Medicament.tva)
        .join(Achat, Achat.medicament_id == Medicament.id)
        .filter(Medicament.tva.isnot(None))
        .distinct()
        .order_by(Medicament.tva)
        .all()
    )
    return [r[0] for r in rows]


@router.get("")
def list_achats(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=200),
    search: str = Query(""),
    category: List[str] = Query(default=[]),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    tva: List[str] = Query(default=[]),
    export: bool = Query(False),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = _base_query(db, search, category, date_from, date_to, tva)
    total = q.count()

    if export:
        rows = q.order_by(Achat.id.desc()).all()
        return {"data": [_build_row(a) for a in rows], "total": total}

    rows = q.order_by(Achat.id.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "data": [_build_row(a) for a in rows],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": (total + limit - 1) // limit,
        },
    }
