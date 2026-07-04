"""Dashboard/Rapport query helpers — ported from apcm-pharma's stats/queries.py.

Single source of truth for the formulas the /v1/stats endpoint (and later
admin/analyse/peremptions endpoints) use. Every helper is pure — takes a Session,
filters, and a window, returns plain dicts. Keep this file pure SQL → values; no
auth, no HTTP concerns.

Hardening invariants baked in here (mirror PG-* tickets from apcm-pharma):
- PG-013: marge formulas do NOT fall back to Medicament.pph when avg_pu is missing
  (Sobrus' fiche-produit often has PPH == PPV, which would produce a fake 0 % marge).
- PG-007: BL-excluded delivery_refs filtered via `achat_bl_filter()` on every Achat
  aggregate. The helper handles the NULL-NOT-IN gotcha.
- PG-004: previous-window marge uses the SAME weighted formula as the current marge
  so the variation badge compares like-for-like.
"""
from __future__ import annotations

import calendar
import re
from datetime import date, timedelta
from typing import Optional

from sqlalchemy import Date, case as sa_case, func
from sqlalchemy.orm import Session

from exclusions import achat_bl_filter
from models import Achat, Medicament, PharmacyMedicamentStatus, PharmacyStock, Vente


# ─── String helpers (small ports — keeps stats_queries self-contained) ─────────

_PCT_RE = re.compile(r"\s*\(\d+\.?\d*%\)")


def _strip_pct(s: str | None) -> str:
    """Remove '(xx%)' suffix from a category string."""
    if not s:
        return s or ""
    return _PCT_RE.sub("", s).strip()


def _parse_tva_rate(tva_str) -> float:
    """Parse '12.5%' → 0.125, None → 0.0."""
    if not tva_str:
        return 0.0
    m = re.search(r"([\d.]+)", str(tva_str))
    return float(m.group(1)) / 100 if m else 0.0


# ─── Date arithmetic ──────────────────────────────────────────────────────────

def _subtract_years(d: date, years: int) -> date:
    """Subtract *years* from *d*, clamping Feb 29 → Feb 28 in non-leap years."""
    year = d.year - years
    max_day = calendar.monthrange(year, d.month)[1]
    return date(year, d.month, min(d.day, max_day))


def _month_label(d: date) -> str:
    return d.strftime("%Y-%m")


# ─── Category classification (Pharmacie vs Parapharmacie) ─────────────────────

def pharma_expr():
    """SQLAlchemy expression: True = pharmacie, False = parapharmacie.
    Admin product_type override takes precedence; falls back to category keywords."""
    auto = sa_case(
        (func.lower(Medicament.category).contains("edicament"), True),
        (func.lower(Medicament.category).contains("édicament"), True),
        (func.lower(Medicament.category).contains("oméopath"), True),
        (func.lower(Medicament.category).contains("omeopath"), True),
        (func.lower(Medicament.category).contains("iététique"), True),
        (func.lower(Medicament.category).contains("ietetique"), True),
        else_=False,
    )
    return sa_case(
        (Medicament.product_type == "pharmacie", True),
        (Medicament.product_type == "parapharmacie", False),
        else_=auto,
    )


# ─── Top categories ────────────────────────────────────────────────────────────

def merge_top_categories(rows) -> list[dict]:
    """Merge rows that share the same stripped category name; sort by total desc."""
    merged: dict[str, dict] = {}
    for r in rows:
        key = _strip_pct(r.category)
        if key not in merged:
            merged[key] = {"total": 0.0, "pu_sum": 0.0, "ppv_sum": 0.0, "qty_sum": 0.0}
        m = merged[key]
        m["total"] += float(r.total or 0)
        qty = float(getattr(r, "qty", 0) or 0)
        pu  = float(getattr(r, "avg_pu", 0) or 0)
        ppv = float(getattr(r, "avg_ppv", 0) or 0)
        m["pu_sum"]  += pu * qty
        m["ppv_sum"] += ppv * qty
        m["qty_sum"] += qty
    result: list[dict] = []
    for k, m in merged.items():
        marge_pct: Optional[float] = None
        if m["qty_sum"] > 0 and m["ppv_sum"] > 0:
            avg_pu  = m["pu_sum"]  / m["qty_sum"]
            avg_ppv = m["ppv_sum"] / m["qty_sum"]
            if avg_ppv > 0:
                marge_pct = round((1 - avg_pu / avg_ppv) * 100, 2)
        result.append({"category": k, "total": round(m["total"], 2), "marge_pct": marge_pct})
    return sorted(result, key=lambda x: x["total"], reverse=True)


# ─── Marge for a window (PG-013, PG-007 safe) ─────────────────────────────────

def marge_for_window(db: Session, base_filter_v: list, base_filter_a: list, cat_filter_v: list) -> dict:
    """Weighted marge over (Vente, Achat) for the supplied filters.

    Returns {marge_pct, marge_brute_dh, marge_nette_dh}. Per-medicament avg-PU comes
    from Achat rows in the window. Products with sales but no in-window purchases are
    excluded (PU unknown, no PPH fallback)."""
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
            avg_pu_sub.c.avg_pu.label("pu"),
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
    sum_pu  = sum((r.quantity or 0) * (r.pu  or 0) for r in marge_rows)
    marge_brute = sum_ppv - sum_pu
    marge_pct   = (1 - sum_pu / sum_ppv) * 100 if sum_ppv else 0
    marge_nette = sum(
        (r.quantity or 0) * (
            (r.ppv or 0) / (1 + _parse_tva_rate(r.tva)) -
            (r.pu  or 0) / (1 + _parse_tva_rate(r.tva))
        )
        for r in marge_rows
    )
    return {
        "marge_pct":      round(marge_pct, 2),
        "marge_brute_dh": round(marge_brute, 2),
        "marge_nette_dh": round(marge_nette, 2),
    }


# ─── Aggregate KPIs (advanced + tva + marge + type_breakdown) ─────────────────

def compute_extra_stats(db: Session, pharmacy_id: int | None, df: str | None, dt: str | None, category_type: str = "all") -> dict:
    """Returns the bundle: advanced_kpis (best/worst day, ticket_moyen), tva, marge, type_breakdown."""
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
        sub = (
            db.query(PharmacyMedicamentStatus.medicament_id)
            .filter(PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
                    PharmacyMedicamentStatus.declared == False)
            .scalar_subquery()
        )
        base_filter_v.append(Vente.medicament_id.notin_(sub))
        base_filter_a.append(Achat.medicament_id.notin_(sub))
        base_filter_a.append(achat_bl_filter(db, pharmacy_id))

    cat_filter_v: list = []
    cat_filter_a: list = []
    if category_type == "pharmacie":
        cat_filter_v = [pharma_expr() == True]
        cat_filter_a = [pharma_expr() == True]
    elif category_type == "parapharmacie":
        cat_filter_v = [pharma_expr() == False]
        cat_filter_a = [pharma_expr() == False]

    # Daily aggregates (best/worst day, ticket moyen, vente moy/jour)
    daily_q = (
        db.query(
            Vente.date,
            func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)),
            func.count(Vente.id),
        )
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
    )
    if cat_filter_v:
        daily_q = daily_q.filter(*cat_filter_v)
    daily = daily_q.filter(*base_filter_v).group_by(Vente.date).all()

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
        "best_day_dh":     {"date": str(best_dh[0]),   "total": float(best_dh[1]  or 0)} if best_dh   else None,
        "worst_day_dh":    {"date": str(worst_dh[0]),  "total": float(worst_dh[1] or 0)} if worst_dh  else None,
        "best_day_count":  {"date": str(best_cnt[0]),  "count": int(best_cnt[2]   or 0)} if best_cnt  else None,
        "worst_day_count": {"date": str(worst_cnt[0]), "count": int(worst_cnt[2]  or 0)} if worst_cnt else None,
    }

    # TVA
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

    # Marge (weighted, windowed, PG-013 + PG-007 safe)
    marge = marge_for_window(db, base_filter_v, base_filter_a, cat_filter_v)

    # CA breakdown: Pharmacie vs Parapharmacie (always reported, regardless of cat filter)
    pharm_total = (
        db.query(func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)))
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
        .filter(*base_filter_v)
        .filter(pharma_expr() == True)
        .scalar() or 0
    )
    para_total = (
        db.query(func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)))
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
        .filter(*base_filter_v)
        .filter(pharma_expr() == False)
        .scalar() or 0
    )

    return {
        "advanced_kpis": advanced_kpis,
        "tva": tva,
        "marge": marge,
        "type_breakdown": {
            "pharmacie":     {"ventes_total": round(float(pharm_total), 2)},
            "parapharmacie": {"ventes_total": round(float(para_total), 2)},
        },
    }


# ─── Previous-period KPIs (PG-004: same weighted formula as current) ──────────

def compute_previous_kpis(
    db: Session,
    pharmacy_id: int | None,
    df: Optional[str],
    dt: Optional[str],
    cat_filter_v: list,
    cat_filter_a: list,
    non_declared_sub=None,
) -> dict:
    """ventes_total + achats_total + marge_pct for the same window shifted -1 year."""
    today = date.today()
    if df and dt:
        d_from = date.fromisoformat(df); d_to = date.fromisoformat(dt)
        prev_df = _subtract_years(d_from, 1); prev_dt = _subtract_years(d_to, 1)
    elif df:
        d_from = date.fromisoformat(df)
        prev_df = _subtract_years(d_from, 1); prev_dt = _subtract_years(today, 1)
    elif dt:
        d_to = date.fromisoformat(dt)
        prev_df = _subtract_years(d_to.replace(day=1), 1); prev_dt = _subtract_years(d_to, 1)
    else:
        first_of_month = today.replace(day=1)
        prev_df = _subtract_years(first_of_month, 1); prev_dt = _subtract_years(today, 1)

    prev_df_str = prev_df.strftime("%Y-%m-%d")
    prev_dt_str = prev_dt.strftime("%Y-%m-%d")

    vq = (
        db.query(func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)))
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
    )
    if cat_filter_v: vq = vq.filter(*cat_filter_v)
    if pharmacy_id:  vq = vq.filter(Vente.pharmacy_id == pharmacy_id)
    if non_declared_sub is not None: vq = vq.filter(Vente.medicament_id.notin_(non_declared_sub))
    vq = vq.filter(Vente.date >= prev_df_str, Vente.date <= prev_dt_str)
    prev_ventes = vq.scalar()

    aq = db.query(func.sum(Achat.total))
    if cat_filter_a: aq = aq.join(Medicament, Achat.medicament_id == Medicament.id, isouter=True).filter(*cat_filter_a)
    if pharmacy_id:  aq = aq.filter(Achat.pharmacy_id == pharmacy_id)
    if non_declared_sub is not None: aq = aq.filter(Achat.medicament_id.notin_(non_declared_sub))
    if pharmacy_id:  aq = aq.filter(achat_bl_filter(db, pharmacy_id))
    aq = aq.filter(Achat.delivery_date >= prev_df_str, Achat.delivery_date <= prev_dt_str)
    prev_achats = aq.scalar()

    # PG-004: previous marge via same per-medicament weighted formula as current.
    prev_base_filter_v: list = [Vente.date >= prev_df_str, Vente.date <= prev_dt_str]
    prev_base_filter_a: list = [Achat.delivery_date >= prev_df_str, Achat.delivery_date <= prev_dt_str]
    if pharmacy_id:
        prev_base_filter_v.append(Vente.pharmacy_id == pharmacy_id)
        prev_base_filter_a.append(Achat.pharmacy_id == pharmacy_id)
    if non_declared_sub is not None:
        prev_base_filter_v.append(Vente.medicament_id.notin_(non_declared_sub))
        prev_base_filter_a.append(Achat.medicament_id.notin_(non_declared_sub))
    if pharmacy_id:
        prev_base_filter_a.append(achat_bl_filter(db, pharmacy_id))

    prev_marge = marge_for_window(db, prev_base_filter_v, prev_base_filter_a, cat_filter_v)

    return {
        "ventes_total": float(prev_ventes or 0),
        "achats_total": float(prev_achats or 0),
        "marge_pct":    prev_marge["marge_pct"],
    }


# ─── Monthly trend (last 12 months, or user-windowed) ─────────────────────────

# ─── Margin alerts (4 brackets feeding Rapport Section 5) ────────────────────

# Bracket bounds are tuples (min, max). `min=None` means open-low; `max=None` open-high.
# A product's marge_pct lands in the bracket where min <= marge_pct < max (or matches
# the open ends). Order matters — we iterate top-to-bottom.
MARGIN_BRACKETS: dict[str, tuple[float | None, float | None]] = {
    "negative":  (None, 0),
    "low":       (0,    10),
    "medium":    (10,   60),
    "high":      (60,   90),
    "very_high": (90,   None),
}


def _bracket_for(marge_pct: float) -> str | None:
    for key, (lo, hi) in MARGIN_BRACKETS.items():
        if lo is None and hi is not None and marge_pct < hi:                  return key
        if hi is None and lo is not None and marge_pct >= lo:                 return key
        if lo is not None and hi is not None and lo <= marge_pct < hi:        return key
    return None


def compute_margin_alerts(db: Session, pharmacy_id: int | None, df: Optional[str],
                          dt: Optional[str], category_type: str = "all") -> dict:
    """Group products by margin brackets. Each bracket returns {count, total_ca,
    total_margin_dh, products[]}. `products` is sorted by abs(marge_pct) desc so the
    drill-down lists the most extreme cases first."""
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
        sub = (
            db.query(PharmacyMedicamentStatus.medicament_id)
            .filter(PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
                    PharmacyMedicamentStatus.declared == False)
            .scalar_subquery()
        )
        base_filter_v.append(Vente.medicament_id.notin_(sub))
        base_filter_a.append(Achat.medicament_id.notin_(sub))
        base_filter_a.append(achat_bl_filter(db, pharmacy_id))

    cat_filter: list = []
    if category_type == "pharmacie":
        cat_filter = [pharma_expr() == True]
    elif category_type == "parapharmacie":
        cat_filter = [pharma_expr() == False]

    avg_pu_sub = (
        db.query(
            Achat.medicament_id,
            (func.sum(Achat.unit_price * Achat.quantity) / func.sum(Achat.quantity)).label("avg_pu"),
        )
        .filter(*base_filter_a)
        .group_by(Achat.medicament_id)
        .subquery()
    )
    rows = (
        db.query(
            Medicament.product,
            Medicament.ppv,
            avg_pu_sub.c.avg_pu.label("pu"),
            func.sum(Vente.quantity).label("qty"),
            func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)).label("ca"),
        )
        .join(Medicament, Vente.medicament_id == Medicament.id)
        .outerjoin(avg_pu_sub, Medicament.id == avg_pu_sub.c.medicament_id)
        .filter(*base_filter_v, *cat_filter, Medicament.ppv.isnot(None))
        .group_by(Medicament.id, Medicament.product, Medicament.ppv, avg_pu_sub.c.avg_pu)
        .all()
    )

    out: dict = {k: {"count": 0, "total_ca": 0.0, "total_margin_dh": 0.0, "products": []} for k in MARGIN_BRACKETS}
    for r in rows:
        ppv = float(r.ppv or 0); pu = float(r.pu or 0)
        if not ppv or not pu:
            continue
        marge_pct = round((1 - pu / ppv) * 100, 2)
        key = _bracket_for(marge_pct)
        if key is None:
            continue
        ca = float(r.ca or 0)
        margin_dh = round(float(r.qty or 0) * (ppv - pu), 2)
        b = out[key]
        b["count"] += 1
        b["total_ca"] += ca
        b["total_margin_dh"] += margin_dh
        b["products"].append({"product": r.product or "—", "marge_pct": marge_pct, "ca": round(ca, 2)})

    for b in out.values():
        b["total_ca"] = round(b["total_ca"], 2)
        b["total_margin_dh"] = round(b["total_margin_dh"], 2)
        b["products"].sort(key=lambda p: abs(p["marge_pct"]), reverse=True)
    return out


def compute_ventes_sans_achat(db: Session, pharmacy_id: int | None, df: Optional[str],
                              dt: Optional[str], category_type: str = "all") -> dict:
    """List products with ventes in the [df, dt] window whose medicament has NO
    matching achat in the same window for the same pharmacy — the root cause of
    Marge %/DH rendering "—" on /ventes for those rows.

    Reuses the exact filter set from compute_margin_alerts (non-declared exclusion,
    achat_bl_filter, category_type) so a product surfaced here is EXACTLY a product
    that shows "—" on /ventes with the same filters."""
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
        sub = (
            db.query(PharmacyMedicamentStatus.medicament_id)
            .filter(PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
                    PharmacyMedicamentStatus.declared == False)
            .scalar_subquery()
        )
        base_filter_v.append(Vente.medicament_id.notin_(sub))
        base_filter_a.append(Achat.medicament_id.notin_(sub))
        base_filter_a.append(achat_bl_filter(db, pharmacy_id))

    cat_filter: list = []
    if category_type == "pharmacie":
        cat_filter = [pharma_expr() == True]
    elif category_type == "parapharmacie":
        cat_filter = [pharma_expr() == False]

    achat_meds_sub = (
        db.query(Achat.medicament_id)
        .filter(*base_filter_a)
        .distinct()
        .scalar_subquery()
    )
    ca_expr = func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price))
    rows = (
        db.query(
            Medicament.product,
            Medicament.category,
            Medicament.ppv,
            func.sum(Vente.quantity).label("units_sold"),
            ca_expr.label("ca"),
            func.max(Vente.date).label("last_vente_date"),
        )
        .join(Medicament, Vente.medicament_id == Medicament.id)
        .filter(*base_filter_v, *cat_filter, Vente.medicament_id.notin_(achat_meds_sub))
        .group_by(Medicament.id, Medicament.product, Medicament.category, Medicament.ppv)
        .order_by(ca_expr.desc())
        .limit(500)
        .all()
    )
    products = [{
        "product":         r.product or "—",
        "category":        r.category,
        "ppv":             float(r.ppv) if r.ppv is not None else None,
        "units_sold":      round(float(r.units_sold or 0), 2),
        "ca":              round(float(r.ca or 0), 2),
        "last_vente_date": r.last_vente_date,
    } for r in rows]
    return {
        "count":            len(products),
        "total_ca":         round(sum(p["ca"] for p in products), 2),
        "total_units_sold": round(sum(p["units_sold"] for p in products), 2),
        "products":         products,
    }


# ─── Stock summary (Rapport Section 8 — 4 tiles) ─────────────────────────────
# Lightweight — returns just the 4 tile numbers the Rapport needs.
# The full ABCD classification ports later when /stock page is built.

def compute_stock_summary(db: Session, pharmacy_id: int) -> dict:
    """Returns {total_references, ppv_potentiel, sous_stock_count, sur_stock_count,
    in_band_count, health_pct} for the Rapport Stock section.

    Bands: stock < 14 days ⇒ sous-stock, stock > 15 days ⇒ sur-stock, between ⇒ ideal.
    Days-of-coverage uses ventes over the last 12 months (300 selling days assumed,
    matching apcm-pharma's `(ventes_12m / 300) × {14, 15}` formula).
    """
    if not pharmacy_id:
        return {"total_references": 0, "ppv_potentiel": 0.0,
                "sous_stock_count": 0, "sur_stock_count": 0,
                "in_band_count": 0, "health_pct": 0.0}

    sub = (
        db.query(PharmacyMedicamentStatus.medicament_id)
        .filter(PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
                PharmacyMedicamentStatus.declared == False)
        .scalar_subquery()
    )

    # 12-month sales per medicament for this pharmacy.
    from datetime import date as _date, timedelta as _td
    today = _date.today()
    start_12m = (today - _td(days=365)).isoformat()
    sales_12m = (
        db.query(
            Vente.medicament_id,
            func.sum(Vente.quantity).label("units"),
        )
        .filter(
            Vente.pharmacy_id == pharmacy_id,
            Vente.medicament_id.isnot(None),
            Vente.date >= start_12m,
            Vente.medicament_id.notin_(sub),
        )
        .group_by(Vente.medicament_id)
        .subquery()
    )

    rows = (
        db.query(
            PharmacyStock.medicament_id,
            PharmacyStock.current_stock,
            Medicament.ppv,
            sales_12m.c.units.label("units_12m"),
        )
        .join(Medicament, PharmacyStock.medicament_id == Medicament.id)
        .outerjoin(sales_12m, PharmacyStock.medicament_id == sales_12m.c.medicament_id)
        .filter(
            PharmacyStock.pharmacy_id == pharmacy_id,
            PharmacyStock.medicament_id.notin_(sub),
        )
        .all()
    )

    total_refs = len(rows)
    ppv_potentiel = 0.0
    sous_stock = sur_stock = in_band = 0
    for r in rows:
        stock = int(r.current_stock or 0)
        ppv   = float(r.ppv or 0)
        ppv_potentiel += stock * ppv
        units_12m = float(r.units_12m or 0)
        if units_12m <= 0:
            continue  # can't classify products with no recent sales; skip
        # Match apcm-pharma: stock_min = (ventes_12m / 300) × 14, stock_max = × 15
        stock_min = (units_12m / 300) * 14
        stock_max = (units_12m / 300) * 15
        if   stock < stock_min: sous_stock += 1
        elif stock > stock_max: sur_stock  += 1
        else:                   in_band    += 1

    classified = sous_stock + sur_stock + in_band
    health_pct = round((in_band / classified) * 100, 1) if classified else 0.0

    return {
        "total_references": total_refs,
        "ppv_potentiel":    round(ppv_potentiel, 2),
        "sous_stock_count": sous_stock,
        "sur_stock_count":  sur_stock,
        "in_band_count":    in_band,
        "health_pct":       health_pct,
    }


def build_monthly_trend(db: Session, pharmacy_id: int | None, df: Optional[str], dt: Optional[str],
                        non_declared_sub=None, cat_filter_v=None, cat_filter_a=None) -> list[dict]:
    today = date.today()
    twelve_months_ago = (today.replace(day=1) - timedelta(days=335)).replace(day=1)
    trend_start = date.fromisoformat(df).replace(day=1) if df else twelve_months_ago
    trend_end   = date.fromisoformat(dt).replace(day=1) if dt else today.replace(day=1)
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
    if cat_filter_v: v_q = v_q.filter(*cat_filter_v)
    if cat_filter_a: a_q = a_q.join(Medicament, Achat.medicament_id == Medicament.id, isouter=True).filter(*cat_filter_a)
    if pharmacy_id:
        v_q = v_q.filter(Vente.pharmacy_id == pharmacy_id)
        a_q = a_q.filter(Achat.pharmacy_id == pharmacy_id)
    if non_declared_sub is not None:
        v_q = v_q.filter(Vente.medicament_id.notin_(non_declared_sub))
        a_q = a_q.filter(Achat.medicament_id.notin_(non_declared_sub))
    if pharmacy_id:
        a_q = a_q.filter(achat_bl_filter(db, pharmacy_id))

    v_by_month = {_month_label(r.month.date()): float(r.total or 0) for r in v_q.group_by("month").all()}
    a_by_month = {_month_label(r.month.date()): float(r.total or 0) for r in a_q.group_by("month").all()}

    out: list[dict] = []
    cursor = trend_start
    while cursor <= trend_end:
        label = _month_label(cursor)
        out.append({"month": label, "ventes": v_by_month.get(label, 0.0), "achats": a_by_month.get(label, 0.0)})
        cursor = cursor.replace(month=cursor.month + 1) if cursor.month < 12 else cursor.replace(year=cursor.year + 1, month=1)
    return out