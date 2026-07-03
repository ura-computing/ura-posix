"""Admin catalog management — Medicament CRUD + filtered list + distinct
categories. All endpoints require role=admin (gated via `require_admin`).

CSV import lives on `POST /v1/uploads/catalog` in `routers/uploads.py` so it
sits next to achat / vente / stock uploads."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query, status
from sqlalchemy import asc, desc, func

from csv_parse import strip_accents
from database import DbDep
from models import Medicament
from permissions import require_admin
from schemas.catalog import (
    CatalogListResponse,
    MedicamentCreate,
    MedicamentRow,
    MedicamentUpdate,
)
from schemas.transactions import paginate
from search import product_search_clauses, tokenize_search
from security import CurrentUserDep


router = APIRouter(tags=["admin-catalog"])


MedIdPath = Annotated[int, Path(ge=1, description="Medicament id")]


_SORTABLE = {
    "product":     Medicament.product,
    "category":    Medicament.category,
    "ppv":         Medicament.ppv,
    "pph":         Medicament.pph,
    "laboratoire": Medicament.laboratoire,
    "tva":         Medicament.tva,
}


def _row(m: Medicament) -> dict:
    return {
        "id":           m.id,
        "pid":          m.pid,
        "product":      m.product,
        "tva":          m.tva,
        "pph":          m.pph,
        "ppv":          m.ppv,
        "category":     m.category,
        "barcode1":     m.barcode1,
        "barcode2":     m.barcode2,
        "laboratoire":  m.laboratoire,
        "product_type": m.product_type,
        "created_at":   m.created_at.isoformat() if m.created_at else "",
        "updated_at":   m.updated_at.isoformat() if m.updated_at else None,
    }


@router.get("/admin/catalog/unclassified-count")
def unclassified_count(user: CurrentUserDep, db: DbDep) -> dict:
    """How many Medicaments still have product_type IS NULL — drives the
    admin sidebar badge + owner alert."""
    require_admin(user)
    n = db.query(func.count(Medicament.id)).filter(Medicament.product_type.is_(None)).scalar()
    return {"count": int(n or 0)}


@router.get("/admin/catalog/categories", response_model=list[str])
def list_catalog_categories(user: CurrentUserDep, db: DbDep) -> list[str]:
    """Distinct non-null categories (alphabetical). Powers the multi-select."""
    require_admin(user)
    rows = (
        db.query(Medicament.category)
        .filter(Medicament.category.isnot(None))
        .distinct()
        .order_by(Medicament.category.asc())
        .all()
    )
    return [r.category for r in rows if r.category]


@router.get("/admin/catalog", response_model=CatalogListResponse)
def list_catalog(
    user: CurrentUserDep,
    db:   DbDep,
    search:     Annotated[str | None, Query()]   = None,
    category:   Annotated[list[str], Query()]    = [],
    type:       Annotated[str | None, Query()]   = None,    # pharmacie | parapharmacie
    sort_by:    Annotated[str, Query()]          = "product",
    sort_order: Annotated[str, Query()]          = "asc",
    page:       Annotated[int, Query(ge=1)]      = 1,
    limit:      Annotated[int, Query(ge=1, le=500)] = 25,
) -> dict:
    """Paginated + filtered + sortable catalog list."""
    require_admin(user)
    q = db.query(Medicament)

    if search and search.strip():
        for clause in product_search_clauses(tokenize_search(search)):
            q = q.filter(clause)

    if category:
        q = q.filter(Medicament.category.in_(category))

    if type == "unclassified":
        q = q.filter(Medicament.product_type.is_(None))
    elif type in ("pharmacie", "parapharmacie"):
        q = q.filter(Medicament.product_type == type)

    col = _SORTABLE.get(sort_by, Medicament.product)
    q = q.order_by(desc(col) if sort_order == "desc" else asc(col))

    total = q.count()
    rows  = q.offset((page - 1) * limit).limit(limit).all()
    return {
        "data":       [_row(m) for m in rows],
        "pagination": paginate(total, page, limit),
    }


@router.post("/admin/catalog", response_model=MedicamentRow, status_code=201)
def create_medicament(
    body: MedicamentCreate, user: CurrentUserDep, db: DbDep,
) -> dict:
    """Create a new Medicament. PID is derived from `barcode1` (if present) else
    a normalized product name. Returns 409 if PID already exists."""
    require_admin(user)
    bc1 = (body.barcode1 or "").strip()
    pid = bc1 if bc1 else strip_accents(body.product.strip().lower())
    if not pid:
        raise HTTPException(status_code=400, detail="Nom de produit requis")
    if db.query(Medicament).filter(Medicament.pid == pid).first():
        raise HTTPException(status_code=409, detail=f"Un médicament avec ce code/nom existe déjà (pid={pid})")
    m = Medicament(
        pid=pid, product=body.product.strip(),
        tva=body.tva, pph=body.pph, ppv=body.ppv,
        category=body.category, barcode1=body.barcode1, barcode2=body.barcode2,
        laboratoire=body.laboratoire, product_type=body.product_type,
    )
    db.add(m); db.commit(); db.refresh(m)
    return _row(m)


@router.put("/admin/catalog/{med_id}", response_model=MedicamentRow)
def update_medicament(
    med_id: MedIdPath, body: MedicamentUpdate,
    user: CurrentUserDep, db: DbDep,
) -> dict:
    """PATCH-like update: only the keys present in `body` overwrite."""
    require_admin(user)
    m = db.query(Medicament).filter(Medicament.id == med_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Médicament introuvable")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(m, k, v)
    db.commit(); db.refresh(m)
    return _row(m)


@router.delete("/admin/catalog/{med_id}", status_code=204)
def delete_medicament(med_id: MedIdPath, user: CurrentUserDep, db: DbDep) -> None:
    """Hard-delete. FK cascade on Achat/Vente takes care of historical refs."""
    require_admin(user)
    m = db.query(Medicament).filter(Medicament.id == med_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Médicament introuvable")
    db.delete(m); db.commit()
