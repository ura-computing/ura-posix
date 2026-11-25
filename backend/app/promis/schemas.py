"""« Promis » shapes: customers, catalogue search with free stock, a new promis, the page's list."""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.ledger.schemas import Pagination

PromisState = Literal[
    "created",
    "to_order",
    "ordered",
    "received",
    "incident",
    "ready",
    "picked_up",
    "expired",
    "returned",
    "cancelled",
]


class CustomerOut(BaseModel):
    id: int
    name: str
    phone: str | None
    whatsapp_ok: bool


class CustomerIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str | None = None  # « +212612345678 »
    whatsapp_ok: bool = True

    @field_validator("name", mode="before")
    @classmethod
    def _name(cls, value: object) -> object:
        return " ".join(value.split()) if isinstance(value, str) else value

    @field_validator("phone", mode="before")
    @classmethod
    def _phone(cls, value: object) -> object:
        """Digits only; the national 0 goes: « +212 06 12… » → « +212612… ». Empty → None."""
        if not isinstance(value, str) or not value.strip():
            return None
        phone = re.sub(r"^(\+(?:212|33|34))0", r"\1", "+" + re.sub(r"\D", "", value))
        if not re.fullmatch(r"\+\d{8,15}", phone):
            raise ValueError("Numéro de téléphone invalide.")
        return phone


class PromisProduct(BaseModel):
    id: int
    pid: str
    product: str
    price: float | None  # PPV (the pharmacy's own when edited)
    counter_discount: float  # « Remise comptoir » (%), 0 = none
    free_stock: int | None  # None = not in the pharmacy's stock


class PromisLineIn(BaseModel):
    medicament_id: int | None = Field(default=None, ge=1)
    name: str | None = Field(default=None, max_length=200)  # a product outside the catalogue
    quantity: int = Field(ge=1, le=1000)

    @model_validator(mode="after")
    def _product_or_name(self) -> PromisLineIn:
        self.name = (self.name or "").strip() or None
        if self.medicament_id is None and self.name is None:
            raise ValueError("Produit manquant.")
        return self


class PromisIn(BaseModel):
    customer_id: int | None = Field(default=None, ge=1)
    customer: CustomerIn | None = None  # a new customer
    unreachable: bool = False  # « client injoignable »
    note: str | None = Field(default=None, max_length=1000)
    lines: list[PromisLineIn] = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def _one_customer(self) -> PromisIn:
        if (self.customer_id is None) == (self.customer is None):
            raise ValueError("Un client, existant ou nouveau.")
        return self


class PromisLineOut(BaseModel):
    medicament_id: int | None
    name: str
    quantity: int


class PromisRow(BaseModel):
    id: int
    number: int
    state: PromisState
    customer_name: str
    customer_phone: str | None
    lines: list[PromisLineOut]
    note: str | None
    pickup_deadline: date | None
    created_by_name: str
    created_at: datetime


class PromisListResponse(BaseModel):
    data: list[PromisRow]
    pagination: Pagination


class PromisSheetLine(BaseModel):
    id: int
    medicament_id: int | None
    pid: str | None
    name: str
    quantity: int
    reserved_qty: int
    shelf_place: str | None
    unit_price: float | None  # PPV at creation
    counter_discount: float  # % at creation
    free_stock: int | None  # None = outside the catalogue or not in the pharmacy's stock


class PromisEventOut(BaseModel):
    from_state: PromisState | None
    to_state: PromisState
    actor_name: str
    reason: str | None
    at: datetime


class PromisSheet(BaseModel):
    id: int
    number: int
    state: PromisState
    customer: CustomerOut
    unreachable: bool
    note: str | None
    ready_at: datetime | None
    pickup_deadline: date | None
    created_by_name: str
    created_at: datetime
    lines: list[PromisSheetLine]
    events: list[PromisEventOut]  # oldest first
    next: list[PromisState]  # where it may go now (same rule as the screen's buttons)
    messages: list[PromisMessageOut]  # WhatsApp messages sent, oldest first
    message_due: MessageKind | None  # the one to send now


MessageKind = Literal["created", "ready", "reminder", "returned"]


class PromisMessageOut(BaseModel):
    kind: MessageKind
    sent_by_name: str
    sent_at: datetime


class PromisMessageIn(BaseModel):
    kind: MessageKind


class PromisTodo(BaseModel):
    id: int
    number: int
    customer_name: str
    # what to do: a message to send (msg_*), the last pickup day, an expired one, a box to make ready, one to order
    todo: Literal[
        "expired", "last_day", "msg_ready", "msg_reminder", "msg_returned", "msg_created", "received", "to_order"
    ]


class PromisSummary(BaseModel):
    counts: dict[str, int]  # per state (absent = 0)
    todo: list[PromisTodo]  # most urgent first, 50 at most
    week: int  # « Prêt » whose last pickup day is within 7 days


class PromisMoveIn(BaseModel):
    state: Literal["ordered", "received", "incident", "ready", "picked_up", "returned", "cancelled"]
    reason: str | None = Field(default=None, max_length=300)  # required for « incident » and « cancelled »
    shelf_place: str | None = Field(default=None, max_length=100)  # required for « ready » (« tiroir B »)

    @model_validator(mode="after")
    def _required(self) -> PromisMoveIn:
        self.reason = (self.reason or "").strip() or None
        self.shelf_place = (self.shelf_place or "").strip() or None
        if self.state in ("incident", "cancelled") and self.reason is None:
            raise ValueError("Raison manquante.")
        if self.state == "ready" and self.shelf_place is None:
            raise ValueError("Emplacement manquant.")
        return self
