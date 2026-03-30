import re
from datetime import date, timedelta
from typing import Optional

from sqlalchemy import Date, case as sa_case, func
from sqlalchemy.orm import Session

from models import Achat, Medicament, PharmacyMedicamentStatus, Vente
from utils.strings import strip_percentage as _strip_pct


def _pharma_expr():
    """SQLAlchemy expression: True = pharmacie, False = parapharmacie.
    Admin product_type override takes precedence; falls back to category keywords."""
    auto = sa_case(
        (func.lower(Medicament.category).contains("edicament"), True),
        (func.lower(Medicament.category).contains("oméopath"), True),
        (func.lower(Medicament.category).contains("omeopath"), True),
        else_=False,
    )
    return sa_case(
        (Medicament.product_type == "pharmacie", True),
        (Medicament.product_type == "parapharmacie", False),
        else_=auto,
    )


def _merge_top_categories(rows, n: int = 5) -> list:
    """Merge rows that share the same stripped category name, return top n by total."""
    totals: dict[str, float] = {}
    for r in rows:
        key = _strip_pct(r.category)
        totals[key] = totals.get(key, 0.0) + float(r.total or 0)
    return sorted(
        [{"category": k, "total": round(v, 2)} for k, v in totals.items()],
        key=lambda x: x["total"],
        reverse=True,
    )[:n]


def _month_label(d: date) -> str:
    return d.strftime("%Y-%m")


def _parse_tva_rate(tva_str) -> float:
    """Parse '12.5%' → 0.125, None → 0.0"""
    if not tva_str:
        return 0.0
    m = re.search(r"([\d.]+)", str(tva_str))
    return float(m.group(1)) / 100 if m else 0.0


def _resolve_type(product_type, category) -> str:
    if product_type:
        return product_type.capitalize()
    cat = (category or "").lower()
    if "edicament" in cat or "oméopath" in cat or "omeopath" in cat:
        return "Pharmacie"
    return "Parapharmacie"


def _fetch_med_rows(db, pharmacy_id, df, dt, cat_filter=None, non_declared_sub=None):
    # Build achat filters matching the same scope for avg purchase price
    achat_filters: list = []
    if pharmacy_id:
        achat_filters.append(Achat.pharmacy_id == pharmacy_id)
    if df:
        achat_filters.append(Achat.delivery_date >= df)
    if dt:
        achat_filters.append(Achat.delivery_date <= dt)
    if non_declared_sub is not None:
        achat_filters.append(Achat.medicament_id.notin_(non_declared_sub))

    avg_pu_sub = (
        db.query(
            Achat.medicament_id,
            (func.sum(Achat.unit_price * Achat.quantity) / func.sum(Achat.quantity)).label("avg_pu"),
        )
        .filter(*achat_filters)
        .group_by(Achat.medicament_id)
        .subquery()
    )

    q = db.query(
        Medicament.product,
        Medicament.category,
        Medicament.tva,
        Medicament.product_type,
        avg_pu_sub.c.avg_pu,
        Medicament.ppv,
        func.sum(Vente.quantity).label("qty"),
        func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)).label("total"),
    ).join(Medicament, Vente.medicament_id == Medicament.id
    ).outerjoin(avg_pu_sub, Medicament.id == avg_pu_sub.c.medicament_id)
    if pharmacy_id:
        q = q.filter(Vente.pharmacy_id == pharmacy_id)
    if non_declared_sub is not None:
        q = q.filter(Vente.medicament_id.notin_(non_declared_sub))
    if df:
        q = q.filter(Vente.date >= df)
    if dt:
        q = q.filter(Vente.date <= dt)
    if cat_filter:
        q = q.filter(*cat_filter)
    return (
        q.group_by(
            Medicament.id, Medicament.product, Medicament.category,
            Medicament.tva, Medicament.product_type,
            avg_pu_sub.c.avg_pu, Medicament.ppv,
        )
        .order_by(func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)).desc())
        .all()
    )


def _compute_extra_stats(db: Session, pharmacy_id, df, dt, category_type: str = "all") -> dict:
    """Returns advanced_kpis, tva, marge, type_breakdown."""

    base_filter_v: list = []
    base_filter_a: list = []

    if pharmacy_id:
        base_filter_v.append(Vente.pharmacy_id == pharmacy_id)
        base_filter_a.append(Achat.pharmacy_id == pharmacy_id)
    if df:
        base_filter_v.append(Vente.date >= df)
        base_filter_a.append(Achat.delivery_date >= df)
    if dt:
        base_filter_v.append(Vente.date <= dt)
        base_filter_a.append(Achat.delivery_date <= dt)

    if pharmacy_id:
        non_declared_sub = (
            db.query(PharmacyMedicamentStatus.medicament_id)
            .filter(
                PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
                PharmacyMedicamentStatus.declared == False,
            )
            .subquery()
        )
        base_filter_v.append(Vente.medicament_id.notin_(non_declared_sub))
        base_filter_a.append(Achat.medicament_id.notin_(non_declared_sub))

    cat_filter_v: list = []
    cat_filter_a: list = []
    if category_type == "pharmacie":
        cat_filter_v = [_pharma_expr() == True]
        cat_filter_a = [_pharma_expr() == True]
    elif category_type == "parapharmacie":
        cat_filter_v = [_pharma_expr() == False]
        cat_filter_a = [_pharma_expr() == False]

    def vente_base_q(q):
        if cat_filter_v:
            q = q.join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
            q = q.filter(*cat_filter_v)
        return q.filter(*base_filter_v)

    def achat_base_q(q):
        if cat_filter_a:
            q = q.join(Medicament, Achat.medicament_id == Medicament.id, isouter=True)
            q = q.filter(*cat_filter_a)
        return q.filter(*base_filter_a)

    # ── Daily stats ──────────────────────────────────────────────────────────
    daily_q = db.query(Vente.date, func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)), func.count(Vente.id)).join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
    if cat_filter_v:
        daily_q = daily_q.filter(*cat_filter_v)
    daily = (
        daily_q.filter(*base_filter_v)
        .group_by(Vente.date)
        .all()
    )

    if daily:
        best_dh   = max(daily, key=lambda r: r[1] or 0)
        worst_dh  = min(daily, key=lambda r: r[1] or 0)
        best_cnt  = max(daily, key=lambda r: r[2] or 0)
        worst_cnt = min(daily, key=lambda r: r[2] or 0)
        total_v   = sum(r[1] or 0 for r in daily)
        total_cnt = sum(r[2] or 0 for r in daily)
        ticket_moyen   = total_v / total_cnt if total_cnt else 0
        vente_moy_jour = total_v / len(daily)
    else:
        best_dh = worst_dh = best_cnt = worst_cnt = None
        ticket_moyen = vente_moy_jour = 0

    advanced_kpis = {
        "ticket_moyen": round(ticket_moyen, 2),
        "vente_moyenne_par_jour": round(vente_moy_jour, 2),
        "best_day_dh":    {"date": str(best_dh[0]),  "total": float(best_dh[1] or 0)}  if best_dh  else None,
        "worst_day_dh":   {"date": str(worst_dh[0]), "total": float(worst_dh[1] or 0)} if worst_dh else None,
        "best_day_count": {"date": str(best_cnt[0]),  "count": int(best_cnt[2]  or 0)} if best_cnt  else None,
        "worst_day_count":{"date": str(worst_cnt[0]), "count": int(worst_cnt[2] or 0)} if worst_cnt else None,
    }

    # ── TVA ───────────────────────────────────────────────────────────────────
    vente_tva_rows = (
        db.query((Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)).label("ppv_total"), Medicament.tva)
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
        .filter(*base_filter_v)
        .filter(*cat_filter_v)
        .all()
    )
    tva_encaissee = sum((r.ppv_total or 0) * _parse_tva_rate(r.tva) for r in vente_tva_rows)

    achat_tva_rows = (
        db.query(Achat.total, Medicament.tva)
        .join(Medicament, Achat.medicament_id == Medicament.id, isouter=True)
        .filter(*base_filter_a)
        .filter(*cat_filter_a)
        .all()
    )
    tva_payee = sum((r.total or 0) * _parse_tva_rate(r.tva) for r in achat_tva_rows)

    tva = {
        "tva_encaissee":  round(tva_encaissee, 2),
        "tva_payee":      round(tva_payee, 2),
        "tva_a_declarer": round(tva_encaissee - tva_payee, 2),
    }

    # ── Marge (using avg actual purchase price from achats) ─────────────────
    avg_pu_sub = (
        db.query(
            Achat.medicament_id,
            (func.sum(Achat.unit_price * Achat.quantity) / func.sum(Achat.quantity)).label("avg_pu"),
        )
        .filter(*base_filter_a)
        .group_by(Achat.medicament_id)
        .subquery()
    )
    # outerjoin: products with sales but no purchases in the range still appear
    # fallback: if no avg_pu, use Medicament.pph as last resort
    marge_rows = (
        db.query(
            Vente.quantity, Medicament.ppv,
            func.coalesce(avg_pu_sub.c.avg_pu, Medicament.pph).label("pu"),
            Medicament.tva,
        )
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
        .outerjoin(avg_pu_sub, Medicament.id == avg_pu_sub.c.medicament_id)
        .filter(*base_filter_v)
        .filter(*cat_filter_v)
        .filter(Medicament.ppv.isnot(None))
        .all()
    )
    marge_rows = [r for r in marge_rows if r.pu is not None]
    sum_ppv = sum((r.quantity or 0) * (r.ppv or 0) for r in marge_rows)
    sum_pu  = sum((r.quantity or 0) * (r.pu or 0) for r in marge_rows)
    marge_brute = sum_ppv - sum_pu
    marge_pct   = (1 - sum_pu / sum_ppv) * 100 if sum_ppv else 0
    marge_nette = sum(
        (r.quantity or 0) * (
            (r.ppv or 0) / (1 + _parse_tva_rate(r.tva)) -
            (r.pu or 0) / (1 + _parse_tva_rate(r.tva))
        )
        for r in marge_rows
    )
    marge = {
        "marge_pct":      round(marge_pct, 2),
        "marge_brute_dh": round(marge_brute, 2),
        "marge_nette_dh": round(marge_nette, 2),
    }

    # ── CA breakdown: Pharmacie vs Parapharmacie ─────────────────────────────
    pharm_total = (
        db.query(func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)))
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
        .filter(*base_filter_v)
        .filter(_pharma_expr() == True)
        .scalar() or 0
    )
    para_total = (
        db.query(func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)))
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
        .filter(*base_filter_v)
        .filter(_pharma_expr() == False)
        .scalar() or 0
    )
    type_breakdown = {
        "pharmacie":     {"ventes_total": round(float(pharm_total), 2)},
        "parapharmacie": {"ventes_total": round(float(para_total), 2)},
    }

    return {
        "advanced_kpis": advanced_kpis,
        "tva": tva,
        "marge": marge,
        "type_breakdown": type_breakdown,
    }


def build_monthly_trend(db: Session, pharmacy_id, df: Optional[str], dt: Optional[str], non_declared_sub=None) -> list:
    today = date.today()
    twelve_months_ago = (today.replace(day=1) - timedelta(days=335)).replace(day=1)
    trend_start = date.fromisoformat(df).replace(day=1) if df else twelve_months_ago
    trend_end = date.fromisoformat(dt).replace(day=1) if dt else today.replace(day=1)
    trend_start_str = trend_start.strftime("%Y-%m-%d")
    trend_end_str = (
        date(trend_end.year, trend_end.month + 1, 1).strftime("%Y-%m-%d")
        if trend_end.month < 12
        else date(trend_end.year + 1, 1, 1).strftime("%Y-%m-%d")
    )

    v_q = (
        db.query(
            func.date_trunc("month", func.cast(Vente.date, Date)).label("month"),
            func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)).label("total"),
        )
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
        .filter(Vente.date >= trend_start_str, Vente.date < trend_end_str)
    )
    a_q = (
        db.query(
            func.date_trunc("month", func.cast(Achat.delivery_date, Date)).label("month"),
            func.sum(Achat.total).label("total"),
        )
        .filter(Achat.delivery_date >= trend_start_str, Achat.delivery_date < trend_end_str)
    )
    if pharmacy_id:
        v_q = v_q.filter(Vente.pharmacy_id == pharmacy_id)
        a_q = a_q.filter(Achat.pharmacy_id == pharmacy_id)
    if non_declared_sub is not None:
        v_q = v_q.filter(Vente.medicament_id.notin_(non_declared_sub))
        a_q = a_q.filter(Achat.medicament_id.notin_(non_declared_sub))

    v_by_month = {_month_label(r.month.date()): float(r.total or 0) for r in v_q.group_by("month").all()}
    a_by_month = {_month_label(r.month.date()): float(r.total or 0) for r in a_q.group_by("month").all()}

    monthly_trend = []
    cursor = trend_start
    while cursor <= trend_end:
        label = _month_label(cursor)
        monthly_trend.append({"month": label, "ventes": v_by_month.get(label, 0.0), "achats": a_by_month.get(label, 0.0)})
        cursor = cursor.replace(month=cursor.month + 1) if cursor.month < 12 else cursor.replace(year=cursor.year + 1, month=1)
    return monthly_trend
