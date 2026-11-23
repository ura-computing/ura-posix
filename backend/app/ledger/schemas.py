"""Achats / ventes list shapes + the Pagination every list uses."""

from pydantic import BaseModel

# ═══ Pagination ══════════════════════════════════════════════════════════════
# Shapes shared by several routers.


class Pagination(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int


def paginate(total: int, page: int, limit: int) -> Pagination:
    """Build a Pagination from a row count + page params. Single source of truth."""
    pages = max(1, (total + limit - 1) // limit) if total else 0
    return Pagination(page=page, limit=limit, total=total, total_pages=pages)


# ═══ Achats + ventes ═════════════════════════════════════════════════════════


class AchatRow(BaseModel):
    id: int
    delivery_date: str | None
    delivery_ref: str | None
    # Base ref + suffix from CategorySuffix matching the row's category (same
    # pattern as VenteRow.transaction_ref_final). None when ref or suffix missing.
    delivery_ref_final: str | None
    delivery_ref_color: str | None
    supplier: str | None
    pid: str | None
    product: str | None
    category: str | None
    # Server-side classification "pharmacie" | "parapharmacie" | None
    category_type: str | None
    tva: str | None
    quantity: float | None
    pph: float | None
    unit_price: float | None
    total: float | None
    expiry_date: str | None
    import_batch_id: int | None


class VenteRow(BaseModel):
    id: int
    date: str | None
    transaction_ref: str | None
    # `transaction_ref + suffix` (suffix sourced from CategorySuffix on the row's category)
    transaction_ref_final: str | None
    # Token key (teal | blue | ...) for SuffixBadge tint; None when no suffix applies
    transaction_ref_color: str | None
    client: str | None
    pid: str | None
    product: str | None
    category: str | None
    # Stored Medicament.product_type — "pharmacie" | "parapharmacie" | None.
    # Source of truth: catalogue (set at catalog import, admin can override).
    category_type: str | None
    tva: str | None
    ppv: float | None
    quantity: float | None
    discount: float | None
    unit_price: float | None
    # PPV * qty * (1 - discount/100) — catalog-derived, distinct from `total` (Sobrus value)
    subtotal: float | None
    total: float | None
    # Weighted average purchase price for this medicament within the active filter window,
    # BL-excluded + non-declared-excluded. None when no Achat data in window.
    avg_pu: float | None
    import_batch_id: int | None


class VentesSuggestions(BaseModel):
    products: list[str]
    clients: list[str]
    refs: list[str]


class VentesSurveillanceCounts(BaseModel):
    all_flagged: int
    marge_negative: int
    marge_low: int
    remises_high: int


class AchatsSummary(BaseModel):
    """Aggregates over the FULL filtered set (pagination ignored). Drives the
    'TVA payé (filtres actifs)' footer + total CA. BL-excluded rows are
    included in the visible list but NOT in these aggregates."""

    rows_total: int
    tva_payee: float  # Σ(Achat.total × parse_tva_rate(Medicament.tva))
    grand_total: float  # Σ(Achat.total)


class AchatsListResponse(BaseModel):
    data: list[AchatRow]
    pagination: Pagination
    summary: AchatsSummary


class AchatsSuggestions(BaseModel):
    products: list[str]
    suppliers: list[str]
    refs: list[str]


class SupplierSummarySide(BaseModel):
    total_mad: float
    bl_count: int
    unit_count: float


class AchatsSupplierSummary(BaseModel):
    grossiste: SupplierSummarySide
    direct_labo: SupplierSummarySide


class DiscountSummarySide(BaseModel):
    total_mad: float
    count: int
    unit_count: float


class VentesDiscountSummary(BaseModel):
    """Split of the filtered ventes set into discounted vs full-price lines.
    Drives the /ventes remise-discipline gauge."""

    discounted: DiscountSummarySide
    full_price: DiscountSummarySide


class VentesSummary(BaseModel):
    """Aggregates over the FULL filtered set (pagination ignored). Drives the
    page footer ('TVA encaissée (filtres actifs)'). Computed in one extra SQL
    aggregate alongside the list query."""

    rows_total: int  # echoes pagination.total — handy for the footer copy
    tva_collected: float  # Σ(Vente.total × parse_tva_rate(Medicament.tva))
    grand_total: float  # Σ(Vente.total)


class VentesListResponse(BaseModel):
    data: list[VenteRow]
    pagination: Pagination
    summary: VentesSummary
