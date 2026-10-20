"""« Produits » endpoints (owner + employee, feature `produits`). SQL in product_queries.

GET /v1/products    The pharmacy's products: search, Mixte / Pharmacie / Parapharmacie,
                    sort, page; export=true → every matching row (Excel).
GET /v1/products/lookup?code=   « Scanner / Rechercher un code barre »: the product with that exact
                    PID / barcode → {id}; none in the pharmacy → 404 `productNotFound`.
GET /v1/products/{med_id}   One product's sheet (Général + Codes tabs). Not one of the
                    pharmacy's products → 404 `productNotFound` (never says it exists elsewhere).
GET /v1/products/{med_id}/stats   Statistiques tab: date_from → date_to (default: the last
                    30 days) vs the days just before, the last 12 months (or `months_year`: its
                    January → December), suppliers (same 404).
GET /v1/products/{med_id}/movements   « Traçabilité » tab: purchase + sale lines with their details
                    (hour, lot expiry, import), period, type, search (document / supplier / client),
                    sort (date | kind), page (same 404).
PUT /v1/products/{med_id}   Owner only: « Modifier » → « Enregistrer » (his pharmacy only, shown in
                    « Produits » only); a field sent as null = back to the imported value.
GET / POST /v1/products/{med_id}/notes, DELETE …/notes/{note_id}   « Observations »: everyone
                    with Produits adds; its author or the owner deletes (403 `noteNotYours`).
GET /v1/products/{med_id}/history   Its « Historique » tab: its edits, observations and the
                    imports that brought its lines, newest first, page (same 404).
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Path, Query, status

from app.core.database import DbDep
from app.core.errors import ApiError, ErrorCode
from app.core.permissions import member
from app.core.security import CurrentUserDep
from app.core.models import ProductNote
from app.core.utils import today as pharmacy_today
from app.history.history_queries import product_history
from app.history.schemas import ProductHistoryResponse
from app.products.notes_queries import add_note, delete_note, list_notes
from app.products.product_queries import (
    linked_product,
    list_products,
    product_lookup,
    product_movements,
    product_sheet,
    product_stats,
    save_product_edits,
)
from app.products.schemas import (
    ProductEditIn,
    ProductLookup,
    ProductNoteIn,
    ProductNoteOut,
    ProductMovementsResponse,
    ProductSheet,
    ProductStats,
    ProductsListResponse,
)


router = APIRouter(tags=["products"])

PageQ = Annotated[int, Query(ge=1)]
LimitQ = Annotated[int, Query(ge=1, le=200)]
SearchQ = Annotated[str | None, Query(description="Product name / PID / barcode / laboratoire")]
CategoryTypeQ = Annotated[str, Query(description="all | pharmacie | parapharmacie")]
SortByQ = Annotated[str | None, Query(description="product | laboratoire | category | current_stock | …")]
SortOrderQ = Annotated[str, Query(description="asc | desc")]
ExportQ = Annotated[bool, Query(description="If true, return every matching row (skip pagination)")]
DateQ = Annotated[str | None, Query(description="ISO date YYYY-MM-DD, inclusive")]
KindQ = Annotated[str, Query(description="all | achat | vente")]
OrderQ = Annotated[str, Query(description="date (newest first) | kind (purchases, then sales)")]
PeriodQ = Annotated[date | None, Query(description="ISO date YYYY-MM-DD, inclusive")]
MonthsYearQ = Annotated[
    int | None, Query(ge=2000, le=2100, description="charts + « Détail mensuel »: that year (default: last 12 months)")
]


@router.get("/products", response_model=ProductsListResponse)
def get_products(
    pharmacy_id: Annotated[int, member("produits")],
    db: DbDep,
    page: PageQ = 1,
    limit: LimitQ = 25,
    search: SearchQ = None,
    category_type: CategoryTypeQ = "all",
    sort_by: SortByQ = None,
    sort_order: SortOrderQ = "asc",
    export: ExportQ = False,
) -> dict:
    return list_products(
        db,
        pharmacy_id,
        search=search,
        category_type=category_type,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        limit=limit,
        export=export,
    )


# Before /products/{med_id}: « lookup » is not a product id.
@router.get("/products/lookup", response_model=ProductLookup)
def get_product_lookup(
    pharmacy_id: Annotated[int, member("produits")],
    db: DbDep,
    code: Annotated[str, Query(min_length=1, max_length=100, description="PID or barcode, exact")],
) -> dict:
    med_id = product_lookup(db, pharmacy_id, code)
    if med_id is None:
        raise ApiError(404, ErrorCode.PRODUCT_NOT_FOUND, "Aucun produit avec ce code dans votre pharmacie.")
    return {"id": med_id}


@router.get("/products/{med_id}", response_model=ProductSheet)
def get_product(med_id: Annotated[int, Path(ge=1)], pharmacy_id: Annotated[int, member("produits")], db: DbDep) -> dict:
    sheet = product_sheet(db, pharmacy_id, med_id)
    if sheet is None:
        raise ApiError(404, ErrorCode.PRODUCT_NOT_FOUND, "Ce produit n'est pas dans votre pharmacie.")
    return sheet


@router.get("/products/{med_id}/stats", response_model=ProductStats)
def get_product_stats(
    med_id: Annotated[int, Path(ge=1)],
    pharmacy_id: Annotated[int, member("produits")],
    db: DbDep,
    date_from: PeriodQ = None,
    date_to: PeriodQ = None,
    months_year: MonthsYearQ = None,
) -> dict:
    date_to = date_to or pharmacy_today()
    date_from = date_from or date_to - timedelta(days=29)
    date_from, date_to = min(date_from, date_to), max(date_from, date_to)
    stats = product_stats(db, pharmacy_id, med_id, date_from, date_to, months_year)
    if stats is None:
        raise ApiError(404, ErrorCode.PRODUCT_NOT_FOUND, "Ce produit n'est pas dans votre pharmacie.")
    return stats


@router.get("/products/{med_id}/movements", response_model=ProductMovementsResponse)
def get_product_movements(
    med_id: Annotated[int, Path(ge=1)],
    pharmacy_id: Annotated[int, member("produits")],
    db: DbDep,
    date_from: DateQ = None,
    date_to: DateQ = None,
    kind: KindQ = "all",
    search: SearchQ = None,
    order: OrderQ = "date",
    page: PageQ = 1,
    limit: LimitQ = 10,
) -> dict:
    moves = product_movements(
        db,
        pharmacy_id,
        med_id,
        date_from=date_from,
        date_to=date_to,
        kind=kind,
        search=search,
        order=order,
        page=page,
        limit=limit,
    )
    if moves is None:
        raise ApiError(404, ErrorCode.PRODUCT_NOT_FOUND, "Ce produit n'est pas dans votre pharmacie.")
    return moves


@router.put("/products/{med_id}", response_model=ProductSheet)
def put_product(
    med_id: Annotated[int, Path(ge=1)],
    body: ProductEditIn,
    pharmacy_id: Annotated[int, member("produits")],
    user: CurrentUserDep,
    db: DbDep,
) -> dict:
    if user.role != "owner":
        raise ApiError(status.HTTP_403_FORBIDDEN, ErrorCode.OWNER_ONLY, "Réservé aux propriétaires.")
    changes = {f: getattr(body, f) for f in body.model_fields_set}
    sheet = save_product_edits(db, pharmacy_id, med_id, user, changes)
    if sheet is None:
        raise ApiError(404, ErrorCode.PRODUCT_NOT_FOUND, "Ce produit n'est pas dans votre pharmacie.")
    return sheet


# ─── « Observations » ────────────────────────────────────────────────────────

NOT_YOURS = "Ce produit n'est pas dans votre pharmacie."


def _product_or_404(db, pharmacy_id: int, med_id: int):
    med = linked_product(db, pharmacy_id, med_id)
    if med is None:
        raise ApiError(404, ErrorCode.PRODUCT_NOT_FOUND, NOT_YOURS)
    return med


@router.get("/products/{med_id}/notes", response_model=list[ProductNoteOut])
def get_product_notes(
    med_id: Annotated[int, Path(ge=1)],
    pharmacy_id: Annotated[int, member("produits")],
    user: CurrentUserDep,
    db: DbDep,
) -> list[dict]:
    _product_or_404(db, pharmacy_id, med_id)
    return list_notes(db, pharmacy_id, med_id, user)


@router.post("/products/{med_id}/notes", response_model=ProductNoteOut, status_code=status.HTTP_201_CREATED)
def post_product_note(
    med_id: Annotated[int, Path(ge=1)],
    body: ProductNoteIn,
    pharmacy_id: Annotated[int, member("produits")],
    user: CurrentUserDep,
    db: DbDep,
) -> dict:
    """Anyone with Produits (owner, employee) adds an observation."""
    med = _product_or_404(db, pharmacy_id, med_id)
    return add_note(db, pharmacy_id, med, user, body.text)


@router.delete("/products/{med_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product_note(
    med_id: Annotated[int, Path(ge=1)],
    note_id: Annotated[int, Path(ge=1)],
    pharmacy_id: Annotated[int, member("produits")],
    user: CurrentUserDep,
    db: DbDep,
) -> None:
    """Its author or the owner."""
    med = _product_or_404(db, pharmacy_id, med_id)
    note = db.get(ProductNote, note_id)
    if note is None or note.pharmacy_id != pharmacy_id or note.medicament_id != med_id:
        raise ApiError(404, ErrorCode.NOTE_NOT_FOUND, "Observation introuvable.")
    if note.user_id != user.id and user.role != "owner":
        raise ApiError(
            403, ErrorCode.NOTE_NOT_YOURS, "Seul son auteur ou le propriétaire peut supprimer cette observation."
        )
    delete_note(db, pharmacy_id, med, note, user)


@router.get("/products/{med_id}/history", response_model=ProductHistoryResponse)
def get_product_history(
    med_id: Annotated[int, Path(ge=1)],
    pharmacy_id: Annotated[int, member("produits")],
    db: DbDep,
    page: PageQ = 1,
    limit: Annotated[int, Query(ge=1, le=200)] = 20,
) -> dict:
    _product_or_404(db, pharmacy_id, med_id)
    return product_history(db, pharmacy_id, med_id, page=page, limit=limit)
