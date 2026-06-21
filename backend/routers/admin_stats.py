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
from sqlalchemy import func

from database import DbDep
from models import Medicament, Pharmacy, User
from schemas.stats import (
    AdminPharmacyRow,
    AdminStatsResponse,
    MarginAlertsResponse,
    StatsResponse,
    StockSummaryResponse,
)
from security import CurrentUserDep
from stats_queries import compute_margin_alerts, compute_stock_summary

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
    """System overview (4 tiles for the Vue système section)."""
    _require_admin(user)
    return {
        "total_pharmacies":         db.query(func.count(Pharmacy.id)).scalar() or 0,
        "total_active_users":       db.query(func.count(User.id)).filter(User.status == "active").scalar() or 0,
        "total_catalog_items":      db.query(func.count(Medicament.id)).scalar() or 0,
        "pending_catalog_requests": 0,   # catalog-request feature lands later
    }


@router.get("/admin/pharmacies", response_model=list[AdminPharmacyRow])
def admin_pharmacies(user: CurrentUserDep, db: DbDep) -> list[dict]:
    """Lightweight list for the pharmacy-picker dropdown — id, name, code only."""
    _require_admin(user)
    rows = db.query(Pharmacy.id, Pharmacy.name, Pharmacy.code).order_by(Pharmacy.name).all()
    return [{"id": r.id, "name": r.name, "code": r.code} for r in rows]


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