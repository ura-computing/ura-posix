"""Admin catalog (Medicament) schemas. Mirrors the Medicament model — every
write endpoint shapes Create / Update separately so Pydantic can do its own
validation (PATCH-like Update where every field is optional)."""
from __future__ import annotations

from pydantic import BaseModel

from schemas.transactions import Pagination


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


class CatalogImportResponse(BaseModel):
    total_rows: int
    inserted:   int
    updated:    int
    skipped:    int
    errors:     list[str]    # first 10 row-level errors for the admin toast
