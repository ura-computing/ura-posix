"""
Unified achat + vente routers.
Registered twice in main.py: prefix="/achat" and prefix="/ventes".
"""
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, func as sa_func
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Achat, CategorySuffix, Medicament, User, Vente
from routers.auth import get_current_user
from utils.strings import strip_percentage

achat_router = APIRouter(prefix="/achat", tags=["achat"])
vente_router = APIRouter(prefix="/ventes", tags=["ventes"])


# ── Shared helpers ─────────────────────────────────────────────────────────────

def _get_suffixes_map(db: Session) -> Dict[str, tuple]:
    return {
        strip_percentage(s.category).lower(): (s.suffix, s.color)
        for s in db.query(CategorySuffix).all()
    }


def _build_categories(rows) -> List[str]:
    seen = set()
    result = []
    for (cat,) in rows:
        normalized = strip_percentage(cat)
        key = normalized.lower()
        if key not in seen:
            seen.add(key)
            result.append(normalized)
    result.sort()
    return result


# ── Achat ──────────────────────────────────────────────────────────────────────

def _build_achat_row(a: Achat, suffixes_map: Dict[str, tuple]) -> dict:
    category = a.medicament.category if a.medicament else None
    normalized = strip_percentage(category).lower() if category else ""
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


def _base_achat_query(
    db: Session,
    current_user: User,
    search: str = "",
    categories: List[str] = [],
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


@achat_router.get("/categories")
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
    return _build_categories(q.all())


@achat_router.get("/tva-rates")
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
    return [r[0] for r in q.distinct().order_by(Medicament.tva).all()]


@achat_router.get("/suggestions")
def get_achat_suggestions(
    q: str = Query(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not q or len(q) < 2:
        return {"products": [], "suppliers": [], "refs": []}
    term = f"{q}%"
    base = db.query(Achat).join(Medicament, Achat.medicament_id == Medicament.id, isouter=True)
    if current_user.pharmacy_id:
        base = base.filter(Achat.pharmacy_id == current_user.pharmacy_id)
    products = [r[0] for r in base.filter(Medicament.product.ilike(term)).with_entities(Medicament.product).distinct().limit(6).all() if r[0]]
    suppliers = [r[0] for r in base.filter(Achat.supplier.ilike(term)).with_entities(Achat.supplier).distinct().limit(6).all() if r[0]]
    refs = [r[0] for r in base.filter(Achat.delivery_ref.ilike(term)).with_entities(Achat.delivery_ref).distinct().limit(6).all() if r[0]]
    return {"products": products, "suppliers": suppliers, "refs": refs}


@achat_router.get("")
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
        raise HTTPException(status_code=403, detail="Accès aux achats refusé")
    suffixes_map = _get_suffixes_map(db)
    q = _base_achat_query(db, current_user, search, category, date_from, date_to, tva)
    total = q.count()
    if export:
        rows = q.order_by(Achat.id.desc()).all()
        return {"data": [_build_achat_row(a, suffixes_map) for a in rows], "total": total}
    rows = q.order_by(Achat.id.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "data": [_build_achat_row(a, suffixes_map) for a in rows],
        "pagination": {"page": page, "limit": limit, "total": total, "totalPages": (total + limit - 1) // limit},
    }


# ── Vente ──────────────────────────────────────────────────────────────────────

def _build_vente_row(v: Vente, suffixes_map: Dict[str, tuple], avg_pu_map: Dict[int, float] = {}) -> dict:
    category = v.medicament.category if v.medicament else None
    normalized = strip_percentage(category).lower() if category else ""
    suffix, color = suffixes_map.get(normalized, ("", None))
    ref = v.transaction_ref or ""
    med_id = v.medicament_id
    avg_pu = avg_pu_map.get(med_id) if med_id else None
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
        "avg_pu": round(avg_pu, 4) if avg_pu is not None else None,
    }


def _base_vente_query(
    db: Session,
    current_user: User,
    search: str = "",
    categories: List[str] = [],
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


@vente_router.get("/categories")
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
    return _build_categories(q.all())


@vente_router.get("/tva-rates")
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
    return [r[0] for r in q.distinct().order_by(Medicament.tva).all()]


@vente_router.get("/suggestions")
def get_vente_suggestions(
    q: str = Query(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not q or len(q) < 2:
        return {"products": [], "clients": [], "refs": []}
    term = f"{q}%"
    base = db.query(Vente).join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
    if current_user.pharmacy_id:
        base = base.filter(Vente.pharmacy_id == current_user.pharmacy_id)
    products = [r[0] for r in base.filter(Medicament.product.ilike(term)).with_entities(Medicament.product).distinct().limit(6).all() if r[0]]
    clients = [r[0] for r in base.filter(Vente.client.ilike(term)).with_entities(Vente.client).distinct().limit(6).all() if r[0]]
    refs = [r[0] for r in base.filter(Vente.transaction_ref.ilike(term)).with_entities(Vente.transaction_ref).distinct().limit(6).all() if r[0]]
    return {"products": products, "clients": clients, "refs": refs}


@vente_router.get("")
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
        raise HTTPException(status_code=403, detail="Accès aux ventes refusé")
    suffixes_map = _get_suffixes_map(db)
    q = _base_vente_query(db, current_user, search, category, date_from, date_to, tva)
    total = q.count()
    if export:
        rows = q.order_by(Vente.id.desc()).all()
        # Skip avg_pu on export to avoid OOM on large datasets
        data = [_build_vente_row(v, suffixes_map) for v in rows]
        return {"data": data, "total": total}

    rows = q.order_by(Vente.id.desc()).offset((page - 1) * limit).limit(limit).all()

    # Compute weighted avg purchase price only for current page (small batch)
    med_ids = list({v.medicament_id for v in rows if v.medicament_id})
    avg_pu_map: Dict[int, float] = {}
    if med_ids:
        pharmacy_id = current_user.pharmacy_id
        pu_q = (
            db.query(
                Achat.medicament_id,
                (sa_func.sum(Achat.unit_price * Achat.quantity) / sa_func.sum(Achat.quantity)).label("avg_pu"),
            )
            .filter(Achat.medicament_id.in_(med_ids), Achat.quantity > 0, Achat.unit_price.isnot(None))
        )
        if pharmacy_id:
            pu_q = pu_q.filter(Achat.pharmacy_id == pharmacy_id)
        pu_q = pu_q.group_by(Achat.medicament_id)
        avg_pu_map = {row.medicament_id: float(row.avg_pu) for row in pu_q.all() if row.avg_pu}

    data = [_build_vente_row(v, suffixes_map, avg_pu_map) for v in rows]
    return {
        "data": data,
        "pagination": {"page": page, "limit": limit, "total": total, "totalPages": (total + limit - 1) // limit},
    }
