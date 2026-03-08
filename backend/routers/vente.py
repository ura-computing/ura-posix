from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Medicament, User, Vente
from routers.auth import get_current_user

router = APIRouter(prefix="/ventes", tags=["ventes"])


def _build_row(v: Vente) -> dict:
    return {
        "id": v.id,
        "date": v.date,
        "transaction_ref": v.transaction_ref,
        "client": v.client,
        "pid": v.medicament.pid if v.medicament else None,
        "product": v.medicament.product if v.medicament else None,
        "category": v.medicament.category if v.medicament else None,
        "tva": v.medicament.tva if v.medicament else None,
        "ppv": v.medicament.ppv if v.medicament else None,
        "quantity": v.quantity,
        "discount": v.discount,
        "unit_price": v.unit_price,
        "total": v.total,
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
        db.query(Vente)
        .options(joinedload(Vente.medicament))
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
    )
    if search:
        term = f"%{search}%"
        q = q.filter(
            Medicament.product.ilike(term)
            | Medicament.pid.ilike(term)
            | Vente.client.ilike(term)
            | Vente.transaction_ref.ilike(term)
        )
    if categories:
        q = q.filter(Medicament.category.in_(categories))
    if tva:
        q = q.filter(Medicament.tva.in_(tva))
    if date_from:
        q = q.filter(Vente.date >= date_from)
    if date_to:
        q = q.filter(Vente.date <= date_to)
    return q


@router.get("/categories")
def get_vente_categories(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = (
        db.query(Medicament.category)
        .join(Vente, Vente.medicament_id == Medicament.id)
        .filter(Medicament.category.isnot(None))
        .distinct()
        .order_by(Medicament.category)
        .all()
    )
    return [r[0] for r in rows]


@router.get("/tva-rates")
def get_vente_tva_rates(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = (
        db.query(Medicament.tva)
        .join(Vente, Vente.medicament_id == Medicament.id)
        .filter(Medicament.tva.isnot(None))
        .distinct()
        .order_by(Medicament.tva)
        .all()
    )
    return [r[0] for r in rows]


@router.get("")
def list_ventes(
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
        rows = q.order_by(Vente.id.desc()).all()
        return {"data": [_build_row(v) for v in rows], "total": total}

    rows = q.order_by(Vente.id.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "data": [_build_row(v) for v in rows],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": (total + limit - 1) // limit,
        },
    }
