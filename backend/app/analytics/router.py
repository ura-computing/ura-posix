"""Stats endpoints: the owner's own pharmacy, and the admin's view of any pharmacy.
SQL lives in stats_queries / analyse_queries / stock_queries."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path, Query
from sqlalchemy import func, or_

from app.analytics.analyse_queries import compute_analyse_liste, compute_analyse_marge
from app.core.database import DbDep
from app.core.errors import ApiError, ErrorCode
from app.core.models import Medicament, Pharmacy, User
from app.core.permissions import admin_only, member
from app.analytics.schemas import (
    AdminStatsResponse,
    AnalyseMargeResponse,
    ListeRequest,
    MargeMode,
    MarginAlertsResponse,
    PeremptionsResponse,
    StatsResponse,
    StockAbcdResponse,
    StockSummaryResponse,
    VentesSansAchatResponse,
)
from app.analytics.stats_queries import (
    build_stats_payload,
    compute_margin_alerts,
    compute_stock_summary,
    compute_ventes_sans_achat,
)
from app.analytics.stock_queries import compute_peremptions, compute_stock_abcd


router = APIRouter(tags=["stats"])


# ═══ Owner stats ═════════════════════════════════════════════════════════════
# Dashboard / Rapport endpoints. Owner-scoped here; admin equivalents will be
# mounted under /v1/admin in a separate router.

DateFromQ = Annotated[str | None, Query(description="ISO date (YYYY-MM-DD), inclusive")]
DateToQ = Annotated[str | None, Query(description="ISO date (YYYY-MM-DD), inclusive")]
CategoryTypeQ = Annotated[str, Query(description="all | pharmacie | parapharmacie")]
IncludeNonDeclQ = Annotated[bool, Query(description="Include products marked non-declared")]


@router.get("/stats", response_model=StatsResponse)
def get_stats(
    pharmacy_id: Annotated[int, member("rapports")],
    db: DbDep,
    date_from: DateFromQ = None,
    date_to: DateToQ = None,
    category_type: CategoryTypeQ = "all",  # all | pharmacie | parapharmacie
    include_non_declared: IncludeNonDeclQ = False,
) -> dict:
    """Owner dashboard payload. Admins use /v1/admin/pharmacy/{id}/stats."""
    return build_stats_payload(db, pharmacy_id, date_from or None, date_to or None, category_type, include_non_declared)


@router.get("/stats/margin-alerts", response_model=MarginAlertsResponse)
def get_margin_alerts(
    pharmacy_id: Annotated[int, member("alertes")],
    db: DbDep,
    date_from: DateFromQ = None,
    date_to: DateToQ = None,
    category_type: CategoryTypeQ = "all",
) -> dict:
    """4 brackets feeding Rapport Section 5 ('Alertes marges') + the /alertes drill-down."""
    return compute_margin_alerts(db, pharmacy_id, date_from or None, date_to or None, category_type)


@router.get("/stats/ventes-sans-achat", response_model=VentesSansAchatResponse)
def get_ventes_sans_achat(
    pharmacy_id: Annotated[int, member("alertes")],
    db: DbDep,
    date_from: DateFromQ = None,
    date_to: DateToQ = None,
    category_type: CategoryTypeQ = "all",
) -> dict:
    """Products with ventes in the window but no matching achat — the root cause
    of "—" cells in Marge %/DH on /ventes."""
    return compute_ventes_sans_achat(db, pharmacy_id, date_from or None, date_to or None, category_type)


@router.get("/stats/stock-summary", response_model=StockSummaryResponse)
def get_stock_summary(pharmacy_id: Annotated[int, member("stock")], db: DbDep) -> dict:
    """Lightweight 4-tile summary for Rapport Section 8. Full ABCD classification
    ships when /stock page is built."""
    return compute_stock_summary(db, pharmacy_id)


# ─── Stock ABCD + Peremptions (Page 6) ───────────────────────────────────────

StatusQ = Annotated[
    str | None, Query(description="Comma-separated: sous-stock,ideal,a-surveiller,sur-stock,inconnu,negatif")
]
ClassQ = Annotated[str | None, Query(description="A | A- | B+ | B | C | C- | C-N | D")]


@router.get("/stats/stock-abcd", response_model=StockAbcdResponse)
def get_stock_abcd(
    pharmacy_id: Annotated[int, member("stock")],
    db: DbDep,
    date_from: DateFromQ = None,
    date_to: DateToQ = None,
    class_filter: ClassQ = None,
    status: StatusQ = None,
    sort_by: Annotated[str | None, Query()] = None,
    sort_order: Annotated[str | None, Query()] = None,
) -> dict:
    """ABCD analysis + filtered product list. Distribution + total_references +
    ppv_potentiel reflect the FULL dataset; only `products` is filtered/sorted."""
    return compute_stock_abcd(
        db,
        pharmacy_id,
        date_from,
        date_to,
        class_filter=class_filter,
        status=status,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.get("/stats/peremptions", response_model=PeremptionsResponse)
def get_peremptions(pharmacy_id: Annotated[int, member("stock")], db: DbDep) -> dict:
    """4 mutually-exclusive expiry-proximity buckets (old-app parity): expired /
    very_close (<6 months) / close (6-12 months) / no_date (NULL expiry_date)."""
    return compute_peremptions(db, pharmacy_id)


# ─── Analyse de marge — 8 modes (Page 11) ────────────────────────────────────

ModeQ = Annotated[
    MargeMode, Query(description="produit | categorie | laboratoire | grossiste | operateur | mois | annee")
]


@router.get("/stats/analyse-marge", response_model=AnalyseMargeResponse)
def get_analyse_marge(
    pharmacy_id: Annotated[int, member("analyse")],
    db: DbDep,
    mode: ModeQ,
    date_from: DateFromQ = None,
    date_to: DateToQ = None,
    category_type: CategoryTypeQ = "all",
    product: str | None = None,
) -> dict:
    """7 group-by modes for /analyse. Liste mode uses POST /stats/analyse-liste below.

    `product` is an optional product-name filter used by the année mode search box."""
    if mode == MargeMode.LISTE:
        raise ApiError(400, ErrorCode.LISTE_MODE_USE_POST, "Utilisez POST /stats/analyse-liste pour le mode liste")
    payload = compute_analyse_marge(db, pharmacy_id, date_from, date_to, category_type, mode.value, product=product)
    return {"mode": mode.value, **payload}


@router.post("/stats/analyse-liste", response_model=AnalyseMargeResponse)
def post_analyse_liste(pharmacy_id: Annotated[int, member("analyse")], db: DbDep, body: ListeRequest) -> dict:
    """Match an uploaded product list against the pharmacy's catalogue + ventes.
    Returns the same shape as analyse-marge (produit mode) but every row has
    `match_status` set ('found' | 'not_found'). Not-found rows pinned at end."""
    payload = compute_analyse_liste(db, pharmacy_id, body.items, body.date_from, body.date_to, body.category_type)
    return {"mode": MargeMode.LISTE.value, **payload}


# ═══ Admin stats (any pharmacy) ══════════════════════════════════════════════
# Admin variants of the Rapport endpoints.
#
# `/v1/admin/stats` returns system-wide tile counts (Vue système).
# `/v1/admin/pharmacies` powers the pharmacy selector dropdown.
# `/v1/admin/pharmacy/{id}/stats[/...]` mirror the owner endpoints, but the target
# pharmacy_id comes from the path (admin can pick any) instead of the JWT.
#
# All endpoints raise 403 for non-admin callers.

PharmacyIdPath = Annotated[int, Path(ge=1, description="Target pharmacy id")]


@router.get("/admin/stats", response_model=AdminStatsResponse, dependencies=[admin_only])
def admin_stats(db: DbDep) -> dict:
    """System overview (4 tiles for the Vue système section).

    Counts honor soft-delete (`Pharmacy.archived_at IS NULL`) and exclude
    admins from `total_active_users` — admins are a system role, not an
    end-user of the platform. Users tied to an archived pharmacy are
    excluded too (their pharmacy no longer counts, so they shouldn't either)."""
    active_pharm_ids = db.query(Pharmacy.id).filter(Pharmacy.archived_at.is_(None)).subquery().select()
    return {
        "total_pharmacies": db.query(func.count(Pharmacy.id)).filter(Pharmacy.archived_at.is_(None)).scalar() or 0,
        "total_active_users": db.query(func.count(User.id))
        .filter(
            User.status == "active",
            User.role != "admin",
            or_(User.pharmacy_id.is_(None), User.pharmacy_id.in_(active_pharm_ids)),
        )
        .scalar()
        or 0,
        "total_catalog_items": db.query(func.count(Medicament.id)).scalar() or 0,
        "pending_catalog_requests": 0,  # catalog-request feature lands later
    }


# NOTE: GET /admin/pharmacies moved to members/admin_router.py — the new
# endpoint returns a superset (id/name/code + members count + enabled features)
# that the PharmacyPicker dropdown still consumes correctly via its narrow type.


@router.get("/admin/pharmacy/{pharmacy_id}/stats", response_model=StatsResponse, dependencies=[admin_only])
def admin_pharmacy_stats(
    pharmacy_id: PharmacyIdPath,
    db: DbDep,
    date_from: DateFromQ = None,
    date_to: DateToQ = None,
    category_type: CategoryTypeQ = "all",
    include_non_declared: IncludeNonDeclQ = False,
) -> dict:
    """Same shape as /v1/stats, scoped to the path-provided pharmacy."""
    return build_stats_payload(db, pharmacy_id, date_from or None, date_to or None, category_type, include_non_declared)


@router.get(
    "/admin/pharmacy/{pharmacy_id}/stats/margin-alerts", response_model=MarginAlertsResponse, dependencies=[admin_only]
)
def admin_pharmacy_margin_alerts(
    pharmacy_id: PharmacyIdPath,
    db: DbDep,
    date_from: DateFromQ = None,
    date_to: DateToQ = None,
    category_type: CategoryTypeQ = "all",
) -> dict:
    return compute_margin_alerts(db, pharmacy_id, date_from or None, date_to or None, category_type)


@router.get(
    "/admin/pharmacy/{pharmacy_id}/stats/stock-summary", response_model=StockSummaryResponse, dependencies=[admin_only]
)
def admin_pharmacy_stock_summary(pharmacy_id: PharmacyIdPath, db: DbDep) -> dict:
    return compute_stock_summary(db, pharmacy_id)


@router.get(
    "/admin/pharmacy/{pharmacy_id}/stats/analyse-marge", response_model=AnalyseMargeResponse, dependencies=[admin_only]
)
def admin_pharmacy_analyse_marge(
    pharmacy_id: PharmacyIdPath,
    db: DbDep,
    mode: Annotated[MargeMode, Query(description="produit | categorie | grossiste | bl")],
    date_from: DateFromQ = None,
    date_to: DateToQ = None,
    category_type: CategoryTypeQ = "all",
) -> dict:
    """Admin variant of /stats/analyse-marge. Same shape, pharmacy from path."""
    if mode == MargeMode.LISTE:
        raise ApiError(400, ErrorCode.LISTE_MODE_ADMIN, "Le mode liste n'est pas supporté en admin.")
    payload = compute_analyse_marge(db, pharmacy_id, date_from or None, date_to or None, category_type, mode.value)
    return {"mode": mode.value, **payload}
