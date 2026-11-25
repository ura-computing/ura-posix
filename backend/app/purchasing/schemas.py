"""« Fournisseurs » (admin, Support): the supplier list shared by every pharmacy."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

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
