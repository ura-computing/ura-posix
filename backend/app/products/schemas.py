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
    filename: str | None  # the import it came from


class ProductMovementsResponse(BaseModel):
    """« Mouvements »: the filtered lines (page, or every line with export=true) + their sums."""

    data: list[ProductMovementLine]
    pagination: Pagination
    units_bought: float  # Σ qty of the filtered purchase lines
    units_sold: float  # Σ qty of the filtered sale lines


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


class MonthlySales(BaseModel):
    """« Ventes et achats par mois »: one entry per year with a sale or a purchase."""

    year: int
    sold: list[float]  # units sold, 12 values, January first
    sold_total: float
    bought: list[float]  # units bought, 12 values, January first
    bought_total: float


class BestMonth(BaseModel):
    month: str  # YYYY-MM
    units: float


class YearSummary(BaseModel):
    year: int
    units_sold: float
    ca: float  # Σ qty × PPV (Rapport rule)
    units_bought: float
    amount_bought: float  # Σ purchase line totals


class ProductStats(BaseModel):
    """« 12 mois » = the Stock page's window (`sales_from` → `sales_to`), like the sheet."""

    sales_from: str
    sales_to: str
    units_30d: float  # today and the 29 days before
    units_12m: float
    ca_12m: float
    avg_per_month: float  # units_12m ÷ 12
    avg_per_day: float  # units_12m ÷ days of the window
    months_without_sale: int  # months of the window with no sale line
    first_sale: str | None
    last_sale: str | None
    best_month: BestMonth | None  # most units ever; tie → the latest month
    monthly: list[MonthlySales]  # newest year first (same years as `yearly`)
    yearly: list[YearSummary]  # newest year first
