import re
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Achat, CategorySuffix, Medicament, User
from routers.auth import get_current_user

router = APIRouter(prefix="/achat", tags=["achat"])


def _build_row(a: Achat, suffixes_map: Dict[str, tuple]) -> dict:
    category = a.medicament.category if a.medicament else None
    normalized = re.sub(r'\s*\([\d.]+%\)', '', category).strip().lower() if category else ""
    suffix, color = suffixes_map.get(normalized, ("", None))
    ref = a.delivery_ref or ""
    return {
        "id": a.id,
        "delivery_date": a.delivery_date,
        "delivery_ref": a.delivery_ref,
        "delivery_ref_final": (ref + suffix) if ref else None,
        "delivery_ref_color": color if ref and suffix else None,
        "supplier": a.supplier,
        "pid": a.medicament.pid if a.medicament else None,
        "product": a.medicament.product if a.medicament else None,
        "category": category,
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
    current_user: User,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    tva: Optional[List[str]] = None,
):
    q = (
        db.query(Achat)
        .options(joinedload(Achat.medicament))
        .join(Medicament, Achat.medicament_id == Medicament.id, isouter=True)
    )
    if current_user.pharmacy_id:
        q = q.filter(Achat.pharmacy_id == current_user.pharmacy_id)
    if search:
        term = f"%{search}%"
        q = q.filter(
            Medicament.product.ilike(term)
            | Medicament.pid.ilike(term)
            | Achat.supplier.ilike(term)
            | Achat.delivery_ref.ilike(term)
        )
    if categories:
        q = q.filter(or_(*[Medicament.category.ilike(f"{cat}%") for cat in categories]))
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
    current_user: User = Depends(get_current_user),
):
    q = (
        db.query(Medicament.category)
        .join(Achat, Achat.medicament_id == Medicament.id)
        .filter(Medicament.category.isnot(None))
    )
    if current_user.pharmacy_id:
        q = q.filter(Achat.pharmacy_id == current_user.pharmacy_id)
    rows = q.all()
    seen = set()
    result = []
    for (cat,) in rows:
        normalized = re.sub(r'\s*\([\d.]+%\)', '', cat).strip()
        key = normalized.lower()
        if key not in seen:
            seen.add(key)
            result.append(normalized)
    result.sort()
    return result


@router.get("/tva-rates")
def get_achat_tva_rates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (
        db.query(Medicament.tva)
        .join(Achat, Achat.medicament_id == Medicament.id)
        .filter(Medicament.tva.isnot(None))
    )
    if current_user.pharmacy_id:
        q = q.filter(Achat.pharmacy_id == current_user.pharmacy_id)
    rows = q.distinct().order_by(Medicament.tva).all()
    return [r[0] for r in rows]


@router.get("/suggestions")
def get_achat_suggestions(
    q: str = Query(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not q or len(q) < 2:
        return {"products": [], "suppliers": [], "refs": []}
    term = f"{q}%"
    base_achat = db.query(Achat).join(Medicament, Achat.medicament_id == Medicament.id, isouter=True)
    if current_user.pharmacy_id:
        base_achat = base_achat.filter(Achat.pharmacy_id == current_user.pharmacy_id)
    products = [r[0] for r in base_achat.filter(Medicament.product.ilike(term)).with_entities(Medicament.product).distinct().limit(6).all() if r[0]]
    suppliers = [r[0] for r in base_achat.filter(Achat.supplier.ilike(term)).with_entities(Achat.supplier).distinct().limit(6).all() if r[0]]
    refs = [r[0] for r in base_achat.filter(Achat.delivery_ref.ilike(term)).with_entities(Achat.delivery_ref).distinct().limit(6).all() if r[0]]
    return {"products": products, "suppliers": suppliers, "refs": refs}


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
    current_user: User = Depends(get_current_user),
):
    if (current_user.permissions or {}).get("achat") is False:
        raise HTTPException(status_code=403, detail="Achat access denied")
    suffixes_map = {
        re.sub(r'\s*\([\d.]+%\)', '', s.category).strip().lower(): (s.suffix, s.color)
        for s in db.query(CategorySuffix).all()
    }

    q = _base_query(db, search, category, current_user, date_from, date_to, tva)
    total = q.count()

    if export:
        rows = q.order_by(Achat.id.desc()).all()
        return {"data": [_build_row(a, suffixes_map) for a in rows], "total": total}

    rows = q.order_by(Achat.id.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "data": [_build_row(a, suffixes_map) for a in rows],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": (total + limit - 1) // limit,
        },
    }
