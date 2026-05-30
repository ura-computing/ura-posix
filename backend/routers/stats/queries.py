import calendar
import re
from datetime import date, timedelta
from typing import Optional

from sqlalchemy import Date, case as sa_case, func
from sqlalchemy.orm import Session

from models import Achat, Medicament, PharmacyMedicamentStatus, Vente
from utils.strings import strip_percentage as _strip_pct


def _subtract_months(d: date, months: int) -> date:
    """Subtract *months* calendar months from *d*, clamping to last day of month."""
    month = d.month - months
    year = d.year
    while month < 1:
        month += 12
        year -= 1
    max_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(d.day, max_day))


def _subtract_years(d: date, years: int) -> date:
    """Subtract *years* from *d*, clamping Feb 29 to Feb 28 in non-leap years."""
    year = d.year - years
    max_day = calendar.monthrange(year, d.month)[1]
    return date(year, d.month, min(d.day, max_day))


def _pharma_expr():
    """SQLAlchemy expression: True = pharmacie, False = parapharmacie.
    Admin product_type override takes precedence; falls back to category keywords."""
    auto = sa_case(
        (func.lower(Medicament.category).contains("edicament"), True),
        (func.lower(Medicament.category).contains("édicament"), True),
        (func.lower(Medicament.category).contains("oméopath"), True),
        (func.lower(Medicament.category).contains("omeopath"), True),
        else_=False,
    )
    return sa_case(
        (Medicament.product_type == "pharmacie", True),
        (Medicament.product_type == "parapharmacie", False),
        else_=auto,
    )


def _merge_top_categories(rows) -> list:
    """Merge rows that share the same stripped category name, return all sorted by total."""
    merged: dict[str, dict] = {}
    for r in rows:
        key = _strip_pct(r.category)
        if key not in merged:
            merged[key] = {"total": 0.0, "pu_sum": 0.0, "ppv_sum": 0.0, "qty_sum": 0.0}
        m = merged[key]
        m["total"] += float(r.total or 0)
        qty = float(getattr(r, "qty", 0) or 0)
        pu = float(getattr(r, "avg_pu", 0) or 0)
        ppv = float(getattr(r, "avg_ppv", 0) or 0)
        m["pu_sum"] += pu * qty
        m["ppv_sum"] += ppv * qty
        m["qty_sum"] += qty
    result = []
    for k, m in merged.items():
        marge_pct = None
        if m["qty_sum"] > 0 and m["ppv_sum"] > 0:
            avg_pu = m["pu_sum"] / m["qty_sum"]
            avg_ppv = m["ppv_sum"] / m["qty_sum"]
            if avg_ppv > 0:
                marge_pct = round((1 - avg_pu / avg_ppv) * 100, 2)
        result.append({"category": k, "total": round(m["total"], 2), "marge_pct": marge_pct})
    return sorted(result, key=lambda x: x["total"], reverse=True)


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


def _marge_for_window(db: Session, base_filter_v: list, base_filter_a: list, cat_filter_v: list) -> dict:
    """Weighted marge over (Vente, Achat) for the supplied filters.

    Returns {'marge_pct', 'marge_brute_dh', 'marge_nette_dh'} using the same per-medicament
    avg-PU aggregation as the dashboard tile, so 'previous' marge can be compared apples-to-
    apples for the variation badge (PG-004). The PPH fallback on line `func.coalesce(...)`
    mirrors the historical behaviour at this site; PG-013 cleanup of /stats/analyse-marge does
    not extend here yet — track separately if/when desired."""
    avg_pu_sub = (
        db.query(
            Achat.medicament_id,
            (func.sum(Achat.unit_price * Achat.quantity) / func.sum(Achat.quantity)).label("avg_pu"),
        )
        .filter(*base_filter_a)
        .group_by(Achat.medicament_id)
        .subquery()
    )
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
    return {
        "marge_pct":      round(marge_pct, 2),
        "marge_brute_dh": round(marge_brute, 2),
        "marge_nette_dh": round(marge_nette, 2),
    }


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
    marge = _marge_for_window(db, base_filter_v, base_filter_a, cat_filter_v)

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


def compute_previous_kpis(
    db: Session,
    pharmacy_id,
    df: Optional[str],
    dt: Optional[str],
    cat_filter_v: list,
    cat_filter_a: list,
    non_declared_sub=None,
) -> dict:
    """Compute ventes_total and achats_total for the same window one year earlier.

    When date filters are provided, the previous period spans the same dates
    minus one year (Feb 29 clamps to Feb 28).  When no dates are provided,
    compare the current month vs the same month last year.
    """
    today = date.today()

    if df and dt:
        d_from = date.fromisoformat(df)
        d_to = date.fromisoformat(dt)
        prev_df = _subtract_years(d_from, 1)
        prev_dt = _subtract_years(d_to, 1)
    elif df:
        d_from = date.fromisoformat(df)
        prev_df = _subtract_years(d_from, 1)
        prev_dt = _subtract_years(today, 1)
    elif dt:
        d_to = date.fromisoformat(dt)
        prev_df = _subtract_years(d_to.replace(day=1), 1)
        prev_dt = _subtract_years(d_to, 1)
    else:
        first_of_month = today.replace(day=1)
        prev_df = _subtract_years(first_of_month, 1)
        prev_dt = _subtract_years(today, 1)

    prev_df_str = prev_df.strftime("%Y-%m-%d")
    prev_dt_str = prev_dt.strftime("%Y-%m-%d")

    # Ventes total for previous period
    vq = (
        db.query(func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)))
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
    )
    if cat_filter_v:
        vq = vq.filter(*cat_filter_v)
    if pharmacy_id:
        vq = vq.filter(Vente.pharmacy_id == pharmacy_id)
    if non_declared_sub is not None:
        vq = vq.filter(Vente.medicament_id.notin_(non_declared_sub))
    vq = vq.filter(Vente.date >= prev_df_str, Vente.date <= prev_dt_str)
    prev_ventes = vq.scalar()

    # Achats total for previous period
    aq = db.query(func.sum(Achat.total))
    if cat_filter_a:
        aq = aq.join(Medicament, Achat.medicament_id == Medicament.id, isouter=True).filter(*cat_filter_a)
    if pharmacy_id:
        aq = aq.filter(Achat.pharmacy_id == pharmacy_id)
    if non_declared_sub is not None:
        aq = aq.filter(Achat.medicament_id.notin_(non_declared_sub))
    aq = aq.filter(Achat.delivery_date >= prev_df_str, Achat.delivery_date <= prev_dt_str)
    prev_achats = aq.scalar()

    # Marge for the previous window — computed by the SAME per-medicament weighted formula as
    # the current marge (queries._marge_for_window) so the dashboard variation badge compares
    # like-for-like. Before PG-004 the frontend reconstructed prev marge from sumVente/sumAchat
    # which gave a different number; the variation was junk.
    prev_base_filter_v: list = [
        Vente.date >= prev_df_str,
        Vente.date <= prev_dt_str,
    ]
    prev_base_filter_a: list = [
        Achat.delivery_date >= prev_df_str,
        Achat.delivery_date <= prev_dt_str,
    ]
    if pharmacy_id:
        prev_base_filter_v.append(Vente.pharmacy_id == pharmacy_id)
        prev_base_filter_a.append(Achat.pharmacy_id == pharmacy_id)
    if non_declared_sub is not None:
        prev_base_filter_v.append(Vente.medicament_id.notin_(non_declared_sub))
        prev_base_filter_a.append(Achat.medicament_id.notin_(non_declared_sub))

    prev_marge = _marge_for_window(db, prev_base_filter_v, prev_base_filter_a, cat_filter_v)

    return {
        "ventes_total": float(prev_ventes or 0),
        "achats_total": float(prev_achats or 0),
        "marge_pct":    prev_marge["marge_pct"],
    }


def build_monthly_trend(db: Session, pharmacy_id, df: Optional[str], dt: Optional[str], non_declared_sub=None, cat_filter_v=None, cat_filter_a=None) -> list:
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
    if cat_filter_v:
        v_q = v_q.filter(*cat_filter_v)
    if cat_filter_a:
        a_q = a_q.join(Medicament, Achat.medicament_id == Medicament.id, isouter=True).filter(*cat_filter_a)
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
