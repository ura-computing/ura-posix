"""« Produits » shapes: the pharmacy's product list + one product's sheet."""

from __future__ import annotations

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, StringConstraints

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


class ProductMovementLine(ProductMovement):
    total: float | None  # the line's total, as in the file
    discount: float | None  # sale: « Remise » in %; purchase: None


class ProductMovementsResponse(BaseModel):
    """« Mouvements »: one page of the filtered lines."""

    data: list[ProductMovementLine]
    pagination: Pagination


class ProductLookup(BaseModel):
    id: int  # the product's sheet: /produits/{id}


class Last30Days(BaseModel):
    """Today and the 29 days before; `*_before` = the 30 days before those."""

    sold: float
    bought: float
    sold_before: float
    bought_before: float


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
    recent_movements: list[ProductMovement]  # 5 latest, newest first
    last_30d: Last30Days
    # Fields the owner edited → their imported value (« Revenir à la valeur importée »).
    imported: dict[str, str | float | int | None]


def _blank_to_none(v: object) -> object:
    """« » or spaces = no value (back to the imported one)."""
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


# The length limit applies to the text, not to null (= back to the imported value).
Text = Annotated[Annotated[str, StringConstraints(max_length=300)] | None, BeforeValidator(_blank_to_none)]
LongText = Annotated[Annotated[str, StringConstraints(max_length=5000)] | None, BeforeValidator(_blank_to_none)]


class ProductEditIn(BaseModel):
    """PUT /products/{id}: only the fields sent change; null = back to the imported value.
    Any other field (e.g. the type pharmacie / parapharmacie) is refused (422)."""

    model_config = ConfigDict(extra="forbid")

    product: Text = None
    laboratoire: Text = None
    category: Text = None
    tva: Text = None
    ppv: float | None = Field(default=None, ge=0)
    pph: float | None = Field(default=None, ge=0)
    zone: Text = None
    current_stock: int | None = None
    stock_min: int | None = Field(default=None, ge=0)
    stock_max: int | None = Field(default=None, ge=0)
    expiry_date: date | None = None
    barcode1: Text = None
    barcode2: Text = None
    description: LongText = None


# ═══ Statistiques ════════════════════════════════════════════════════════════


class PeriodFigures(BaseModel):
    sold: float  # units sold
    bought: float  # units bought
    ca: float  # Σ qty × PPV (Rapport rule)
    marge: float | None  # CA − units sold × average purchase price; None = never bought with a price
    transactions: int  # distinct sale tickets


class MonthFigures(BaseModel):
    month: str  # YYYY-MM
    sold: float
    bought: float
    ca: float
    marge: float | None


class TrendPoint(BaseModel):
    start: str  # first day of the point (day, week or month)
    sold: float
    bought: float


class SupplierShare(BaseModel):
    supplier: str | None  # None = no supplier name in the file
    quantity: float  # units bought in the period
    pct: float | None  # % of every unit bought in the period


class SupplierPrice(BaseModel):
    supplier: str | None
    unit_price: float
    date: str | None


class ProductStats(BaseModel):
    """Statistiques tab: the period vs the one just before (same number of days); the charts and
    « Détail mensuel » = the last 12 months (this month and the 11 before)."""

    date_from: str
    date_to: str
    previous_from: str
    previous_to: str
    period: PeriodFigures
    previous: PeriodFigures
    monthly: list[MonthFigures]  # 12 months, oldest first
    trend_unit: Literal["day", "week", "month"]  # « Tendances »: a day up to 31 days, a week up to 92
    trend: list[TrendPoint]
    top_suppliers: list[SupplierShare]  # the 3 biggest of the period
    other_suppliers: SupplierShare | None  # « Autres »: every other supplier together
    last_prices: list[SupplierPrice]  # each supplier's latest priced purchase, newest first, 5 at most
