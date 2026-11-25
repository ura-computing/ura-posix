"""« Commandes du jour » shapes: one draft per supplier, its lines, what the conditions engine says."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

OrderGroup = Literal["urgent", "restock", "promis", "check"]


class OrderLineOut(BaseModel):
    id: int
    medicament_id: int
    pid: str
    product: str
    quantity: int
    suggested: int
    edited: bool
    group: OrderGroup
    for_shelf: int
    for_promis: int
    customers: list[str]
    unit_price: float | None
    discount_pct: float  # the conditions engine (« Confirmée » rules only)
    net_total: float
    packaging: float | None  # the multiple required when the quantity does not respect it


class OrderMinimum(BaseModel):
    basis: Literal["units", "mad", "references"]
    required: float
    current: float
    reached: bool


class OrderNextTier(BaseModel):
    basis: Literal["units", "mad"]
    more: float
    pct: float


class SupplierRef(BaseModel):
    id: int
    name: str


class DailyOrder(BaseModel):
    id: int
    supplier: SupplierRef | None  # None = supplier unknown (« À vérifier »)
    lines: list[OrderLineOut]
    gross_total: float
    net_total: float
    minimums: list[OrderMinimum]
    next_tiers: list[OrderNextTier]
    transport_missing: float  # MAD still missing for free transport (0 = none / reached)
    unverified_rules: int  # rules « À vérifier »: shown on the supplier sheet, not applied here
    created_at: datetime


class DailyOrders(BaseModel):
    orders: list[DailyOrder]
    counts: dict[str, int]  # lines per group


class LineQuantityIn(BaseModel):
    quantity: int = Field(ge=1, le=100_000)


class AddLineIn(BaseModel):
    medicament_id: int = Field(ge=1)
    quantity: int = Field(ge=1, le=100_000)


class AddLineOut(BaseModel):
    order_id: int
    supplier: SupplierRef | None


class SentOrder(BaseModel):
    """An order sent to the admin, as both sides see it: its frozen copy + where it stands."""

    id: int
    state: Literal["validated", "sent", "delivered", "cancelled"]
    pharmacy: dict  # {id, name, code}
    order: DailyOrder  # the frozen copy (lines, prices, conditions of that day)
    validated_at: datetime
    validated_by_name: str | None
    sent_at: datetime | None
    delivered_at: datetime | None
    cancel_reason: str | None
    handled_by_name: str | None


class OrderStateIn(BaseModel):
    state: Literal["sent", "delivered", "cancelled"]
    reason: str | None = Field(default=None, max_length=300)
