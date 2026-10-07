"""« Produits » shapes: the pharmacy's product list + one product's sheet."""

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
    photo: str | None  # first scraped photo URL (`product_infos`); None = none, or export=true


class ProductsListResponse(BaseModel):
    data: list[ProductRow]
    pagination: Pagination
    sales_from: str
    sales_to: str


# ═══ Product sheet ═══════════════════════════════════════════════════════════


class ProductDetail(BaseModel):
    label: str  # « Gamme », « Emballage »…
    value: str


class ProductInfoOut(BaseModel):
    """Scraped from a parapharmacy shop (`product_infos`)."""

    brand: str | None
    category: str | None  # the shop's, e.g. « Soins visage »
    images: list[str]
    description: str | None
    details: list[ProductDetail]
    source_url: str | None


class ProductPrices(BaseModel):
    ppv: float | None
    pph: float | None
    avg_pu: float | None  # weighted average purchase price, every purchase of the pharmacy
    last_pu: float | None  # price of the latest purchase (with a price, qty > 0)
    last_pu_date: str | None
    marge_pct: float | None  # (1 − avg_pu / ppv) × 100


class ProductStock(BaseModel):
    """Same rules as the Stock page (`stock_queries`), same 12 months."""

    current_stock: int | None  # None = not in the last stock import
    stock_min: int  # units_sold_12m ÷ 300 × 14
    stock_max: int  # units_sold_12m ÷ 300 × 15
    units_sold_12m: int
    sales_from: str
    sales_to: str
    coverage_days: int | None  # current_stock × 365 ÷ units_sold_12m; None when not computable
    status: str  # sous-stock | ideal | a-surveiller | sur-stock | inconnu | negatif
    expiry_date: str | None
    zone: str | None


class ProductMovement(BaseModel):
    kind: Literal["achat", "vente"]
    date: str | None
    quantity: float | None  # stock change: + bought, − sold
    unit_price: float | None
    document: str | None  # BL reference / ticket number
    party: str | None  # supplier / client


class ProductSheet(BaseModel):
    id: int
    pid: str
    product: str
    laboratoire: str | None
    category: str | None
    category_type: Literal["pharmacie", "parapharmacie"]
    tva: str | None
    barcode1: str | None
    barcode2: str | None
    info: ProductInfoOut | None  # None = no scraped row for this product
    prices: ProductPrices
    stock: ProductStock
    recent_movements: list[ProductMovement]  # 10 latest, newest first
