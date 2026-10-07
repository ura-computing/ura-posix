"""« Produits » shapes: the pharmacy's product list."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from app.ledger.schemas import Pagination


class ProductRow(BaseModel):
    id: int
    pid: str
    product: str
    laboratoire: str | None
    category: str | None
    category_type: Literal["pharmacie", "parapharmacie"]
    current_stock: int | None  # None = not in the last stock import
    units_sold_12m: int  # same 12 months as the Stock page (`sales_from` → `sales_to`)
    ppv: float | None
    avg_pu: float | None  # weighted average purchase price, every purchase of the pharmacy
    marge_pct: float | None  # (1 − avg_pu / ppv) × 100


class ProductsListResponse(BaseModel):
    data: list[ProductRow]
    pagination: Pagination
    sales_from: str
    sales_to: str
