"""List + filter + surveillance endpoints for Achats + Ventes.

Ventes (Page 3) endpoints:
  GET /v1/ventes                       Paginated list with surveillance filter,
                                        marge cells (avg_pu_map), suffix coloring
  GET /v1/ventes/categories            Sorted distinct list (filter popover)
  GET /v1/ventes/tva-rates             Sorted distinct list (filter popover)
  GET /v1/ventes/suggestions?q=...     {products, clients, refs} groups for autocomplete
  GET /v1/ventes/surveillance-counts   {all_flagged, marge_negative, marge_low, remises_high}

Discount semantics: `Vente.discount` is treated as a PERCENT value throughout
(e.g. 10.0 means 10 %). Sobrus' CSV "Remise" column is loaded as-is. This
diverges slightly from apcm-pharma — where subtotal uses % but surveillance
uses absolute DH/PPV ratio. We pick the consistent reading: discount = %.

Owner sees only their pharmacy's rows. Admin is forbidden.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.core.database import DbDep
from app.core.permissions import member
from app.ledger import ledger_queries
from app.ledger.schemas import (
    AchatsListResponse,
    AchatsSuggestions,
    AchatsSupplierSummary,
    VentesDiscountSummary,
    VentesListResponse,
    VentesSuggestions,
    VentesSurveillanceCounts,
)

CategoryMultiQ = Annotated[list[str] | None, Query(alias="category", description="Repeat: ?category=A&category=B")]


TvaMultiQ = Annotated[list[str] | None, Query(alias="tva", description="Repeat: ?tva=20%25&tva=10%25")]


SurveillanceQ = Annotated[str | None, Query(description="all_flagged | marge_negative | marge_low | remises_high")]


IncludeNDQ = Annotated[bool, Query(description="Include non-declared products. Default: true")]


MinSearchQ = Annotated[str, Query(min_length=2, description="Min 2 chars for autocomplete")]


router = APIRouter(tags=["transactions"])


PageQ = Annotated[int, Query(ge=1)]


LimitQ = Annotated[int, Query(ge=1, le=200)]


DateFromQ = Annotated[str | None, Query(description="ISO date YYYY-MM-DD")]


DateToQ = Annotated[str | None, Query(description="ISO date YYYY-MM-DD")]


SearchQ = Annotated[str | None, Query(description="Substring search on product / supplier / client / refs")]


RefQ = Annotated[
    str | None, Query(description="Exact ticket / BL number: every line of it (« Voir détail » in Produits)")
]


BatchIdQ = Annotated[int | None, Query(ge=1, description="Filter to a specific ImportBatch.id")]


SortByQ = Annotated[str | None, Query(description="Sort column whitelist per endpoint")]


SortOrderQ = Annotated[str, Query(description="asc | desc")]


ExportQ = Annotated[
    bool, Query(description="If true, return ALL filter-matching rows (skip pagination). Capped at MAX_EXPORT_ROWS.")
]


@router.get("/achats", response_model=AchatsListResponse)
def list_achats(
    pharmacy_id: Annotated[int, member("achats")],
    db: DbDep,
    page: PageQ = 1,
    limit: LimitQ = 20,
    date_from: DateFromQ = None,
    date_to: DateToQ = None,
    search: SearchQ = None,
    ref: RefQ = None,
    category: CategoryMultiQ = None,
    tva: TvaMultiQ = None,
    include_non_declared: IncludeNDQ = True,
    sort_by: SortByQ = None,
    sort_order: SortOrderQ = "desc",
    export: ExportQ = False,
) -> dict:
    return ledger_queries.list_achats(
        pharmacy_id=pharmacy_id,
        db=db,
        page=page,
        limit=limit,
        date_from=date_from,
        date_to=date_to,
        search=search,
        ref=ref,
        category=category,
        tva=tva,
        include_non_declared=include_non_declared,
        sort_by=sort_by,
        sort_order=sort_order,
        export=export,
    )


@router.get("/achats/categories")
def list_achat_categories(pharmacy_id: Annotated[int, member("achats")], db: DbDep) -> list[str]:
    return ledger_queries.list_achat_categories(pharmacy_id=pharmacy_id, db=db)


@router.get("/achats/tva-rates")
def list_achat_tva_rates(pharmacy_id: Annotated[int, member("achats")], db: DbDep) -> list[str]:
    return ledger_queries.list_achat_tva_rates(pharmacy_id=pharmacy_id, db=db)


@router.get("/achats/suggestions", response_model=AchatsSuggestions)
def list_achat_suggestions(q: MinSearchQ, pharmacy_id: Annotated[int, member("achats")], db: DbDep) -> dict:
    """Tokenized PG-006 search across 3 groups. Products use the full
    product_search_clauses (name + pid + barcodes); suppliers + refs use
    supplier_search_clauses."""
    return ledger_queries.list_achat_suggestions(q=q, pharmacy_id=pharmacy_id, db=db)


@router.get("/achats/supplier-summary", response_model=AchatsSupplierSummary)
def achat_supplier_summary(
    pharmacy_id: Annotated[int, member("achats")],
    db: DbDep,
    date_from: DateFromQ = None,
    date_to: DateToQ = None,
    search: SearchQ = None,
    ref: RefQ = None,
    category: CategoryMultiQ = None,
    tva: TvaMultiQ = None,
    include_non_declared: IncludeNDQ = True,
) -> dict:
    """Split supplier-side totals into grossiste vs direct_labo for the gauge.
    Classification: UPPER(supplier) LIKE 'GROSSISTE%' → grossiste, else direct_labo.
    Exclusions apply only in the comptabilite view (include_non_declared=false)."""
    return ledger_queries.achat_supplier_summary(
        pharmacy_id=pharmacy_id,
        db=db,
        date_from=date_from,
        date_to=date_to,
        search=search,
        ref=ref,
        category=category,
        tva=tva,
        include_non_declared=include_non_declared,
    )


@router.get("/ventes", response_model=VentesListResponse)
def list_ventes(
    pharmacy_id: Annotated[int, member("ventes")],
    db: DbDep,
    page: PageQ = 1,
    limit: LimitQ = 20,
    date_from: DateFromQ = None,
    date_to: DateToQ = None,
    search: SearchQ = None,
    ref: RefQ = None,
    category: CategoryMultiQ = None,
    tva: TvaMultiQ = None,
    surveillance: SurveillanceQ = None,
    include_non_declared: IncludeNDQ = True,
    sort_by: SortByQ = None,
    sort_order: SortOrderQ = "desc",
    export: ExportQ = False,
) -> dict:
    return ledger_queries.list_ventes(
        pharmacy_id=pharmacy_id,
        db=db,
        page=page,
        limit=limit,
        date_from=date_from,
        date_to=date_to,
        search=search,
        ref=ref,
        category=category,
        tva=tva,
        surveillance=surveillance,
        include_non_declared=include_non_declared,
        sort_by=sort_by,
        sort_order=sort_order,
        export=export,
    )


@router.get("/ventes/categories")
def list_vente_categories(pharmacy_id: Annotated[int, member("ventes")], db: DbDep) -> list[str]:
    return ledger_queries.list_vente_categories(pharmacy_id=pharmacy_id, db=db)


@router.get("/ventes/tva-rates")
def list_vente_tva_rates(pharmacy_id: Annotated[int, member("ventes")], db: DbDep) -> list[str]:
    return ledger_queries.list_vente_tva_rates(pharmacy_id=pharmacy_id, db=db)


@router.get("/ventes/suggestions", response_model=VentesSuggestions)
def list_vente_suggestions(q: MinSearchQ, pharmacy_id: Annotated[int, member("ventes")], db: DbDep) -> dict:
    """Tokenized PG-006 search across 3 groups (products use product_search_clauses;
    clients + refs use supplier_search_clauses)."""
    return ledger_queries.list_vente_suggestions(q=q, pharmacy_id=pharmacy_id, db=db)


@router.get("/ventes/surveillance-counts", response_model=VentesSurveillanceCounts)
def vente_surveillance_counts(
    pharmacy_id: Annotated[int, member("ventes")],
    db: DbDep,
    date_from: DateFromQ = None,
    date_to: DateToQ = None,
    search: SearchQ = None,
    ref: RefQ = None,
    category: CategoryMultiQ = None,
    tva: TvaMultiQ = None,
) -> dict:
    """4 counts driving the surveillance tabs. BL exclusion is applied to the
    avg_pu subquery (apcm-pharma had this inconsistent — counts could disagree
    with rendered rows). Counts are recomputed per filter change."""
    return ledger_queries.vente_surveillance_counts(
        pharmacy_id=pharmacy_id,
        db=db,
        date_from=date_from,
        date_to=date_to,
        search=search,
        ref=ref,
        category=category,
        tva=tva,
    )


@router.get("/ventes/discount-summary", response_model=VentesDiscountSummary)
def vente_discount_summary(
    pharmacy_id: Annotated[int, member("ventes")],
    db: DbDep,
    date_from: DateFromQ = None,
    date_to: DateToQ = None,
    search: SearchQ = None,
    ref: RefQ = None,
    category: CategoryMultiQ = None,
    tva: TvaMultiQ = None,
) -> dict:
    """Split the filtered ventes set into discounted vs full-price aggregates.
    Drives the /ventes remise-discipline gauge: high discounted share = the
    team is giving away margin too often. Mirrors achat_supplier_summary
    structure (MAD + count + units per side, NO surveillance filter)."""
    return ledger_queries.vente_discount_summary(
        pharmacy_id=pharmacy_id,
        db=db,
        date_from=date_from,
        date_to=date_to,
        search=search,
        ref=ref,
        category=category,
        tva=tva,
    )
