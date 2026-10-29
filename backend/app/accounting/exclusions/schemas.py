"""Exclusion shapes (special products, BLs, suppliers). Applied in Comptabilité only (`exclusions.py`);
nothing is deleted, un-excluding restores it."""

from __future__ import annotations

from pydantic import BaseModel, Field


# ═══ Special products ════════════════════════════════════════════════════════
# Owner-managed product exclusions ('produits spéciaux'). The data lives in
# `PharmacyMedicamentStatus(declared=False)`; this schema file shapes the API
# responses around it.


class SpecialProductOut(BaseModel):
    medicament_id: int
    product: str
    pid: str
    category: str | None = None
    notes: str | None = None
    created_at: str


class SpecialProductCreate(BaseModel):
    """Bulk-aware exclusion request. Always plural — a single product is just
    `medicament_ids=[42]`."""

    medicament_ids: list[int] = Field(..., min_length=1, max_length=200)


class SpecialProductBulkResult(BaseModel):
    inserted: int
    already_special: int
    products: list[SpecialProductOut]


class SpecialProductReintegrate(BaseModel):
    medicament_ids: list[int] = Field(..., min_length=1, max_length=200)


class SpecialProductReintegrateResult(BaseModel):
    reintegrated: int  # rows actually deleted (flipped back to normal)
    not_special: int  # ids that weren't excluded to begin with (idempotent)
    medicament_ids: list[int]


class MedicamentSuggestion(BaseModel):
    id: int
    pid: str
    product: str
    category: str | None = None
    nb_ventes: int  # context for the owner: how many sales this med has in their data


# ═══ BL exclusions ═══════════════════════════════════════════════════════════
# Schemas for BL (bon de livraison) exclusions — PG-007.
#
# A pharmacist excludes an exceptional purchase by its delivery reference. In
# Comptabilité only, every product on that BL then drops out (`exclusions.py`);
# nothing is deleted, un-excluding restores it.


class BlLine(BaseModel):
    product: str | None
    pid: str | None
    quantity: float | None
    unit_price: float | None
    total: float | None


class BlSummary(BaseModel):
    """One BL as shown in the exclude-search results."""

    delivery_ref: str
    supplier: str | None
    delivery_date: str | None
    total: float
    nb_lines: int
    nb_products: int
    already_excluded: bool
    matched_products: list[str] = []  # product name(s) matching the query (product search)


class BlDetail(BaseModel):
    """Full BL — product lines for the confirmation step."""

    delivery_ref: str
    supplier: str | None
    delivery_date: str | None
    total: float
    nb_lines: int
    lines: list[BlLine]


class BlExclusionOut(BaseModel):
    """A currently-excluded BL for the list table."""

    delivery_ref: str
    supplier: str | None
    delivery_date: str | None
    total: float
    nb_lines: int
    notes: str | None
    created_at: str


class BlExclusionCreate(BaseModel):
    delivery_ref: str
    notes: str | None = None


class BlExclusionResult(BaseModel):
    excluded: int  # newly excluded (1 or 0)
    already_excluded: int  # was already excluded
    item: BlExclusionOut | None


class BlReintegrate(BaseModel):
    delivery_refs: list[str]


class BlReintegrateResult(BaseModel):
    reintegrated: int
    not_excluded: int
    delivery_refs: list[str]


# ═══ BL line exclusions ══════════════════════════════════════════════════════
# « Exclure un produit d'un BL »: the same product bought on several BLs, only some of them left
# out of Comptabilité (those achat lines only; its other BLs and its ventes stay).


class ProductBlLine(BaseModel):
    """One BL holding the product (its lines of that product added up)."""

    delivery_ref: str
    supplier: str | None
    delivery_date: str | None
    quantity: float
    total: float
    nb_lines: int
    already_excluded: bool
    exclusion_id: int | None = None  # set when already excluded (« Réintégrer » = untick)


class ProductBlLines(BaseModel):
    medicament_id: int
    pid: str
    product: str
    lines: list[ProductBlLine]  # newest BL first


class BlLineExclusionOut(BaseModel):
    """An excluded product-on-a-BL, for the list table."""

    id: int
    delivery_ref: str
    supplier: str | None
    delivery_date: str | None
    medicament_id: int
    pid: str
    product: str
    quantity: float
    total: float
    notes: str | None
    created_at: str


class BlLineExclusionCreate(BaseModel):
    medicament_id: int
    delivery_refs: list[str]
    notes: str | None = None


class BlLineExclusionResult(BaseModel):
    excluded: int  # newly excluded BLs
    already_excluded: int
    ids: list[int]  # every exclusion of these BLs (« Annuler » = reintegrate them)


class BlLineReintegrate(BaseModel):
    ids: list[int]


class BlLineReintegrateResult(BaseModel):
    reintegrated: int
    not_excluded: int


# ═══ Supplier exclusions ═════════════════════════════════════════════════════
# Schemas for supplier (fournisseur) exclusions.
#
# A pharmacist excludes a supplier by NAME; in Comptabilité only, every product
# bought from it then drops out (`exclusions.py`). Mirrors the BL-exclusion schemas.


class SupplierSummary(BaseModel):
    """One supplier as shown in the exclude-search results."""

    supplier: str
    total: float
    nb_lines: int
    nb_products: int
    last_date: str | None
    already_excluded: bool


class SupplierExclusionOut(BaseModel):
    """A currently-excluded supplier for the list table."""

    supplier: str
    total: float
    nb_lines: int
    nb_products: int
    last_date: str | None
    notes: str | None
    created_at: str


class SupplierExclusionCreate(BaseModel):
    supplier: str
    notes: str | None = None


class SupplierExclusionResult(BaseModel):
    excluded: int  # newly excluded (1 or 0)
    already_excluded: int  # was already excluded
    item: SupplierExclusionOut | None


class SupplierReintegrate(BaseModel):
    suppliers: list[str]


class SupplierReintegrateResult(BaseModel):
    reintegrated: int
    not_excluded: int
    suppliers: list[str]


# ═══ Notes ═══════════════════════════════════════════════════════════════════
# « Ajouter une note » on an excluded line, after the exclusion (empty text = no note).


class NoteIn(BaseModel):
    notes: str | None = Field(None, max_length=500)


class SpecialProductNote(NoteIn):
    medicament_id: int


class BlNote(NoteIn):
    delivery_ref: str


class SupplierNote(NoteIn):
    supplier: str


class BlLineNote(NoteIn):
    id: int
