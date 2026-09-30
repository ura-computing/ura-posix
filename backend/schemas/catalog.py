"""Catalogue shapes: medicaments (admin CRUD + CSV import) and category suffixes."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator

from errors import ErrorCode
from schemas.transactions import Pagination


# ═══ Medicaments ═════════════════════════════════════════════════════════════
# Admin catalog (Medicament) schemas. Mirrors the Medicament model — every
# write endpoint shapes Create / Update separately so Pydantic can do its own
# validation (PATCH-like Update where every field is optional).

class MedicamentRow(BaseModel):
    id:           int
    pid:          str
    product:      str
    tva:          str | None = None
    pph:          float | None = None
    ppv:          float | None = None
    category:     str | None = None
    barcode1:     str | None = None
    barcode2:     str | None = None
    laboratoire:  str | None = None
    product_type: str | None = None     # "pharmacie" | "parapharmacie" | None (auto)
    created_at:   str
    updated_at:   str | None = None


class MedicamentCreate(BaseModel):
    product:      str
    tva:          str | None = None
    pph:          float | None = None
    ppv:          float | None = None
    category:     str | None = None
    barcode1:     str | None = None
    barcode2:     str | None = None
    laboratoire:  str | None = None
    product_type: str | None = None     # null → auto-classified from category


class MedicamentUpdate(BaseModel):
    """PATCH-like — every field optional; only provided keys overwrite."""
    product:      str | None = None
    tva:          str | None = None
    pph:          float | None = None
    ppv:          float | None = None
    category:     str | None = None
    barcode1:     str | None = None
    barcode2:     str | None = None
    laboratoire:  str | None = None
    product_type: str | None = None


class CatalogListResponse(BaseModel):
    data:       list[MedicamentRow]
    pagination: Pagination


class RowError(BaseModel):
    """Same shape as an API error (errors.py): the frontend translates `code`."""
    detail: str
    code:   ErrorCode
    params: dict[str, Any]


class CatalogImportResponse(BaseModel):
    total_rows: int
    inserted:   int
    updated:    int
    skipped:    int
    errors:     list[RowError]    # first 10 row-level errors for the admin panel


# ═══ Category suffixes ═══════════════════════════════════════════════════════
# Category suffix (« Médicament » → "-1") shapes. Colors = the frontend palette.

ALLOWED_COLORS = frozenset({"teal", "blue", "purple", "amber", "rose", "emerald", "orange", "pink"})


class CategorySuffixIn(BaseModel):
    category: str = Field(min_length=1, max_length=200)
    suffix:   str = Field(min_length=1, max_length=20)
    color:    str | None = None

    @field_validator("color")
    @classmethod
    def _color_in_palette(cls, v: str | None) -> str | None:
        if v is None or v == "":
            return None
        if v not in ALLOWED_COLORS:
            raise ValueError(f"color must be one of {sorted(ALLOWED_COLORS)}")
        return v


class CategorySuffixOut(BaseModel):
    id:       int
    category: str
    suffix:   str
    color:    str | None
