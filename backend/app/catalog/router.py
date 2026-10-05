"""Catalogue (admin only): medicaments CRUD + filtered list, category suffixes.
The catalogue CSV import is POST /uploads/catalog (routers/imports.py)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path, Query
from sqlalchemy import asc, desc, func

from app.ingestion.csv_parse import strip_accents, suffix_key
from app.core.database import DbDep
from app.core.errors import ApiError, ErrorCode
from app.core.models import (
    Achat,
    CategorySuffix,
    Medicament,
    PharmacyMedicamentStatus,
    PharmacyStock,
    Vente,
)
from app.core.permissions import admin_only
from app.catalog.schemas import (
    CatalogListResponse,
    CategorySuffixIn,
    CategorySuffixOut,
    MedicamentCreate,
    MedicamentRow,
    MedicamentUpdate,
)
from app.ledger.schemas import paginate
from app.core.search import product_search_clauses, tokenize_search


router = APIRouter(tags=["catalog"], dependencies=[admin_only])


# ═══ Medicaments ═════════════════════════════════════════════════════════════
# Admin catalog management — Medicament CRUD + filtered list + distinct
# categories. All endpoints require role=admin (`dependencies=[admin_only]`).
#
# CSV import lives on `POST /v1/uploads/catalog` in `routers/imports.py` so it
# sits next to achat / vente / stock uploads.

MedIdPath = Annotated[int, Path(ge=1, description="Medicament id")]


_SORTABLE = {
    "product": Medicament.product,
    "category": Medicament.category,
    "ppv": Medicament.ppv,
    "pph": Medicament.pph,
    "laboratoire": Medicament.laboratoire,
    "tva": Medicament.tva,
}


def _row(m: Medicament) -> dict:
    return {
        "id": m.id,
        "pid": m.pid,
        "product": m.product,
        "tva": m.tva,
        "pph": m.pph,
        "ppv": m.ppv,
        "category": m.category,
        "barcode1": m.barcode1,
        "barcode2": m.barcode2,
        "laboratoire": m.laboratoire,
        "product_type": m.product_type,
        "created_at": m.created_at.isoformat() if m.created_at else "",
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    }


@router.get("/admin/catalog/unclassified-count")
def unclassified_count(db: DbDep) -> dict:
    """How many Medicaments still have product_type IS NULL — drives the
    admin sidebar badge + owner alert."""
    n = db.query(func.count(Medicament.id)).filter(Medicament.product_type.is_(None)).scalar()
    return {"count": int(n or 0)}


@router.get("/admin/catalog/categories", response_model=list[str])
def list_catalog_categories(db: DbDep) -> list[str]:
    """Distinct non-null categories (alphabetical). Powers the multi-select."""
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
    db: DbDep,
    search: Annotated[str | None, Query()] = None,
    category: Annotated[list[str], Query()] = [],
    type: Annotated[str | None, Query()] = None,  # pharmacie | parapharmacie
    sort_by: Annotated[str, Query()] = "product",
    sort_order: Annotated[str, Query()] = "asc",
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=500)] = 25,
) -> dict:
    """Paginated + filtered + sortable catalog list."""
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
    rows = q.offset((page - 1) * limit).limit(limit).all()
    return {
        "data": [_row(m) for m in rows],
        "pagination": paginate(total, page, limit),
    }


@router.post("/admin/catalog", response_model=MedicamentRow, status_code=201)
def create_medicament(
    body: MedicamentCreate,
    db: DbDep,
) -> dict:
    """Create a new Medicament. PID is derived from `barcode1` (if present) else
    a normalized product name. Returns 409 if PID already exists."""
    bc1 = (body.barcode1 or "").strip()
    pid = bc1 if bc1 else strip_accents(body.product.strip().lower())
    if not pid:
        raise ApiError(400, ErrorCode.PRODUCT_NAME_REQUIRED, "Nom de produit requis")
    if db.query(Medicament).filter(Medicament.pid == pid).first():
        raise ApiError(
            409,
            ErrorCode.MEDICAMENT_EXISTS,
            f"Un médicament avec ce code/nom existe déjà (pid={pid})",
            pid=pid,
        )
    m = Medicament(
        pid=pid,
        product=body.product.strip(),
        tva=body.tva,
        pph=body.pph,
        ppv=body.ppv,
        category=body.category,
        barcode1=body.barcode1,
        barcode2=body.barcode2,
        laboratoire=body.laboratoire,
        product_type=body.product_type,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return _row(m)


@router.put("/admin/catalog/{med_id}", response_model=MedicamentRow)
def update_medicament(
    med_id: MedIdPath,
    body: MedicamentUpdate,
    db: DbDep,
) -> dict:
    """PATCH-like update: only the keys present in `body` overwrite."""
    m = db.query(Medicament).filter(Medicament.id == med_id).first()
    if not m:
        raise ApiError(404, ErrorCode.MEDICAMENT_NOT_FOUND, "Médicament introuvable")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(m, k, v)
    db.commit()
    db.refresh(m)
    return _row(m)


@router.delete("/admin/catalog/{med_id}", status_code=204)
def delete_medicament(med_id: MedIdPath, db: DbDep) -> None:
    """Hard-delete a medicament nobody uses. One referenced by sales, purchases,
    stock or a special-product flag → 409 (the foreign keys have no cascade, and
    deleting it would erase pharmacy history)."""
    m = db.query(Medicament).filter(Medicament.id == med_id).first()
    if not m:
        raise ApiError(404, ErrorCode.MEDICAMENT_NOT_FOUND, "Médicament introuvable")
    for model in (Vente, Achat, PharmacyStock, PharmacyMedicamentStatus):
        if db.query(model.id).filter(model.medicament_id == med_id).first() is not None:
            raise ApiError(
                409,
                ErrorCode.MEDICAMENT_IN_USE,
                "Ce médicament est utilisé dans des ventes, achats ou stocks : suppression impossible.",
            )
    db.delete(m)
    db.commit()


# ═══ Category suffixes ═══════════════════════════════════════════════════════
# Admin-only CRUD for category_suffixes.
#
# CategorySuffix is a GLOBAL table (one row per category across all pharmacies)
# so it's edited by admins, not pharmacy owners. The Ventes serializer reads
# this table per request and embeds the (suffix, color) in each vente row so
# the frontend doesn't need its own /category-suffixes lookup.
#
# Frontend admin UI lives on /parametres > Catégories (a future tab). For now
# admins manage via CLI or direct HTTP.
#
# Allowed `color` values mirror the frontend's SuffixBadge palette.


@router.get("/category-suffixes", response_model=list[CategorySuffixOut])
def list_category_suffixes(db: DbDep) -> list[CategorySuffix]:
    return db.query(CategorySuffix).order_by(CategorySuffix.category).all()


def _suffix_taken(db, category: str, except_id: int | None = None) -> bool:
    """Same category ignoring accents / case / « (x%) » (the /ventes lookup key)."""
    key = suffix_key(category)
    return any(suffix_key(r.category) == key for r in db.query(CategorySuffix).all() if r.id != except_id)


@router.post("/category-suffixes", response_model=CategorySuffixOut, status_code=201)
def create_category_suffix(body: CategorySuffixIn, db: DbDep) -> CategorySuffix:
    if _suffix_taken(db, body.category):
        raise ApiError(
            409,
            ErrorCode.SUFFIX_EXISTS,
            f"La catégorie « {body.category} » a déjà un suffixe.",
            category=body.category,
        )
    row = CategorySuffix(category=body.category, suffix=body.suffix, color=body.color)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/category-suffixes/{suffix_id}", response_model=CategorySuffixOut)
def update_category_suffix(
    suffix_id: Annotated[int, Path(ge=1)],
    body: CategorySuffixIn,
    db: DbDep,
) -> CategorySuffix:
    row = db.get(CategorySuffix, suffix_id)
    if row is None:
        raise ApiError(404, ErrorCode.SUFFIX_NOT_FOUND, "Suffixe introuvable.")
    if _suffix_taken(db, body.category, except_id=row.id):
        raise ApiError(
            409,
            ErrorCode.SUFFIX_EXISTS,
            f"La catégorie « {body.category} » a déjà un suffixe.",
            category=body.category,
        )
    row.category = body.category
    row.suffix = body.suffix
    row.color = body.color
    db.commit()
    db.refresh(row)
    return row


@router.delete("/category-suffixes/{suffix_id}", status_code=204)
def delete_category_suffix(
    suffix_id: Annotated[int, Path(ge=1)],
    db: DbDep,
) -> None:
    row = db.get(CategorySuffix, suffix_id)
    if row is None:
        raise ApiError(404, ErrorCode.SUFFIX_NOT_FOUND, "Suffixe introuvable.")
    db.delete(row)
    db.commit()
