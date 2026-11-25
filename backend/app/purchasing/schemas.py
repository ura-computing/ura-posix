"""« Fournisseurs » (admin, Support): the supplier list shared by every pharmacy."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.ledger.schemas import Pagination


class SupplierRow(BaseModel):
    id: int
    name: str
    kind: Literal["laboratoire", "grossiste", "societe"] | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    city: str | None = None


class SupplierListResponse(BaseModel):
    data: list[SupplierRow]
    pagination: Pagination


SupplierKind = Literal["laboratoire", "grossiste", "societe"]
OrderChannel = Literal["phone", "fax", "email", "whatsapp", "edi", "delegate"]
Weekday = Literal["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
WEEK: tuple[str, ...] = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")


class SupplierSheet(SupplierRow):
    """A supplier's sheet. Every order field None = « inconnu » (shown in orange)."""

    contact_name: str | None = None
    order_channel: OrderChannel | None = None
    delivery_days: list[Weekday] | None = None
    cutoff_time: str | None = None
    lead_time_days: int | None = None
    payment_terms: str | None = None
    transport_fee: float | None = None
    free_transport_from: float | None = None
    note: str | None = None
    archived_at: datetime | None = None


class SupplierEditIn(BaseModel):
    """PATCH /admin/suppliers/{id}: only the fields sent change; null / « » = back to « inconnu »."""

    name: str | None = Field(default=None, max_length=200)
    kind: SupplierKind | None = None
    phone: str | None = Field(default=None, max_length=40)
    email: str | None = Field(default=None, max_length=200)
    address: str | None = Field(default=None, max_length=300)
    city: str | None = Field(default=None, max_length=100)
    contact_name: str | None = Field(default=None, max_length=120)
    order_channel: OrderChannel | None = None
    delivery_days: list[Weekday] | None = None
    cutoff_time: str | None = None
    lead_time_days: int | None = Field(default=None, ge=0, le=90)
    payment_terms: str | None = Field(default=None, max_length=200)
    transport_fee: float | None = Field(default=None, ge=0, le=100_000)
    free_transport_from: float | None = Field(default=None, ge=0, le=10_000_000)
    note: str | None = Field(default=None, max_length=2000)
    archived: bool | None = None  # « Archiver » / « Remettre dans la liste »

    @field_validator(
        "name",
        "phone",
        "email",
        "address",
        "city",
        "contact_name",
        "cutoff_time",
        "payment_terms",
        "note",
        mode="before",
    )
    @classmethod
    def _blank(cls, value: object) -> object:
        return (value.strip() or None) if isinstance(value, str) else value

    @field_validator("cutoff_time")
    @classmethod
    def _cutoff(cls, value: str | None) -> str | None:
        """« 11h », « 11:00 », « 9h30 » → « 11:00 », « 09:30 »."""
        if value is None:
            return None
        m = re.fullmatch(r"(\d{1,2})\s*[h:]\s*(\d{2})?", value.lower())
        if not m or int(m.group(1)) > 23:
            raise ValueError("Heure invalide (exemple : 11:00).")
        return f"{int(m.group(1)):02d}:{m.group(2) or '00'}"

    @field_validator("delivery_days")
    @classmethod
    def _week_order(cls, value: list[str] | None) -> list[str] | None:
        return [d for d in WEEK if d in set(value)] or None if value is not None else None
