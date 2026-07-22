"""Schemas for BL (bon de livraison) exclusions — PG-007.

A pharmacist excludes an exceptional purchase by its delivery reference. Every
Achat row with that ref then disappears from the analytics (via achat_bl_filter);
nothing is deleted, un-excluding restores it. Purchases-side by nature — the
Sobrus ventes export carries no delivery reference, so sales are never linked.
"""
from __future__ import annotations

from pydantic import BaseModel


class BlLine(BaseModel):
    product:    str | None
    pid:        str | None
    quantity:   float | None
    unit_price: float | None
    total:      float | None


class BlSummary(BaseModel):
    """One BL as shown in the exclude-search results."""
    delivery_ref:     str
    supplier:         str | None
    delivery_date:    str | None
    total:            float
    nb_lines:         int
    nb_products:      int
    already_excluded: bool
    matched_products: list[str] = []   # product name(s) matching the query (product search)


class BlDetail(BaseModel):
    """Full BL — product lines for the confirmation step."""
    delivery_ref:  str
    supplier:      str | None
    delivery_date: str | None
    total:         float
    nb_lines:      int
    lines:         list[BlLine]


class BlExclusionOut(BaseModel):
    """A currently-excluded BL for the list table."""
    delivery_ref:  str
    supplier:      str | None
    delivery_date: str | None
    total:         float
    nb_lines:      int
    notes:         str | None
    created_at:    str


class BlExclusionCreate(BaseModel):
    delivery_ref: str
    notes:        str | None = None


class BlExclusionResult(BaseModel):
    excluded:         int             # newly excluded (1 or 0)
    already_excluded: int             # was already excluded
    item:             BlExclusionOut | None


class BlReintegrate(BaseModel):
    delivery_refs: list[str]


class BlReintegrateResult(BaseModel):
    reintegrated:  int
    not_excluded:  int
    delivery_refs: list[str]
