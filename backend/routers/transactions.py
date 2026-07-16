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

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import Float, func, or_, select
from sqlalchemy.orm import Session

from csv_parse import strip_percentage
from database import DbDep
from exclusions import achat_bl_filter
from models import Achat, CategorySuffix, Medicament, PharmacyMedicamentStatus, Vente
from permissions import require_pharmacy_owner
from schemas.transactions import (
    AchatRow,
    AchatsListResponse,
    AchatsSuggestions,
    AchatsSummary,
    AchatsSupplierSummary,
    VenteRow,
    VentesListResponse,
    VentesSuggestions,
    VentesSummary,
    VentesDiscountSummary,
    VentesSurveillanceCounts,
    paginate,
)
from search import product_search_clauses, supplier_search_clauses, tokenize_search
from security import CurrentUserDep


# Multi-value query parameter type aliases (defined here for use across endpoints)
CategoryMultiQ = Annotated[list[str] | None, Query(alias="category", description="Repeat: ?category=A&category=B")]
TvaMultiQ      = Annotated[list[str] | None, Query(alias="tva",      description="Repeat: ?tva=20%25&tva=10%25")]
SurveillanceQ  = Annotated[str | None,       Query(description="all_flagged | marge_negative | marge_low | remises_high")]
IncludeNDQ     = Annotated[bool,             Query(description="Include non-declared products. Default: true")]
MinSearchQ     = Annotated[str,              Query(min_length=2, description="Min 2 chars for autocomplete")]


router = APIRouter(tags=["transactions"])


# ─── Common query params (Annotated) ─────────────────────────────────────────

PageQ        = Annotated[int,        Query(ge=1)]
LimitQ       = Annotated[int,        Query(ge=1, le=200)]
DateFromQ    = Annotated[str | None, Query(description="ISO date YYYY-MM-DD")]
DateToQ      = Annotated[str | None, Query(description="ISO date YYYY-MM-DD")]
SearchQ      = Annotated[str | None, Query(description="Substring search on product / supplier / client / refs")]
BatchIdQ     = Annotated[int | None, Query(ge=1, description="Filter to a specific ImportBatch.id")]
SortByQ      = Annotated[str | None, Query(description="Sort column whitelist per endpoint")]
SortOrderQ   = Annotated[str,        Query(description="asc | desc")]
ExportQ      = Annotated[bool,       Query(description="If true, return ALL filter-matching rows (skip pagination). Capped at MAX_EXPORT_ROWS.")]


# Server-side cap on export size. Exporting more is almost always a sign the
# user forgot a filter — we 413 rather than streaming a 200MB xlsx-bound payload.
MAX_EXPORT_ROWS = 50_000


def _check_export_cap(export: bool, total: int) -> None:
    """Enforce MAX_EXPORT_ROWS when export=true. Shared by list_achats + list_ventes."""
    if export and total > MAX_EXPORT_ROWS:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Trop de lignes ({total:,}) — affinez les filtres (max {MAX_EXPORT_ROWS:,}).",
        )


# Sort whitelists — narrow + explicit so no SQL injection vector via sort_by.
ACHAT_SORT  = {"id", "delivery_date", "delivery_ref", "supplier", "quantity", "pph", "unit_price", "total", "expiry_date"}
VENTE_SORT  = {"id", "date", "transaction_ref", "client", "quantity", "discount", "unit_price", "total"}


def _build_search_filter(search: str | None, *extra_text_cols):
    """Tokenize + return a list of AND clauses (one per token).
    Uses product_search_clauses if extra_text_cols supplied, otherwise none.
    Caller is responsible for joining Medicament. Empty search → no clauses."""
    tokens = tokenize_search(search)
    if not tokens:
        return []
    return product_search_clauses(tokens, extra_text_cols)


# ─── Ventes shared helpers ───────────────────────────────────────────────────

def _suffix_map(db: Session) -> dict[str, tuple[str, str | None]]:
    """In-memory map of (normalized category) → (suffix, color). One DB hit per request."""
    return {
        strip_percentage(s.category).lower(): (s.suffix, s.color)
        for s in db.query(CategorySuffix).all()
    }


def _non_declared_sub(pharmacy_id: int):
    """Select of medicament_ids the pharmacy has marked as non-declared. Returned as a
    `select()` rather than `.subquery()` because SQLAlchemy 2.x coerces with a warning."""
    return select(PharmacyMedicamentStatus.medicament_id).where(
        PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
        PharmacyMedicamentStatus.declared.is_(False),
    )


def _avg_pu_subq(db: Session, pharmacy_id: int, date_from: str | None, date_to: str | None):
    """Weighted avg purchase price per medicament. Window + non-declared + BL exclusion.
    Used by both list_ventes (avg_pu_map for marge cells) and surveillance_counts
    (so badge counts match visible rows — fixes the apcm-pharma parity bug)."""
    nd = _non_declared_sub(pharmacy_id)
    q = (
        db.query(
            Achat.medicament_id.label("med_id"),
            (func.sum(Achat.unit_price * Achat.quantity) / func.sum(Achat.quantity)).label("avg_pu"),
        )
        .filter(
            Achat.pharmacy_id == pharmacy_id,
            Achat.quantity > 0,
            Achat.unit_price.isnot(None),
            Achat.medicament_id.notin_(nd),
            achat_bl_filter(db, pharmacy_id),
        )
    )
    if date_from:
        q = q.filter(Achat.delivery_date >= date_from)
    if date_to:
        q = q.filter(Achat.delivery_date <= date_to)
    return q.group_by(Achat.medicament_id).subquery()


def _apply_med_join_filters(q, search: str | None, category: list[str] | None, tva: list[str] | None):
    """Joins Medicament + applies search/category/tva. Uses tokenized PG-006
    search (unaccent + multi-token + `*` wildcard + fuzzy ≥4 chars) across
    Medicament.product/pid/barcodes + Vente.client + Vente.transaction_ref."""
    if not (search or category or tva):
        return q
    q = q.outerjoin(Medicament, Vente.medicament_id == Medicament.id)
    for clause in _build_search_filter(search, Vente.client, Vente.transaction_ref):
        q = q.filter(clause)
    if category:
        q = q.filter(or_(*[Medicament.category.ilike(f"{c}%") for c in category]))
    if tva:
        q = q.filter(Medicament.tva.in_(tva))
    return q


def _apply_vente_filters(
    q,
    pharmacy_id: int,
    *,
    date_from: str | None = None,
    date_to:   str | None = None,
    search:    str | None = None,
    category:  list[str] | None = None,
    tva:       list[str] | None = None,
    include_non_declared: bool = True,
):
    """Reusable WHERE-chain shared by list + surveillance-counts."""
    q = q.filter(Vente.pharmacy_id == pharmacy_id)
    if not include_non_declared:
        q = q.filter(Vente.medicament_id.notin_(_non_declared_sub(pharmacy_id)))
    if date_from:
        q = q.filter(Vente.date >= date_from)
    if date_to:
        q = q.filter(Vente.date <= date_to)
    return _apply_med_join_filters(q, search, category, tva)


def _apply_surveillance(q, surveillance: str | None, avg_pu_sub, has_med_join: bool):
    """Apply the surveillance predicate. Caller must already have joined avg_pu_sub.
    Ensures Medicament is joined for the ppv-dependent predicates."""
    if not surveillance:
        return q
    if not has_med_join:
        q = q.outerjoin(Medicament, Vente.medicament_id == Medicament.id)
    if surveillance == "marge_negative":
        return q.filter(avg_pu_sub.c.avg_pu > Medicament.ppv)
    if surveillance == "marge_low":
        return q.filter(
            avg_pu_sub.c.avg_pu.isnot(None),
            Medicament.ppv > 0,
            avg_pu_sub.c.avg_pu <= Medicament.ppv,
            ((1.0 - avg_pu_sub.c.avg_pu / Medicament.ppv) * 100.0) < 10.0,
        )
    if surveillance == "remises_high":
        return q.filter(Vente.discount > 20)
    if surveillance == "all_flagged":
        return q.filter(or_(
            avg_pu_sub.c.avg_pu > Medicament.ppv,
            Vente.discount > 20,
            ((1.0 - avg_pu_sub.c.avg_pu / Medicament.ppv) * 100.0) < 10.0,
        ))
    return q


def _apply_sort(query, model, sort_by: str | None, sort_order: str, whitelist: set[str], default_col: str,
                extra_cols: dict | None = None):
    """Order by a whitelisted model column, or by an explicit joined/computed
    expression from `extra_cols` (PG-014: lets Achats/Ventes sort on Medicament
    columns and marge expressions). extra_cols keys are hardcoded by callers —
    same no-injection guarantee as the whitelist. Extra expressions can be NULL
    ("—" rows) → always pushed last."""
    extra_cols = extra_cols or {}
    if sort_by in extra_cols:
        column  = extra_cols[sort_by]
        ordered = column.desc() if sort_order == "desc" else column.asc()
        return query.order_by(ordered.nullslast())
    col_name = sort_by if sort_by in whitelist else default_col
    column = getattr(model, col_name)
    return query.order_by(column.desc() if sort_order == "desc" else column.asc())


# ─── GET /achats ─────────────────────────────────────────────────────────────

def _apply_achat_filters(
    q,
    pharmacy_id: int,
    *,
    date_from: str | None = None,
    date_to:   str | None = None,
    search:    str | None = None,
    category:  list[str] | None = None,
    tva:       list[str] | None = None,
):
    """Shared WHERE-chain for list + supplier-summary. Joins Medicament when
    any of search/category/tva is set (PG-006 tokenized search needs it)."""
    q = q.filter(Achat.pharmacy_id == pharmacy_id)
    if date_from:
        q = q.filter(Achat.delivery_date >= date_from)
    if date_to:
        q = q.filter(Achat.delivery_date <= date_to)
    if search or category or tva:
        q = q.outerjoin(Medicament, Achat.medicament_id == Medicament.id)
    for clause in _build_search_filter(search, Achat.supplier, Achat.delivery_ref):
        q = q.filter(clause)
    if category:
        q = q.filter(or_(*[Medicament.category.ilike(f"{c}%") for c in category]))
    if tva:
        q = q.filter(Medicament.tva.in_(tva))
    return q


@router.get("/achats", response_model=AchatsListResponse)
def list_achats(
    user: CurrentUserDep,
    db: DbDep,
    page:       PageQ          = 1,
    limit:      LimitQ         = 20,
    date_from:  DateFromQ      = None,
    date_to:    DateToQ        = None,
    search:     SearchQ        = None,
    category:   CategoryMultiQ = None,
    tva:        TvaMultiQ      = None,
    sort_by:    SortByQ        = None,
    sort_order: SortOrderQ     = "desc",
    export:     ExportQ        = False,
) -> dict:
    pharmacy_id = require_pharmacy_owner(user, db, feature="achats")
    q = _apply_achat_filters(
        db.query(Achat), pharmacy_id,
        date_from=date_from, date_to=date_to, search=search, category=category, tva=tva,
    )
    # Force Medicament join (for the TVA aggregate) if no search/category/tva
    if not (search or category or tva):
        q = q.outerjoin(Medicament, Achat.medicament_id == Medicament.id)

    # Single aggregate: count + grand_total + tva_payee over the FULL filtered set
    cleaned = func.regexp_replace(func.coalesce(Medicament.tva, ""), r"[^0-9.]", "", "g")
    tva_rate = func.coalesce(func.cast(func.nullif(cleaned, ""), Float), 0.0) / 100.0
    agg = q.with_entities(
        func.count(Achat.id.distinct()).label("n"),
        func.coalesce(func.sum(Achat.total), 0.0).label("grand"),
        func.coalesce(func.sum(Achat.total * tva_rate), 0.0).label("tva"),
    ).one()
    total = int(agg.n or 0)

    _check_export_cap(export, total)

    # PG-014: Produit/Catégorie sort via the (always-joined) Medicament.
    sorted_q = _apply_sort(q, Achat, sort_by, sort_order, ACHAT_SORT, "id",
                           extra_cols={"product": Medicament.product, "category": Medicament.category})
    rows = sorted_q.all() if export else sorted_q.offset((page - 1) * limit).limit(limit).all()

    # Bulk-load medicaments into the session identity map so _achat_to_row's
    # per-row db.get() returns from cache instead of issuing N queries.
    med_ids = {a.medicament_id for a in rows if a.medicament_id}
    if med_ids:
        db.query(Medicament).filter(Medicament.id.in_(med_ids)).all()

    suffixes = _suffix_map(db)
    pagination_size = max(total, 1) if export else limit
    return {
        "data": [_achat_to_row(db, a, suffixes) for a in rows],
        "pagination": paginate(total, 1 if export else page, pagination_size),
        "summary": AchatsSummary(
            rows_total=total,
            tva_payee=float(agg.tva or 0.0),
            grand_total=float(agg.grand or 0.0),
        ),
    }


def _achat_to_row(db: Session, a: Achat, suffixes: dict[str, tuple[str, str | None]]) -> AchatRow:
    med = db.get(Medicament, a.medicament_id) if a.medicament_id else None
    category = med.category if med else None
    suffix, color = suffixes.get(strip_percentage(category).lower(), ("", None))
    ref = a.delivery_ref or ""
    return AchatRow(
        id=a.id,
        delivery_date=a.delivery_date,
        delivery_ref=a.delivery_ref,
        delivery_ref_final=(ref + suffix) if ref else None,
        delivery_ref_color=color if (ref and suffix) else None,
        supplier=a.supplier,
        pid=med.pid if med else None,
        product=med.product if med else None,
        category=category,
        category_type=med.product_type if med else None,
        tva=med.tva if med else None,
        quantity=a.quantity,
        pph=med.pph if med else None,
        unit_price=a.unit_price,
        total=a.total,
        expiry_date=a.expiry_date,
        import_batch_id=a.import_batch_id,
    )


# ─── GET /achats/categories ──────────────────────────────────────────────────

@router.get("/achats/categories")
def list_achat_categories(user: CurrentUserDep, db: DbDep) -> list[str]:
    pharmacy_id = require_pharmacy_owner(user, db, feature="achats")
    rows = (
        db.query(Medicament.category)
        .join(Achat, Achat.medicament_id == Medicament.id)
        .filter(Achat.pharmacy_id == pharmacy_id, Medicament.category.isnot(None))
        .distinct().all()
    )
    seen = {strip_percentage(r.category) for r in rows if r.category}
    return sorted(seen, key=lambda s: s.lower())


# ─── GET /achats/tva-rates ───────────────────────────────────────────────────

@router.get("/achats/tva-rates")
def list_achat_tva_rates(user: CurrentUserDep, db: DbDep) -> list[str]:
    pharmacy_id = require_pharmacy_owner(user, db, feature="achats")
    rows = (
        db.query(Medicament.tva)
        .join(Achat, Achat.medicament_id == Medicament.id)
        .filter(Achat.pharmacy_id == pharmacy_id, Medicament.tva.isnot(None))
        .distinct().order_by(Medicament.tva).all()
    )
    return [r.tva for r in rows if r.tva]


# ─── GET /achats/suggestions ─────────────────────────────────────────────────

def _apply_clauses(q, clauses):
    """Reduce a list of SQLAlchemy clauses into a filtered query (AND-join)."""
    for c in clauses:
        q = q.filter(c)
    return q


def _suggest_supplier_col(db, pharmacy_id: int, col, tokens: list[str]) -> list[str]:
    """Top-6 distinct values of `col` matching all tokens. col is unaccent-substring matched."""
    q = db.query(col).filter(Achat.pharmacy_id == pharmacy_id, col.isnot(None))
    q = _apply_clauses(q, supplier_search_clauses(tokens, [col]))
    return [getattr(r, col.key) for r in q.distinct().limit(6).all() if getattr(r, col.key)]


@router.get("/achats/suggestions", response_model=AchatsSuggestions)
def list_achat_suggestions(q: MinSearchQ, user: CurrentUserDep, db: DbDep) -> dict:
    """Tokenized PG-006 search across 3 groups. Products use the full
    product_search_clauses (name + pid + barcodes + fuzzy); suppliers + refs
    use the simpler unaccent-substring helper."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="achats")
    tokens = tokenize_search(q)
    if not tokens:
        return {"products": [], "suppliers": [], "refs": []}

    prod_q = (
        db.query(Medicament.product)
        .join(Achat, Achat.medicament_id == Medicament.id)
        .filter(Achat.pharmacy_id == pharmacy_id)
    )
    prod_q   = _apply_clauses(prod_q, product_search_clauses(tokens))
    products = [r.product for r in prod_q.distinct().limit(6).all() if r.product]

    return {
        "products":  products,
        "suppliers": _suggest_supplier_col(db, pharmacy_id, Achat.supplier,     tokens),
        "refs":      _suggest_supplier_col(db, pharmacy_id, Achat.delivery_ref, tokens),
    }


# ─── GET /achats/supplier-summary ────────────────────────────────────────────

@router.get("/achats/supplier-summary", response_model=AchatsSupplierSummary)
def achat_supplier_summary(
    user: CurrentUserDep,
    db:   DbDep,
    date_from: DateFromQ      = None,
    date_to:   DateToQ        = None,
    search:    SearchQ        = None,
    category:  CategoryMultiQ = None,
    tva:       TvaMultiQ      = None,
) -> dict:
    """Split supplier-side totals into grossiste vs direct_labo for the gauge.
    Classification: UPPER(supplier) LIKE 'GROSSISTE%' → grossiste, else direct_labo.
    BL exclusion is applied (matches stats parity)."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="achats")
    base = _apply_achat_filters(
        db.query(Achat), pharmacy_id,
        date_from=date_from, date_to=date_to, search=search, category=category, tva=tva,
    ).filter(
        Achat.supplier.isnot(None), Achat.supplier != "",
        achat_bl_filter(db, pharmacy_id),
    )

    is_grossiste = func.upper(Achat.supplier).like("GROSSISTE%")

    def _agg(filter_clause) -> dict:
        row = base.with_entities(
            func.coalesce(func.sum(Achat.total),                       0.0).label("total"),
            func.coalesce(func.sum(Achat.quantity),                    0.0).label("units"),
            func.count(func.distinct(Achat.delivery_ref)).label("bls"),
        ).filter(filter_clause).one()
        return {"total_mad": float(row.total or 0.0), "unit_count": float(row.units or 0.0), "bl_count": int(row.bls or 0)}

    return {
        "grossiste":   _agg(is_grossiste),
        "direct_labo": _agg(~is_grossiste),
    }


# ─── GET /ventes ─────────────────────────────────────────────────────────────

@router.get("/ventes", response_model=VentesListResponse)
def list_ventes(
    user: CurrentUserDep,
    db:   DbDep,
    page:                 PageQ          = 1,
    limit:                LimitQ         = 20,
    date_from:            DateFromQ      = None,
    date_to:              DateToQ        = None,
    search:               SearchQ        = None,
    category:             CategoryMultiQ = None,
    tva:                  TvaMultiQ      = None,
    surveillance:         SurveillanceQ  = None,
    include_non_declared: IncludeNDQ     = True,
    sort_by:              SortByQ        = None,
    sort_order:           SortOrderQ     = "desc",
    export:               ExportQ        = False,
) -> dict:
    pharmacy_id = require_pharmacy_owner(user, db, feature="ventes")

    q = _apply_vente_filters(
        db.query(Vente), pharmacy_id,
        date_from=date_from, date_to=date_to, search=search,
        category=category, tva=tva, include_non_declared=include_non_declared,
    )
    # Ensure Medicament is joined for the TVA aggregate (might not be joined yet
    # if no search/category/tva filter was applied). Idempotent for SQLAlchemy.
    has_med_join = bool(search or category or tva)
    # PG-014: sorting by marge needs the avg-PU subquery joined (1:1 per
    # medicament — doesn't multiply rows, so the aggregate below stays exact).
    marge_sort = sort_by in ("marge_pct", "marge_dh")
    avg_pu_sub = None
    if surveillance or marge_sort:
        avg_pu_sub = _avg_pu_subq(db, pharmacy_id, date_from, date_to)
        q = q.outerjoin(avg_pu_sub, Vente.medicament_id == avg_pu_sub.c.med_id)
    if surveillance:
        q = _apply_surveillance(q, surveillance, avg_pu_sub, has_med_join=has_med_join)
        has_med_join = True  # _apply_surveillance forces the Medicament join
    if not has_med_join:
        q = q.outerjoin(Medicament, Vente.medicament_id == Medicament.id)

    # Single aggregate query for: count + grand_total + tva_collected (Σ over full filter set)
    cleaned = func.regexp_replace(func.coalesce(Medicament.tva, ""), r"[^0-9.]", "", "g")
    tva_rate = func.coalesce(func.cast(func.nullif(cleaned, ""), Float), 0.0) / 100.0
    agg = q.with_entities(
        func.count(Vente.id.distinct()).label("n"),
        func.coalesce(func.sum(Vente.total), 0.0).label("grand"),
        func.coalesce(func.sum(Vente.total * tva_rate), 0.0).label("tva"),
    ).one()
    total = int(agg.n or 0)

    _check_export_cap(export, total)

    # PG-014: joined/computed sort columns — Produit/Catégorie/PPV live on
    # Medicament (always joined by now); marge mirrors the surveillance formula.
    vente_extra_sort = {
        "product":  Medicament.product,
        "category": Medicament.category,
        "ppv":      Medicament.ppv,
    }
    if marge_sort and avg_pu_sub is not None:
        vente_extra_sort["marge_dh"]  = Medicament.ppv - avg_pu_sub.c.avg_pu
        vente_extra_sort["marge_pct"] = (1.0 - avg_pu_sub.c.avg_pu / func.nullif(Medicament.ppv, 0)) * 100.0
    sorted_q = _apply_sort(q, Vente, sort_by, sort_order, VENTE_SORT, "id", extra_cols=vente_extra_sort)
    rows = sorted_q.all() if export else sorted_q.offset((page - 1) * limit).limit(limit).all()

    # Bulk-load medicaments + compute avg_pu_map for the result set (covers
    # both paginated and full-export paths — avoids N+1 in _vente_to_row).
    med_ids = [v.medicament_id for v in rows if v.medicament_id]
    avg_pu_map: dict[int, float] = {}
    if med_ids:
        db.query(Medicament).filter(Medicament.id.in_(med_ids)).all()
        sub = _avg_pu_subq(db, pharmacy_id, date_from, date_to)
        for row in db.query(sub.c.med_id, sub.c.avg_pu).filter(sub.c.med_id.in_(med_ids)).all():
            if row.avg_pu is not None:
                avg_pu_map[row.med_id] = float(row.avg_pu)

    suffixes = _suffix_map(db)
    pagination_size = max(total, 1) if export else limit
    return {
        "data": [_vente_to_row(db, v, suffixes, avg_pu_map) for v in rows],
        "pagination": paginate(total, 1 if export else page, pagination_size),
        "summary": VentesSummary(
            rows_total=total,
            tva_collected=float(agg.tva or 0.0),
            grand_total=float(agg.grand or 0.0),
        ),
    }


def _vente_to_row(
    db: Session, v: Vente,
    suffixes: dict[str, tuple[str, str | None]],
    avg_pu_map: dict[int, float],
) -> VenteRow:
    med = db.get(Medicament, v.medicament_id) if v.medicament_id else None
    category = med.category if med else None
    suffix, color = suffixes.get(strip_percentage(category).lower(), ("", None))
    ref = v.transaction_ref or ""
    ppv = float(med.ppv) if med and med.ppv is not None else None
    discount = float(v.discount or 0.0)
    subtotal = (
        round(ppv * float(v.quantity or 0) * (1.0 - discount / 100.0), 4)
        if ppv is not None and v.quantity is not None
        else None
    )
    avg_pu = avg_pu_map.get(v.medicament_id) if v.medicament_id else None
    return VenteRow(
        id=v.id,
        date=v.date,
        transaction_ref=v.transaction_ref,
        transaction_ref_final=(ref + suffix) if ref else None,
        transaction_ref_color=color if (ref and suffix) else None,
        client=v.client,
        pid=med.pid if med else None,
        product=med.product if med else None,
        category=category,
        category_type=med.product_type if med else None,
        tva=med.tva if med else None,
        ppv=ppv,
        quantity=v.quantity,
        discount=v.discount,
        unit_price=v.unit_price,
        subtotal=subtotal,
        total=v.total,
        avg_pu=round(avg_pu, 4) if avg_pu is not None else None,
        import_batch_id=v.import_batch_id,
    )


# ─── GET /ventes/categories ──────────────────────────────────────────────────

@router.get("/ventes/categories")
def list_vente_categories(user: CurrentUserDep, db: DbDep) -> list[str]:
    pharmacy_id = require_pharmacy_owner(user, db, feature="ventes")
    rows = (
        db.query(Medicament.category)
        .join(Vente, Vente.medicament_id == Medicament.id)
        .filter(Vente.pharmacy_id == pharmacy_id, Medicament.category.isnot(None))
        .distinct().all()
    )
    seen = {strip_percentage(r.category) for r in rows if r.category}
    return sorted(seen, key=lambda s: s.lower())


# ─── GET /ventes/tva-rates ───────────────────────────────────────────────────

@router.get("/ventes/tva-rates")
def list_vente_tva_rates(user: CurrentUserDep, db: DbDep) -> list[str]:
    pharmacy_id = require_pharmacy_owner(user, db, feature="ventes")
    rows = (
        db.query(Medicament.tva)
        .join(Vente, Vente.medicament_id == Medicament.id)
        .filter(Vente.pharmacy_id == pharmacy_id, Medicament.tva.isnot(None))
        .distinct().order_by(Medicament.tva).all()
    )
    return [r.tva for r in rows if r.tva]


# ─── GET /ventes/suggestions ─────────────────────────────────────────────────

def _suggest_vente_col(db, pharmacy_id: int, col, tokens: list[str]) -> list[str]:
    """Distinct top-6 values of `col` matching all tokens via unaccent-substring."""
    q = db.query(col).filter(Vente.pharmacy_id == pharmacy_id, col.isnot(None))
    q = _apply_clauses(q, supplier_search_clauses(tokens, [col]))
    return [getattr(r, col.key) for r in q.distinct().limit(6).all() if getattr(r, col.key)]


@router.get("/ventes/suggestions", response_model=VentesSuggestions)
def list_vente_suggestions(q: MinSearchQ, user: CurrentUserDep, db: DbDep) -> dict:
    """Tokenized PG-006 search across 3 groups (products use full product_search_clauses
    with fuzzy fallback; clients + refs use unaccent-substring)."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="ventes")
    tokens = tokenize_search(q)
    if not tokens:
        return {"products": [], "clients": [], "refs": []}

    prod_q = (
        db.query(Medicament.product)
        .join(Vente, Vente.medicament_id == Medicament.id)
        .filter(Vente.pharmacy_id == pharmacy_id)
    )
    prod_q   = _apply_clauses(prod_q, product_search_clauses(tokens))
    products = [r.product for r in prod_q.distinct().limit(6).all() if r.product]

    return {
        "products": products,
        "clients":  _suggest_vente_col(db, pharmacy_id, Vente.client,          tokens),
        "refs":     _suggest_vente_col(db, pharmacy_id, Vente.transaction_ref, tokens),
    }


# ─── GET /ventes/surveillance-counts ─────────────────────────────────────────

@router.get("/ventes/surveillance-counts", response_model=VentesSurveillanceCounts)
def vente_surveillance_counts(
    user: CurrentUserDep,
    db:   DbDep,
    date_from: DateFromQ      = None,
    date_to:   DateToQ        = None,
    search:    SearchQ        = None,
    category:  CategoryMultiQ = None,
    tva:       TvaMultiQ      = None,
) -> dict:
    """4 counts driving the surveillance tabs. BL exclusion is applied to the
    avg_pu subquery (apcm-pharma had this inconsistent — counts could disagree
    with rendered rows). Counts are recomputed per filter change."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="ventes")
    avg_pu = _avg_pu_subq(db, pharmacy_id, date_from, date_to)

    base = _apply_vente_filters(
        db.query(Vente.id), pharmacy_id,
        date_from=date_from, date_to=date_to, search=search,
        category=category, tva=tva, include_non_declared=True,
    )
    # Ensure Medicament + avg_pu joined for the predicates below
    base = base.outerjoin(avg_pu, Vente.medicament_id == avg_pu.c.med_id)
    if not (search or category or tva):
        base = base.outerjoin(Medicament, Vente.medicament_id == Medicament.id)

    flag_neg = avg_pu.c.avg_pu > Medicament.ppv
    flag_low = (
        avg_pu.c.avg_pu.isnot(None)
        & (Medicament.ppv > 0)
        & (avg_pu.c.avg_pu <= Medicament.ppv)
        & (((1.0 - avg_pu.c.avg_pu / Medicament.ppv) * 100.0) < 10.0)
    )
    flag_rem = Vente.discount > 20

    def _count(predicate) -> int:
        return base.with_entities(func.count(Vente.id.distinct())).filter(predicate).scalar() or 0

    n_neg = _count(flag_neg)
    n_low = _count(flag_low)
    n_rem = _count(flag_rem)
    n_all = _count(or_(flag_neg, flag_low, flag_rem))
    return {
        "all_flagged":    n_all,
        "marge_negative": n_neg,
        "marge_low":      n_low,
        "remises_high":   n_rem,
    }


# ─── GET /ventes/discount-summary ────────────────────────────────────────────

@router.get("/ventes/discount-summary", response_model=VentesDiscountSummary)
def vente_discount_summary(
    user: CurrentUserDep,
    db:   DbDep,
    date_from: DateFromQ      = None,
    date_to:   DateToQ        = None,
    search:    SearchQ        = None,
    category:  CategoryMultiQ = None,
    tva:       TvaMultiQ      = None,
) -> dict:
    """Split the filtered ventes set into discounted vs full-price aggregates.
    Drives the /ventes remise-discipline gauge: high discounted share = the
    team is giving away margin too often. Mirrors achat_supplier_summary
    structure (MAD + count + units per side, NO surveillance filter)."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="ventes")
    base = _apply_vente_filters(
        db.query(Vente), pharmacy_id,
        date_from=date_from, date_to=date_to, search=search,
        category=category, tva=tva, include_non_declared=True,
    )

    is_discounted = (Vente.discount.isnot(None)) & (Vente.discount > 0)

    def _agg(filter_clause) -> dict:
        row = base.with_entities(
            func.coalesce(func.sum(Vente.total),    0.0).label("total"),
            func.coalesce(func.sum(Vente.quantity), 0.0).label("units"),
            func.count(Vente.id).label("lines"),
        ).filter(filter_clause).one()
        return {
            "total_mad":  float(row.total or 0.0),
            "unit_count": float(row.units or 0.0),
            "count":      int(row.lines or 0),
        }

    return {
        "discounted": _agg(is_discounted),
        "full_price": _agg(~is_discounted),
    }