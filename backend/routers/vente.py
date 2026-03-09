import re
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import CategorySuffix, Medicament, User, Vente
from routers.auth import get_current_user

router = APIRouter(prefix="/ventes", tags=["ventes"])


def _build_row(v: Vente, suffixes_map: Dict[str, tuple]) -> dict:
    category = v.medicament.category if v.medicament else None
    normalized = re.sub(r'\s*\([\d.]+%\)', '', category).strip().lower() if category else ""
    suffix, color = suffixes_map.get(normalized, ("", None))
    ref = v.transaction_ref or ""
    return {
        "id": v.id,
        "date": v.date,
        "transaction_ref": v.transaction_ref,
        "transaction_ref_final": (ref + suffix) if ref else None,
        "transaction_ref_color": color if ref and suffix else None,
        "client": v.client,
        "pid": v.medicament.pid if v.medicament else None,
        "product": v.medicament.product if v.medicament else None,
        "category": category,
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
    current_user: User,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    tva: Optional[List[str]] = None,
):
    q = (
        db.query(Vente)
        .options(joinedload(Vente.medicament))
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
    )
    if current_user.pharmacy_id:
        q = q.filter(Vente.pharmacy_id == current_user.pharmacy_id)
    if search:
        term = f"%{search}%"
        q = q.filter(
            Medicament.product.ilike(term)
            | Medicament.pid.ilike(term)
            | Vente.client.ilike(term)
            | Vente.transaction_ref.ilike(term)
        )
    if categories:
        q = q.filter(or_(*[Medicament.category.ilike(f"{cat}%") for cat in categories]))
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
    current_user: User = Depends(get_current_user),
):
    q = (
        db.query(Medicament.category)
        .join(Vente, Vente.medicament_id == Medicament.id)
        .filter(Medicament.category.isnot(None))
    )
    if current_user.pharmacy_id:
        q = q.filter(Vente.pharmacy_id == current_user.pharmacy_id)
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
def get_vente_tva_rates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = (
        db.query(Medicament.tva)
        .join(Vente, Vente.medicament_id == Medicament.id)
        .filter(Medicament.tva.isnot(None))
    )
    if current_user.pharmacy_id:
        q = q.filter(Vente.pharmacy_id == current_user.pharmacy_id)
    rows = q.distinct().order_by(Medicament.tva).all()
    return [r[0] for r in rows]


@router.get("/suggestions")
def get_vente_suggestions(
    q: str = Query(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not q or len(q) < 2:
        return {"products": [], "clients": [], "refs": []}
    term = f"{q}%"
    base_vente = db.query(Vente).join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
    if current_user.pharmacy_id:
        base_vente = base_vente.filter(Vente.pharmacy_id == current_user.pharmacy_id)
    products = [r[0] for r in base_vente.filter(Medicament.product.ilike(term)).with_entities(Medicament.product).distinct().limit(6).all() if r[0]]
    clients = [r[0] for r in base_vente.filter(Vente.client.ilike(term)).with_entities(Vente.client).distinct().limit(6).all() if r[0]]
    refs = [r[0] for r in base_vente.filter(Vente.transaction_ref.ilike(term)).with_entities(Vente.transaction_ref).distinct().limit(6).all() if r[0]]
    return {"products": products, "clients": clients, "refs": refs}


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
    current_user: User = Depends(get_current_user),
):
    if (current_user.permissions or {}).get("ventes") is False:
        raise HTTPException(status_code=403, detail="Ventes access denied")
    suffixes_map = {
        re.sub(r'\s*\([\d.]+%\)', '', s.category).strip().lower(): (s.suffix, s.color)
        for s in db.query(CategorySuffix).all()
    }

    q = _base_query(db, search, category, current_user, date_from, date_to, tva)
    total = q.count()

    if export:
        rows = q.order_by(Vente.id.desc()).all()
        return {"data": [_build_row(v, suffixes_map) for v in rows], "total": total}

    rows = q.order_by(Vente.id.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "data": [_build_row(v, suffixes_map) for v in rows],
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total,
            "totalPages": (total + limit - 1) // limit,
        },
    }
