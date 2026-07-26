"""Schemas for supplier (fournisseur) exclusions.

A pharmacist excludes a supplier by NAME; every Achat row from that supplier then
disappears from the analytics (via achat_supplier_filter). Purchases-side by
nature — the Sobrus ventes export carries no supplier, so sales are never linked.
Mirrors the BL-exclusion schemas.
"""
from __future__ import annotations

from pydantic import BaseModel


class SupplierSummary(BaseModel):
    """One supplier as shown in the exclude-search results."""
    supplier:         str
    total:            float
    nb_lines:         int
    nb_products:      int
    last_date:        str | None
    already_excluded: bool


class SupplierExclusionOut(BaseModel):
    """A currently-excluded supplier for the list table."""
    supplier:    str
    total:       float
    nb_lines:    int
    nb_products: int
    last_date:   str | None
    notes:       str | None
    created_at:  str


class SupplierExclusionCreate(BaseModel):
    supplier: str
    notes:    str | None = None


class SupplierExclusionResult(BaseModel):
    excluded:         int   # newly excluded (1 or 0)
    already_excluded: int   # was already excluded
    item:             SupplierExclusionOut | None


class SupplierReintegrate(BaseModel):
    suppliers: list[str]


class SupplierReintegrateResult(BaseModel):
    reintegrated: int
    not_excluded: int
    suppliers:    list[str]
