"""Owner-managed product exclusions ('produits spéciaux'). The data lives in
`PharmacyMedicamentStatus(declared=False)`; this schema file shapes the API
responses around it."""
from __future__ import annotations

from pydantic import BaseModel, Field


class SpecialProductOut(BaseModel):
    medicament_id: int
    product:       str
    pid:           str
    category:      str | None = None
    created_at:    str


class SpecialProductCreate(BaseModel):
    """Bulk-aware exclusion request. Always plural — a single product is just
    `medicament_ids=[42]`."""
    medicament_ids: list[int] = Field(..., min_length=1, max_length=200)


class SpecialProductBulkResult(BaseModel):
    inserted:        int
    already_special: int
    products:        list[SpecialProductOut]


class SpecialProductReintegrate(BaseModel):
    medicament_ids: list[int] = Field(..., min_length=1, max_length=200)


class SpecialProductReintegrateResult(BaseModel):
    reintegrated:   int          # rows actually deleted (flipped back to normal)
    not_special:    int          # ids that weren't excluded to begin with (idempotent)
    medicament_ids: list[int]


class MedicamentSuggestion(BaseModel):
    id:        int
    pid:       str
    product:   str
    category:  str | None = None
    nb_ventes: int          # context for the owner: how many sales this med has in their data