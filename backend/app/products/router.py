"""« Produits » endpoints (owner + employee, feature `produits`). SQL in product_queries.

GET /v1/products    The pharmacy's products: search, Mixte / Pharmacie / Parapharmacie,
                    sort, page; export=true → every matching row (Excel).
GET /v1/products/{med_id}   One product's sheet (Général + Codes tabs). Not one of the
                    pharmacy's products → 404 `productNotFound` (never says it exists elsewhere).
GET /v1/products/{med_id}/stats   « Ventes par mois » + Statistiques tab (same 404).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path, Query

from app.core.database import DbDep
from app.core.errors import ApiError, ErrorCode
from app.core.permissions import member
from app.products.product_queries import list_products, product_sheet, product_stats
from app.products.schemas import ProductSheet, ProductStats, ProductsListResponse


router = APIRouter(tags=["products"])

PageQ = Annotated[int, Query(ge=1)]
LimitQ = Annotated[int, Query(ge=1, le=200)]
SearchQ = Annotated[str | None, Query(description="Product name / PID / barcode / laboratoire")]
CategoryTypeQ = Annotated[str, Query(description="all | pharmacie | parapharmacie")]
SortByQ = Annotated[str | None, Query(description="product | laboratoire | category | current_stock | …")]
SortOrderQ = Annotated[str, Query(description="asc | desc")]
ExportQ = Annotated[bool, Query(description="If true, return every matching row (skip pagination)")]


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


@router.get("/products/{med_id}", response_model=ProductSheet)
def get_product(med_id: Annotated[int, Path(ge=1)], pharmacy_id: Annotated[int, member("produits")], db: DbDep) -> dict:
    sheet = product_sheet(db, pharmacy_id, med_id)
    if sheet is None:
        raise ApiError(404, ErrorCode.PRODUCT_NOT_FOUND, "Ce produit n'est pas dans votre pharmacie.")
    return sheet


@router.get("/products/{med_id}/stats", response_model=ProductStats)
def get_product_stats(
    med_id: Annotated[int, Path(ge=1)], pharmacy_id: Annotated[int, member("produits")], db: DbDep
) -> dict:
    stats = product_stats(db, pharmacy_id, med_id)
    if stats is None:
        raise ApiError(404, ErrorCode.PRODUCT_NOT_FOUND, "Ce produit n'est pas dans votre pharmacie.")
    return stats
