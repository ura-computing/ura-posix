"""Dashboard / Rapport endpoints. Owner-scoped here; admin equivalents will be
mounted under /v1/admin in a separate router."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Query as OrmQuery

from analyse_queries import compute_analyse_liste, compute_analyse_marge
from database import DbDep
from exclusions import achat_bl_filter
from models import Achat, Medicament, PharmacyMedicamentStatus, Vente
from permissions import require_pharmacy_owner
from schemas.stats import (
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
from stock_queries import compute_peremptions, compute_stock_abcd
from security import CurrentUserDep
from stats_queries import (
    build_monthly_trend,
    compute_extra_stats,
    compute_margin_alerts,
    compute_previous_kpis,
    compute_stock_summary,
    compute_ventes_sans_achat,
    merge_top_categories,
    pharma_expr,
    reconcile_marge_to_ca,
)


router = APIRouter(tags=["stats"])


DateFromQ        = Annotated[str | None, Query(description="ISO date (YYYY-MM-DD), inclusive")]
DateToQ          = Annotated[str | None, Query(description="ISO date (YYYY-MM-DD), inclusive")]
CategoryTypeQ    = Annotated[str,        Query(description="all | pharmacie | parapharmacie")]
IncludeNonDeclQ  = Annotated[bool,       Query(description="Include products marked non-declared")]


def _category_filters(category_type: str) -> tuple[list, list]:
    """Returns (cat_filter_v, cat_filter_a) for Vente + Achat sides."""
    if category_type == "pharmacie":
        return [pharma_expr() == True], [pharma_expr() == True]
    if category_type == "parapharmacie":
        return [pharma_expr() == False], [pharma_expr() == False]
    return [], []


def _non_declared_sub_for(db, pharmacy_id: int):
    """Scalar subquery of non-declared medicament_ids for this pharmacy."""
    return (
        db.query(PharmacyMedicamentStatus.medicament_id)
        .filter(
            PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
            PharmacyMedicamentStatus.declared == False,
        )
        .scalar_subquery()
    )


def _topline_kpis(db, pharmacy_id, df, dt, cat_filter_v, cat_filter_a, non_declared_sub) -> dict:
    """ventes_total/count + achats_total/count for the window."""
    vq = (
        db.query(
            func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)),
            func.count(Vente.id),
        )
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
    )
    aq = db.query(func.sum(Achat.total), func.count(Achat.id))
    if cat_filter_v: vq = vq.filter(*cat_filter_v)
    if cat_filter_a:
        aq = aq.join(Medicament, Achat.medicament_id == Medicament.id, isouter=True).filter(*cat_filter_a)
    if pharmacy_id:
        vq = vq.filter(Vente.pharmacy_id == pharmacy_id)
        aq = aq.filter(Achat.pharmacy_id == pharmacy_id, achat_bl_filter(db, pharmacy_id))
    if non_declared_sub is not None:
        vq = vq.filter(Vente.medicament_id.notin_(non_declared_sub))
        aq = aq.filter(Achat.medicament_id.notin_(non_declared_sub))
    if df:
        vq = vq.filter(Vente.date >= df)
        aq = aq.filter(Achat.delivery_date >= df)
    if dt:
        vq = vq.filter(Vente.date <= dt)
        aq = aq.filter(Achat.delivery_date <= dt)
    ventes_total, ventes_count = vq.one()
    achats_total, achats_count = aq.one()
    return {
        "ventes_total": float(ventes_total or 0),
        "achats_total": float(achats_total or 0),
        "ventes_count": ventes_count or 0,
        "achats_count": achats_count or 0,
    }


def _top_categories(db, pharmacy_id, df, dt, cat_filter_v, non_declared_sub) -> list[dict]:
    """Aggregate Vente by category, merge percent suffixes, sort by CA desc."""
    avg_pu_sub = (
        db.query(
            Achat.medicament_id,
            (func.sum(Achat.unit_price * Achat.quantity) / func.sum(Achat.quantity)).label("pu"),
        )
        .filter(Achat.quantity > 0, Achat.unit_price.isnot(None))
    )
    if pharmacy_id:
        avg_pu_sub = avg_pu_sub.filter(Achat.pharmacy_id == pharmacy_id)
    avg_pu_sub = avg_pu_sub.group_by(Achat.medicament_id).subquery()

    q: OrmQuery = (
        db.query(
            Medicament.category.label("category"),
            func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)).label("total"),
            func.sum(Vente.quantity).label("qty"),
            func.avg(func.coalesce(avg_pu_sub.c.pu, Medicament.pph)).label("avg_pu"),
            func.avg(Medicament.ppv).label("avg_ppv"),
        )
        .join(Medicament, Vente.medicament_id == Medicament.id)
        .outerjoin(avg_pu_sub, Medicament.id == avg_pu_sub.c.medicament_id)
        .filter(Medicament.category.isnot(None))
    )
    if cat_filter_v: q = q.filter(*cat_filter_v)
    if pharmacy_id:  q = q.filter(Vente.pharmacy_id == pharmacy_id)
    if non_declared_sub is not None:
        q = q.filter(Vente.medicament_id.notin_(non_declared_sub))
    if df: q = q.filter(Vente.date >= df)
    if dt: q = q.filter(Vente.date <= dt)
    return merge_top_categories(q.group_by(Medicament.category).all())


def build_stats_payload(
    db,
    pharmacy_id: int | None,
    df: str | None,
    dt: str | None,
    category_type: str,
    include_non_declared: bool,
) -> dict:
    """Pure data computation — used by both owner `/v1/stats` and admin
    `/v1/admin/pharmacy/{id}/stats`. No auth, no HTTP."""
    cat_filter_v, cat_filter_a = _category_filters(category_type)
    non_declared_sub = None
    if pharmacy_id and not include_non_declared:
        non_declared_sub = _non_declared_sub_for(db, pharmacy_id)

    trend = build_monthly_trend(db, pharmacy_id, df, dt, non_declared_sub, cat_filter_v, cat_filter_a)
    kpis  = _topline_kpis(db, pharmacy_id, df, dt, cat_filter_v, cat_filter_a, non_declared_sub)
    extra = compute_extra_stats(db, pharmacy_id, df, dt, category_type)
    # Single source of truth: reconcile the aggregate marge to the FULL CA so every
    # margin display agrees (marge_brute_dh / ventes_total == marge_pct, exactly).
    reconcile_marge_to_ca(extra["marge"], kpis["ventes_total"])
    return {
        "kpis":           kpis,
        "previous_kpis":  compute_previous_kpis(db, pharmacy_id, df, dt, cat_filter_v, cat_filter_a, non_declared_sub),
        **extra,
        "monthly_trend":     trend["points"],
        "trend_granularity": trend["granularity"],
        "top_categories": _top_categories(db, pharmacy_id, df, dt, cat_filter_v, non_declared_sub),
    }


@router.get("/stats", response_model=StatsResponse)
def get_stats(
    user: CurrentUserDep,
    db: DbDep,
    date_from: DateFromQ            = None,
    date_to:   DateToQ              = None,
    category_type:        CategoryTypeQ   = "all",     # all | pharmacie | parapharmacie
    include_non_declared: IncludeNonDeclQ = False,
) -> dict:
    """Owner dashboard payload. Admins use /v1/admin/pharmacy/{id}/stats."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="rapports")
    return build_stats_payload(db, pharmacy_id, date_from or None, date_to or None,
                               category_type, include_non_declared)


@router.get("/stats/margin-alerts", response_model=MarginAlertsResponse)
def get_margin_alerts(
    user: CurrentUserDep,
    db: DbDep,
    date_from: DateFromQ            = None,
    date_to:   DateToQ              = None,
    category_type: CategoryTypeQ    = "all",
) -> dict:
    """4 brackets feeding Rapport Section 5 ('Alertes marges') + the /alertes drill-down."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="alertes")
    return compute_margin_alerts(db, pharmacy_id, date_from or None, date_to or None, category_type)


@router.get("/stats/ventes-sans-achat", response_model=VentesSansAchatResponse)
def get_ventes_sans_achat(
    user: CurrentUserDep,
    db: DbDep,
    date_from: DateFromQ         = None,
    date_to:   DateToQ           = None,
    category_type: CategoryTypeQ = "all",
) -> dict:
    """Products with ventes in the window but no matching achat — the root cause
    of "—" cells in Marge %/DH on /ventes."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="alertes")
    return compute_ventes_sans_achat(db, pharmacy_id, date_from or None, date_to or None, category_type)


@router.get("/stats/stock-summary", response_model=StockSummaryResponse)
def get_stock_summary(user: CurrentUserDep, db: DbDep) -> dict:
    """Lightweight 4-tile summary for Rapport Section 8. Full ABCD classification
    ships when /stock page is built."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="stock")
    return compute_stock_summary(db, pharmacy_id)

# ─── Stock ABCD + Peremptions (Page 6) ───────────────────────────────────────

StatusQ = Annotated[str | None, Query(description="Comma-separated: sous-stock,ideal,a-surveiller,sur-stock,inconnu,negatif")]
ClassQ  = Annotated[str | None, Query(description="A | A- | B+ | B | C | C- | C-N | D")]


@router.get("/stats/stock-abcd", response_model=StockAbcdResponse)
def get_stock_abcd(
    user: CurrentUserDep,
    db:   DbDep,
    date_from:    DateFromQ  = None,
    date_to:      DateToQ    = None,
    class_filter: ClassQ     = None,
    status:       StatusQ    = None,
    search:       Annotated[str | None, Query()] = None,
    sort_by:      Annotated[str | None, Query()] = None,
    sort_order:   Annotated[str | None, Query()] = None,
) -> dict:
    """ABCD analysis + filtered product list. Distribution + total_references +
    ppv_potentiel reflect the FULL dataset; only `products` is filtered/sorted."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="stock")
    return compute_stock_abcd(
        db, pharmacy_id, date_from, date_to,
        class_filter=class_filter, status=status, search=search,
        sort_by=sort_by, sort_order=sort_order,
    )


@router.get("/stats/peremptions", response_model=PeremptionsResponse)
def get_peremptions(user: CurrentUserDep, db: DbDep) -> dict:
    """4 mutually-exclusive expiry-proximity buckets (old-app parity): expired /
    very_close (<6 months) / close (6-12 months) / no_date (NULL expiry_date)."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="stock")
    return compute_peremptions(db, pharmacy_id)


# ─── Analyse de marge — 8 modes (Page 11) ────────────────────────────────────

ModeQ = Annotated[MargeMode, Query(description="produit | categorie | laboratoire | grossiste | operateur | mois | annee")]


@router.get("/stats/analyse-marge", response_model=AnalyseMargeResponse)
def get_analyse_marge(
    user: CurrentUserDep,
    db:   DbDep,
    mode:          ModeQ,
    date_from:     DateFromQ     = None,
    date_to:       DateToQ       = None,
    category_type: CategoryTypeQ = "all",
) -> dict:
    """7 group-by modes for /analyse. Liste mode uses POST /stats/analyse-liste below."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="analyse")
    if mode == MargeMode.LISTE:
        raise HTTPException(status_code=400, detail="Utilisez POST /stats/analyse-liste pour le mode liste")
    payload = compute_analyse_marge(db, pharmacy_id, date_from, date_to, category_type, mode.value)
    return {"mode": mode.value, **payload}


@router.post("/stats/analyse-liste", response_model=AnalyseMargeResponse)
def post_analyse_liste(user: CurrentUserDep, db: DbDep, body: ListeRequest) -> dict:
    """Match an uploaded product list against the pharmacy's catalogue + ventes.
    Returns the same shape as analyse-marge (produit mode) but every row has
    `match_status` set ('found' | 'not_found'). Not-found rows pinned at end."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="analyse")
    payload = compute_analyse_liste(db, pharmacy_id, body.items,
                                    body.date_from, body.date_to, body.category_type)
    return {"mode": MargeMode.LISTE.value, **payload}
