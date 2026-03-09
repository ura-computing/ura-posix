import re
from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Date, func
from sqlalchemy.orm import Session

from database import get_db
from models import Achat, CatalogRequest, Medicament, Pharmacy, User, Vente
from routers.auth import get_current_user

router = APIRouter(tags=["stats"])

_PCT_RE = re.compile(r"\s*\(\d+\.?\d*%\)")


def _strip_pct(s: str) -> str:
    return _PCT_RE.sub("", s).strip() if s else s


def _month_label(d: date) -> str:
    return d.strftime("%Y-%m")


# ── Owner / Employee pharmacy stats ───────────────────────────────────────────

@router.get("/stats")
def get_stats(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "admin":
        raise HTTPException(status_code=403, detail="Admins use /admin/stats")

    pharmacy_id = current_user.pharmacy_id

    # Keep as strings for VARCHAR comparisons (ISO format sorts lexicographically)
    df = date_from or None
    dt = date_to or None

    # ── KPIs ──────────────────────────────────────────────────────────────────

    vq = db.query(func.sum(Vente.total), func.count(Vente.id))
    aq = db.query(func.sum(Achat.total), func.count(Achat.id))

    if pharmacy_id:
        vq = vq.filter(Vente.pharmacy_id == pharmacy_id)
        aq = aq.filter(Achat.pharmacy_id == pharmacy_id)
    if df:
        vq = vq.filter(Vente.date >= df)
        aq = aq.filter(Achat.delivery_date >= df)
    if dt:
        vq = vq.filter(Vente.date <= dt)
        aq = aq.filter(Achat.delivery_date <= dt)

    ventes_total, ventes_count = vq.one()
    achats_total, achats_count = aq.one()

    # ── Monthly trend ─────────────────────────────────────────────────────────

    today = date.today()
    twelve_months_ago = (today.replace(day=1) - timedelta(days=335)).replace(day=1)

    # Effective range: honour date filter, fall back to last 12 months
    trend_start = date.fromisoformat(df).replace(day=1) if df else twelve_months_ago
    trend_end = date.fromisoformat(dt).replace(day=1) if dt else today.replace(day=1)
    trend_start_str = trend_start.strftime("%Y-%m-%d")
    trend_end_str = (
        date(trend_end.year, trend_end.month + 1, 1).strftime("%Y-%m-%d")
        if trend_end.month < 12
        else date(trend_end.year + 1, 1, 1).strftime("%Y-%m-%d")
    )

    v_trend_q = (
        db.query(
            func.date_trunc("month", func.cast(Vente.date, Date)).label("month"),
            func.sum(Vente.total).label("total"),
        )
        .filter(Vente.date >= trend_start_str, Vente.date < trend_end_str)
    )
    a_trend_q = (
        db.query(
            func.date_trunc("month", func.cast(Achat.delivery_date, Date)).label("month"),
            func.sum(Achat.total).label("total"),
        )
        .filter(Achat.delivery_date >= trend_start_str, Achat.delivery_date < trend_end_str)
    )

    if pharmacy_id:
        v_trend_q = v_trend_q.filter(Vente.pharmacy_id == pharmacy_id)
        a_trend_q = a_trend_q.filter(Achat.pharmacy_id == pharmacy_id)

    v_by_month = {_month_label(r.month.date()): float(r.total or 0) for r in v_trend_q.group_by("month").all()}
    a_by_month = {_month_label(r.month.date()): float(r.total or 0) for r in a_trend_q.group_by("month").all()}

    # Build continuous month list for the effective range
    monthly_trend = []
    cursor = trend_start
    while cursor <= trend_end:
        label = _month_label(cursor)
        monthly_trend.append({
            "month": label,
            "ventes": v_by_month.get(label, 0.0),
            "achats": a_by_month.get(label, 0.0),
        })
        if cursor.month == 12:
            cursor = cursor.replace(year=cursor.year + 1, month=1)
        else:
            cursor = cursor.replace(month=cursor.month + 1)

    # ── Top categories (by ventes) ────────────────────────────────────────────

    cat_q = (
        db.query(
            Medicament.category.label("category"),
            func.sum(Vente.total).label("total"),
        )
        .join(Medicament, Vente.medicament_id == Medicament.id)
        .filter(Medicament.category.isnot(None))
    )
    if pharmacy_id:
        cat_q = cat_q.filter(Vente.pharmacy_id == pharmacy_id)
    if df:
        cat_q = cat_q.filter(Vente.date >= df)
    if dt:
        cat_q = cat_q.filter(Vente.date <= dt)

    cat_rows = (
        cat_q.group_by(Medicament.category)
        .order_by(func.sum(Vente.total).desc())
        .limit(5)
        .all()
    )
    top_categories = [
        {"category": _strip_pct(r.category), "total": float(r.total or 0)}
        for r in cat_rows
    ]

    return {
        "kpis": {
            "ventes_total": float(ventes_total or 0),
            "achats_total": float(achats_total or 0),
            "ventes_count": ventes_count or 0,
            "achats_count": achats_count or 0,
        },
        "monthly_trend": monthly_trend,
        "top_categories": top_categories,
    }


# ── Admin system stats ────────────────────────────────────────────────────────

@router.get("/admin/stats")
def get_admin_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    total_pharmacies = db.query(func.count(Pharmacy.id)).scalar() or 0
    total_active_users = db.query(func.count(User.id)).filter(User.status == "active").scalar() or 0
    total_catalog_items = db.query(func.count(Medicament.id)).scalar() or 0
    pending_catalog_requests = (
        db.query(func.count(CatalogRequest.id))
        .filter(CatalogRequest.status == "pending")
        .scalar() or 0
    )

    return {
        "total_pharmacies": total_pharmacies,
        "total_active_users": total_active_users,
        "total_catalog_items": total_catalog_items,
        "pending_catalog_requests": pending_catalog_requests,
    }
