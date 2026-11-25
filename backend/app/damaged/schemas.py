"""« Stock abîmé » shapes: one declaration of damaged boxes, the page's list."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.ledger.schemas import Pagination

DamageStatus = Literal["pending", "returned", "destroyed", "back_on_sale"]


class DamageIn(BaseModel):
    medicament_id: int = Field(ge=1)
    quantity: int = Field(ge=1, le=100_000)
    reason: str | None = Field(default=None, max_length=300)  # « carton écrasé à la livraison »
    note: str | None = Field(default=None, max_length=1000)


class DamageStatusIn(BaseModel):
    status: Literal["returned", "destroyed", "back_on_sale"]


class DamageRow(BaseModel):
    id: int
    medicament_id: int
    pid: str
    product: str
    quantity: int
    reason: str | None
    note: str | None
    status: DamageStatus
    created_by_name: str
    created_at: datetime
    closed_at: datetime | None


class DamageListResponse(BaseModel):
    data: list[DamageRow]
    pagination: Pagination
    boxes_off: int  # boxes of the filtered rows still off the free stock (not « Remis en vente »)
