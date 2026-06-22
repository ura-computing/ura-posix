"""Owner-managed product exclusions ('produits spéciaux'). The data lives in
`PharmacyMedicamentStatus(declared=False)`; this schema file shapes the API
responses around it."""
from __future__ import annotations

from pydantic import BaseModel


class SpecialProductOut(BaseModel):
    medicament_id: int
    product:       str
    pid:           str
    category:      str | None = None
    created_at:    str


class SpecialProductCreate(BaseModel):
    medicament_id: int


class MedicamentSuggestion(BaseModel):
    id:        int
    pid:       str
    product:   str
    category:  str | None = None
    nb_ventes: int          # context for the owner: how many sales this med has in their data


class DeleteResult(BaseModel):
    deleted:       bool
    medicament_id: int