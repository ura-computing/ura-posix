"""Admin variants of the Rapport endpoints.

`/v1/admin/stats` returns system-wide tile counts (Vue système).
`/v1/admin/pharmacies` powers the pharmacy selector dropdown.
`/v1/admin/pharmacy/{id}/stats[/...]` mirror the owner endpoints, but the target
pharmacy_id comes from the path (admin can pick any) instead of the JWT.

All endpoints raise 403 for non-admin callers.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query, status
from sqlalchemy import func, or_

from database import DbDep
from models import Medicament, Pharmacy, User
from schemas.stats import (
    AdminPharmacyRow,
    AdminStatsResponse,
    AnalyseMargeResponse,
    MarginAlertsResponse,
    MargeMode,
    StatsResponse,
    StockSummaryResponse,
)
from security import CurrentUserDep
from stats_queries import compute_margin_alerts, compute_stock_summary
from analyse_queries import compute_analyse_marge

from .stats import (
    CategoryTypeQ,
    DateFromQ,
    DateToQ,
    IncludeNonDeclQ,
    build_stats_payload,
)


router = APIRouter(tags=["admin-stats"])

PharmacyIdPath = Annotated[int, Path(ge=1, description="Target pharmacy id")]


def _require_admin(user) -> None:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Réservé aux administrateurs")


@router.get("/admin/stats", response_model=AdminStatsResponse)
def admin_stats(user: CurrentUserDep, db: DbDep) -> dict:
    """System overview (4 tiles for the Vue système section).

    Counts honor soft-delete (`Pharmacy.archived_at IS NULL`) and exclude
    admins from `total_active_users` — admins are a system role, not an
    end-user of the platform. Users tied to an archived pharmacy are
    excluded too (their pharmacy no longer counts, so they shouldn't either)."""
    _require_admin(user)
    active_pharm_ids = (
        db.query(Pharmacy.id).filter(Pharmacy.archived_at.is_(None)).subquery().select()
    )
    return {
        "total_pharmacies": db.query(func.count(Pharmacy.id))
                              .filter(Pharmacy.archived_at.is_(None)).scalar() or 0,
        "total_active_users": db.query(func.count(User.id)).filter(
            User.status == "active",
            User.role != "admin",
            or_(User.pharmacy_id.is_(None), User.pharmacy_id.in_(active_pharm_ids)),
        ).scalar() or 0,
        "total_catalog_items":      db.query(func.count(Medicament.id)).scalar() or 0,
        "pending_catalog_requests": 0,   # catalog-request feature lands later
    }


# NOTE: GET /admin/pharmacies moved to routers/admin_pharmacies.py — the new
# endpoint returns a superset (id/name/code + members count + enabled features)
# that the PharmacyPicker dropdown still consumes correctly via its narrow type.


@router.get("/admin/pharmacy/{pharmacy_id}/stats", response_model=StatsResponse)
def admin_pharmacy_stats(
    pharmacy_id: PharmacyIdPath,
    user: CurrentUserDep,
    db: DbDep,
    date_from: DateFromQ            = None,
    date_to:   DateToQ              = None,
    category_type:        CategoryTypeQ   = "all",
    include_non_declared: IncludeNonDeclQ = False,
) -> dict:
    """Same shape as /v1/stats, scoped to the path-provided pharmacy."""
    _require_admin(user)
    return build_stats_payload(db, pharmacy_id, date_from or None, date_to or None,
                               category_type, include_non_declared)


@router.get("/admin/pharmacy/{pharmacy_id}/stats/margin-alerts", response_model=MarginAlertsResponse)
def admin_pharmacy_margin_alerts(
    pharmacy_id: PharmacyIdPath,
    user: CurrentUserDep,
    db: DbDep,
    date_from: DateFromQ          = None,
    date_to:   DateToQ            = None,
    category_type: CategoryTypeQ  = "all",
) -> dict:
    _require_admin(user)
    return compute_margin_alerts(db, pharmacy_id, date_from or None, date_to or None, category_type)


@router.get("/admin/pharmacy/{pharmacy_id}/stats/stock-summary", response_model=StockSummaryResponse)
def admin_pharmacy_stock_summary(pharmacy_id: PharmacyIdPath, user: CurrentUserDep, db: DbDep) -> dict:
    _require_admin(user)
    return compute_stock_summary(db, pharmacy_id)


@router.get("/admin/pharmacy/{pharmacy_id}/stats/analyse-marge", response_model=AnalyseMargeResponse)
def admin_pharmacy_analyse_marge(
    pharmacy_id:    PharmacyIdPath,
    user:           CurrentUserDep,
    db:             DbDep,
    mode:           Annotated[MargeMode, Query(description="produit | categorie | grossiste | bl")],
    date_from:      DateFromQ      = None,
    date_to:        DateToQ        = None,
    category_type:  CategoryTypeQ  = "all",
) -> dict:
    """Admin variant of /stats/analyse-marge. Same shape, pharmacy from path."""
    _require_admin(user)
    if mode == MargeMode.LISTE:
        raise HTTPException(status_code=400, detail="Le mode liste n'est pas supporté en admin.")
    payload = compute_analyse_marge(db, pharmacy_id, date_from or None, date_to or None,
                                    category_type, mode.value)
    return {"mode": mode.value, **payload}