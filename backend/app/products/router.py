"""« Produits » endpoints (owner + employee, feature `produits`). SQL in product_queries.

GET /v1/products    The pharmacy's products: search, Mixte / Pharmacie / Parapharmacie,
                    sort, page; export=true → every matching row (Excel).
GET /v1/products/lookup?code=   « Scanner / Rechercher un code barre »: the product with that exact
                    PID / barcode → {id}; none in the pharmacy → 404 `productNotFound`.
GET /v1/products/{med_id}   One product's sheet (Général + Codes tabs). Not one of the
                    pharmacy's products → 404 `productNotFound` (never says it exists elsewhere).
GET /v1/products/{med_id}/stats   Statistiques tab: date_from → date_to (default: the last
                    30 days) vs the days just before, the last 12 months, suppliers (same 404).
GET /v1/products/{med_id}/movements   « Traçabilité » tab: purchase + sale lines with their details
                    (hour, lot expiry, import), period, type, search (document / supplier / client),
                    sort (date | kind), page (same 404).
PUT /v1/products/{med_id}   Owner only: « Modifier » → « Enregistrer » (his pharmacy only, shown in
                    « Produits » only); a field sent as null = back to the imported value.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Path, Query, status

from app.core.database import DbDep
from app.core.errors import ApiError, ErrorCode
from app.core.permissions import member
from app.core.security import CurrentUserDep
from app.core.utils import today as pharmacy_today
from app.products.product_queries import (
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
) -> dict:
    date_to = date_to or pharmacy_today()
    date_from = date_from or date_to - timedelta(days=29)
    date_from, date_to = min(date_from, date_to), max(date_from, date_to)
    stats = product_stats(db, pharmacy_id, med_id, date_from, date_to)
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
    sheet = save_product_edits(db, pharmacy_id, med_id, user.id, changes)
    if sheet is None:
        raise ApiError(404, ErrorCode.PRODUCT_NOT_FOUND, "Ce produit n'est pas dans votre pharmacie.")
    return sheet
