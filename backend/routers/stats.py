import io
import re as _re
from datetime import date, timedelta
from typing import List, Optional

import openpyxl
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from openpyxl.styles import Font, PatternFill
from sqlalchemy import Date, case as sa_case, func
from sqlalchemy.orm import Session

from database import get_db
from models import Achat, CatalogRequest, Medicament, Pharmacy, User, Vente
from routers.auth import get_current_user

router = APIRouter(tags=["stats"])

_PCT_RE = _re.compile(r"\s*\(\d+\.?\d*%\)")


def _strip_pct(s: str) -> str:
    return _PCT_RE.sub("", s).strip() if s else s


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
    m = _re.search(r"([\d.]+)", str(tva_str))
    return float(m.group(1)) / 100 if m else 0.0


# ── Helper: compute extra analytics ────────────────────────────────────────────

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

    # Category-type filter (joins Medicament when needed)
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
    daily = (
        vente_base_q(db.query(Vente.date, func.sum(Vente.total), func.count(Vente.id)))
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
        db.query(Vente.total, Medicament.tva)
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
        .filter(*base_filter_v)
        .filter(*cat_filter_v)
        .all()
    )
    tva_encaissee = sum((r.total or 0) * _parse_tva_rate(r.tva) for r in vente_tva_rows)

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

    # ── Marge ─────────────────────────────────────────────────────────────────
    marge_rows = (
        db.query(Vente.quantity, Medicament.ppv, Medicament.pph, Medicament.tva)
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
        .filter(*base_filter_v)
        .filter(*cat_filter_v)
        .filter(Medicament.ppv.isnot(None), Medicament.pph.isnot(None))
        .all()
    )
    sum_ppv = sum((r.quantity or 0) * (r.ppv or 0) for r in marge_rows)
    sum_pph = sum((r.quantity or 0) * (r.pph or 0) for r in marge_rows)
    marge_brute = sum_ppv - sum_pph
    marge_pct   = (1 - sum_pph / sum_ppv) * 100 if sum_ppv else 0
    marge_nette = sum(
        (r.quantity or 0) * (
            (r.ppv or 0) / (1 + _parse_tva_rate(r.tva)) -
            (r.pph or 0) / (1 + _parse_tva_rate(r.tva))
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
        db.query(func.sum(Vente.total))
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
        .filter(*base_filter_v)
        .filter(_pharma_expr() == True)
        .scalar() or 0
    )
    para_total = (
        db.query(func.sum(Vente.total))
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


# ── Medications list for Excel ─────────────────────────────────────────────────

def _fetch_med_rows(db, pharmacy_id, df, dt, cat_filter=None):
    q = db.query(
        Medicament.product,
        Medicament.category,
        Medicament.tva,
        Medicament.product_type,
        Medicament.pph,
        Medicament.ppv,
        func.sum(Vente.quantity).label("qty"),
        func.sum(Vente.total).label("total"),
    ).join(Medicament, Vente.medicament_id == Medicament.id)
    if pharmacy_id:
        q = q.filter(Vente.pharmacy_id == pharmacy_id)
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
            Medicament.pph, Medicament.ppv,
        )
        .order_by(func.sum(Vente.total).desc())
        .all()
    )


def _resolve_type(product_type, category) -> str:
    if product_type:
        return product_type.capitalize()
    cat = (category or "").lower()
    if "edicament" in cat or "oméopath" in cat or "omeopath" in cat:
        return "Pharmacie"
    return "Parapharmacie"


# ── Excel builder ───────────────────────────────────────────────────────────────

def _build_excel(title: str, period: str, kpis: dict, extra: dict, med_rows=None) -> io.BytesIO:
    adv = extra["advanced_kpis"]
    tva = extra["tva"]
    marge = extra["marge"]

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Résumé"

    section_font = Font(bold=True, color="FFFFFF")
    section_fill = PatternFill("solid", fgColor="14B8A6")

    def write_section(heading: str, rows: list):
        ws.append([heading])
        cell = ws.cell(ws.max_row, 1)
        cell.font = section_font
        cell.fill = section_fill
        for row in rows:
            ws.append(row)
        ws.append([])

    # Header
    ws.append([title])
    ws.cell(1, 1).font = Font(bold=True, size=14)
    ws.append(["Période :", period])
    ws.append([])

    write_section("Résumé Commercial", [
        ["Chiffre d'affaires",       round(float(kpis.get("ventes_total") or 0), 2), "MAD"],
        ["Achats totaux",             round(float(kpis.get("achats_total") or 0), 2), "MAD"],
        ["Transactions ventes",       kpis.get("ventes_count") or 0,                  ""],
        ["Ticket moyen",              adv["ticket_moyen"],                             "MAD"],
        ["Vente moyenne / jour",      adv["vente_moyenne_par_jour"],                   "MAD"],
    ])

    write_section("Analyse des Marges", [
        ["Marge brute",               marge["marge_brute_dh"], "MAD"],
        ["Marge nette (HT)",          marge["marge_nette_dh"], "MAD"],
        ["Taux de marge",             marge["marge_pct"],      "%"],
    ])

    write_section("TVA", [
        ["TVA encaissée (ventes)",    tva["tva_encaissee"],    "MAD"],
        ["TVA payée (achats)",        tva["tva_payee"],        "MAD"],
        ["TVA à déclarer",            tva["tva_a_declarer"],   "MAD"],
    ])

    ws.column_dimensions["A"].width = 38
    ws.column_dimensions["B"].width = 18
    ws.column_dimensions["C"].width = 8

    # ── Sheet 2: Liste des Médicaments ────────────────────────────────────────
    ws2 = wb.create_sheet("Produits")
    med_headers = [
        "Médicament", "Catégorie", "Type", "TVA",
        "PPH HT (MAD)", "PPV TTC (MAD)", "PPV HT (MAD)",
        "Marge %", "Marge Brute (MAD)", "Marge Nette (MAD)",
        "Qté vendue", "CA TTC (MAD)", "TVA encaissée (MAD)",
    ]
    ws2.append(med_headers)
    for col in range(1, len(med_headers) + 1):
        c = ws2.cell(1, col)
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor="14B8A6")

    for r in (med_rows or []):
        tva_rate = _parse_tva_rate(r.tva)
        pph   = float(r.pph  or 0)
        ppv   = float(r.ppv  or 0)
        qty   = float(r.qty  or 0)
        total = float(r.total or 0)

        ppv_ht     = round(ppv / (1 + tva_rate), 4) if tva_rate > 0 and ppv else ppv
        marge_pct  = round((1 - pph / ppv) * 100, 2) if ppv and pph else "—"
        marge_brut = round((ppv - pph) * qty, 2)      if ppv and pph else "—"
        marge_net  = round((ppv_ht - pph) * qty, 2)   if ppv and pph else "—"
        tva_enc    = round(total * tva_rate, 2)

        ws2.append([
            r.product or "—",
            _strip_pct(r.category or ""),
            _resolve_type(r.product_type, r.category),
            r.tva or "—",
            round(pph, 4) if pph else "—",
            round(ppv, 4) if ppv else "—",
            round(ppv_ht, 4) if ppv else "—",
            marge_pct,
            marge_brut,
            marge_net,
            round(qty, 2),
            round(total, 2),
            tva_enc,
        ])

    ws2.column_dimensions["A"].width = 36
    ws2.column_dimensions["B"].width = 20
    ws2.column_dimensions["C"].width = 14
    ws2.column_dimensions["D"].width = 8
    ws2.column_dimensions["E"].width = 12
    ws2.column_dimensions["F"].width = 14
    ws2.column_dimensions["G"].width = 14
    ws2.column_dimensions["H"].width = 10
    ws2.column_dimensions["I"].width = 16
    ws2.column_dimensions["J"].width = 16
    ws2.column_dimensions["K"].width = 12
    ws2.column_dimensions["L"].width = 14
    ws2.column_dimensions["M"].width = 16

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf


# ── Owner / Employee pharmacy stats ───────────────────────────────────────────

@router.get("/stats")
def get_stats(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    category_type: str = Query("all"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "admin":
        raise HTTPException(status_code=403, detail="Admins use /admin/stats")

    pharmacy_id = current_user.pharmacy_id
    df = date_from or None
    dt = date_to or None

    cat_filter_v: list = []
    cat_filter_a: list = []
    if category_type == "pharmacie":
        cat_filter_v = [_pharma_expr() == True]
        cat_filter_a = [_pharma_expr() == True]
    elif category_type == "parapharmacie":
        cat_filter_v = [_pharma_expr() == False]
        cat_filter_a = [_pharma_expr() == False]

    # ── KPIs ──────────────────────────────────────────────────────────────────
    vq = db.query(func.sum(Vente.total), func.count(Vente.id))
    aq = db.query(func.sum(Achat.total), func.count(Achat.id))
    if cat_filter_v:
        vq = vq.join(Medicament, Vente.medicament_id == Medicament.id, isouter=True).filter(*cat_filter_v)
    if cat_filter_a:
        aq = aq.join(Medicament, Achat.medicament_id == Medicament.id, isouter=True).filter(*cat_filter_a)
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

    monthly_trend = []
    cursor = trend_start
    while cursor <= trend_end:
        label = _month_label(cursor)
        monthly_trend.append({"month": label, "ventes": v_by_month.get(label, 0.0), "achats": a_by_month.get(label, 0.0)})
        cursor = cursor.replace(month=cursor.month + 1) if cursor.month < 12 else cursor.replace(year=cursor.year + 1, month=1)

    # ── Top categories ────────────────────────────────────────────────────────
    cat_q = (
        db.query(Medicament.category.label("category"), func.sum(Vente.total).label("total"))
        .join(Medicament, Vente.medicament_id == Medicament.id)
        .filter(Medicament.category.isnot(None))
    )
    if cat_filter_v:
        cat_q = cat_q.filter(*cat_filter_v)
    if pharmacy_id:
        cat_q = cat_q.filter(Vente.pharmacy_id == pharmacy_id)
    if df:
        cat_q = cat_q.filter(Vente.date >= df)
    if dt:
        cat_q = cat_q.filter(Vente.date <= dt)
    cat_rows = cat_q.group_by(Medicament.category).all()
    top_categories = _merge_top_categories(cat_rows)

    extra = _compute_extra_stats(db, pharmacy_id, df, dt, category_type)

    return {
        "kpis": {
            "ventes_total": float(ventes_total or 0),
            "achats_total": float(achats_total or 0),
            "ventes_count": ventes_count or 0,
            "achats_count": achats_count or 0,
        },
        **extra,
        "monthly_trend": monthly_trend,
        "top_categories": top_categories,
    }


# ── Analyse de marge helper ───────────────────────────────────────────────────

def _compute_analyse_marge(db, pharmacy_id, df, dt, category_type, mode):
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

    cat_filter: list = []
    if category_type == "pharmacie":
        cat_filter = [_pharma_expr() == True]
    elif category_type == "parapharmacie":
        cat_filter = [_pharma_expr() == False]

    rows_out = []

    if mode == "produit":
        q = (
            db.query(
                Medicament.product,
                Medicament.category,
                Medicament.tva,
                Medicament.ppv,
                Medicament.pph,
                func.sum(Vente.quantity).label("qty"),
                func.sum(Vente.total).label("ca"),
                func.max(Vente.unit_price).label("prix_max"),
                func.min(Vente.unit_price).label("prix_min"),
                func.avg(Vente.unit_price).label("prix_avg"),
            )
            .join(Medicament, Vente.medicament_id == Medicament.id)
            .filter(*base_filter_v, *cat_filter)
            .group_by(
                Medicament.id, Medicament.product, Medicament.category,
                Medicament.tva, Medicament.ppv, Medicament.pph,
            )
        )
        for r in q.all():
            ppv = float(r.ppv or 0)
            pph = float(r.pph or 0)
            marge_pct = round((1 - pph / ppv) * 100, 2) if ppv and pph else None
            marge_dh  = round(ppv - pph, 4) if ppv and pph else None
            rows_out.append({
                "product":   r.product or "—",
                "category":  _strip_pct(r.category or ""),
                "tva":       r.tva or "—",
                "ppv":       round(ppv, 4) if ppv else None,
                "prix_max":  round(float(r.prix_max or 0), 4),
                "prix_min":  round(float(r.prix_min or 0), 4),
                "prix_avg":  round(float(r.prix_avg or 0), 4),
                "qty":       round(float(r.qty or 0), 2),
                "ca":        round(float(r.ca or 0), 2),
                "marge_pct": marge_pct,
                "marge_dh":  marge_dh,
            })

    elif mode == "categorie":
        q = (
            db.query(
                Medicament.category,
                func.sum(Vente.quantity).label("qty"),
                func.sum(Vente.total).label("ca"),
                func.max(Vente.unit_price).label("prix_max"),
                func.min(Vente.unit_price).label("prix_min"),
                func.avg(Vente.unit_price).label("prix_avg"),
            )
            .join(Medicament, Vente.medicament_id == Medicament.id)
            .filter(*base_filter_v, *cat_filter)
            .group_by(Medicament.category)
        )
        # For marge per category: fetch ppv/pph per medicament, compute weighted avg
        med_marge_q = (
            db.query(
                Medicament.category,
                Medicament.ppv,
                Medicament.pph,
                func.sum(Vente.quantity).label("qty"),
            )
            .join(Medicament, Vente.medicament_id == Medicament.id)
            .filter(*base_filter_v, *cat_filter,
                    Medicament.ppv.isnot(None), Medicament.pph.isnot(None))
            .group_by(Medicament.id, Medicament.category, Medicament.ppv, Medicament.pph)
        )
        # Build category → weighted marge
        cat_margin: dict = {}
        for m in med_marge_q.all():
            key = _strip_pct(m.category or "")
            qty = float(m.qty or 0)
            ppv = float(m.ppv or 0)
            pph = float(m.pph or 0)
            if key not in cat_margin:
                cat_margin[key] = {"sum_qty_pct": 0.0, "sum_qty_dh": 0.0, "total_qty": 0.0}
            marge_pct = (1 - pph / ppv) * 100 if ppv else 0
            cat_margin[key]["sum_qty_pct"] += qty * marge_pct
            cat_margin[key]["sum_qty_dh"]  += qty * (ppv - pph)
            cat_margin[key]["total_qty"]   += qty

        for r in q.all():
            key = _strip_pct(r.category or "")
            m = cat_margin.get(key)
            total_qty = m["total_qty"] if m else 0
            marge_pct_avg = round(m["sum_qty_pct"] / total_qty, 2) if m and total_qty else None
            marge_dh_avg  = round(m["sum_qty_dh"]  / total_qty, 2) if m and total_qty else None
            rows_out.append({
                "category":      key or "—",
                "prix_max":      round(float(r.prix_max or 0), 4),
                "prix_min":      round(float(r.prix_min or 0), 4),
                "prix_avg":      round(float(r.prix_avg or 0), 4),
                "qty":           round(float(r.qty or 0), 2),
                "ca":            round(float(r.ca or 0), 2),
                "marge_pct_avg": marge_pct_avg,
                "marge_dh_avg":  marge_dh_avg,
            })

    elif mode == "fournisseur":
        supplier_meds = (
            db.query(Achat.supplier, Achat.medicament_id)
            .filter(*base_filter_a)
            .distinct()
            .subquery()
        )
        q = (
            db.query(
                supplier_meds.c.supplier,
                func.sum(Vente.quantity).label("qty"),
                func.sum(Vente.total).label("ca"),
                func.max(Vente.unit_price).label("prix_max"),
                func.min(Vente.unit_price).label("prix_min"),
                func.avg(Vente.unit_price).label("prix_avg"),
            )
            .join(Vente, Vente.medicament_id == supplier_meds.c.medicament_id)
            .filter(*base_filter_v)
            .group_by(supplier_meds.c.supplier)
        )
        for r in q.all():
            rows_out.append({
                "supplier": r.supplier or "—",
                "prix_max": round(float(r.prix_max or 0), 4),
                "prix_min": round(float(r.prix_min or 0), 4),
                "prix_avg": round(float(r.prix_avg or 0), 4),
                "qty":      round(float(r.qty or 0), 2),
                "ca":       round(float(r.ca or 0), 2),
            })

    elif mode == "bl":
        q = (
            db.query(
                Achat.delivery_ref,
                Achat.supplier,
                Achat.delivery_date,
                func.count(Achat.medicament_id.distinct()).label("nb_produits"),
                func.sum(Achat.quantity).label("qty"),
                func.sum(Achat.total).label("total"),
            )
            .filter(*base_filter_a)
            .group_by(Achat.delivery_ref, Achat.supplier, Achat.delivery_date)
            .order_by(Achat.delivery_date.desc())
        )
        for r in q.all():
            rows_out.append({
                "delivery_ref":  r.delivery_ref or "—",
                "supplier":      r.supplier or "—",
                "delivery_date": r.delivery_date or "—",
                "nb_produits":   r.nb_produits or 0,
                "qty":           round(float(r.qty or 0), 2),
                "total":         round(float(r.total or 0), 2),
            })

    # ── KPI computation ────────────────────────────────────────────────────────
    total_ventes_dh    = sum(r.get("ca", r.get("total", 0)) or 0 for r in rows_out)
    total_ventes_unites = sum(float(r.get("qty") or 0) for r in rows_out)

    marge_rows = [r for r in rows_out if r.get("marge_pct") is not None]
    marge_avg_rows = [r for r in rows_out if r.get("marge_pct_avg") is not None]

    kpis: dict = {
        "total_ventes_dh":    round(total_ventes_dh, 2),
        "total_ventes_unites": round(total_ventes_unites, 2),
        "marge_pct_avg":      None,
        "marge_pct_min":      None,
        "marge_pct_max":      None,
        "marge_dh_avg":       None,
        "marge_dh_min":       None,
        "marge_dh_max":       None,
        "difference_gain_dh": None,
    }

    if marge_rows:
        # weighted avg marge % using qty
        total_qty = sum(float(r["qty"] or 0) for r in marge_rows)
        if total_qty:
            kpis["marge_pct_avg"] = round(
                sum(float(r["qty"] or 0) * float(r["marge_pct"] or 0) for r in marge_rows) / total_qty, 2
            )
            kpis["marge_dh_avg"] = round(
                sum(float(r["qty"] or 0) * float(r["marge_dh"] or 0) for r in marge_rows) / total_qty, 2
            )
        best_pct  = max(marge_rows, key=lambda r: r["marge_pct"])
        worst_pct = min(marge_rows, key=lambda r: r["marge_pct"])
        best_dh   = max(marge_rows, key=lambda r: r["marge_dh"])
        worst_dh  = min(marge_rows, key=lambda r: r["marge_dh"])
        label_key = "product"
        kpis["marge_pct_max"] = {"label": best_pct[label_key],  "value": best_pct["marge_pct"],  "qty": best_pct["qty"]}
        kpis["marge_pct_min"] = {"label": worst_pct[label_key], "value": worst_pct["marge_pct"], "qty": worst_pct["qty"]}
        kpis["marge_dh_max"]  = {"label": best_dh[label_key],   "value": best_dh["marge_dh"],   "qty": best_dh["qty"]}
        kpis["marge_dh_min"]  = {"label": worst_dh[label_key],  "value": worst_dh["marge_dh"],  "qty": worst_dh["qty"]}
        kpis["difference_gain_dh"] = round(
            float(best_dh["qty"] or 0) * float(best_dh["marge_dh"] or 0) -
            float(worst_dh["qty"] or 0) * float(worst_dh["marge_dh"] or 0),
            2,
        )
    elif marge_avg_rows:
        # categorie mode — use marge_pct_avg / marge_dh_avg
        total_qty = sum(float(r["qty"] or 0) for r in marge_avg_rows)
        if total_qty:
            kpis["marge_pct_avg"] = round(
                sum(float(r["qty"] or 0) * float(r["marge_pct_avg"] or 0) for r in marge_avg_rows) / total_qty, 2
            )
            kpis["marge_dh_avg"] = round(
                sum(float(r["qty"] or 0) * float(r["marge_dh_avg"] or 0) for r in marge_avg_rows) / total_qty, 2
            )
        best_pct  = max(marge_avg_rows, key=lambda r: r["marge_pct_avg"])
        worst_pct = min(marge_avg_rows, key=lambda r: r["marge_pct_avg"])
        best_dh   = max(marge_avg_rows, key=lambda r: r["marge_dh_avg"])
        worst_dh  = min(marge_avg_rows, key=lambda r: r["marge_dh_avg"])
        kpis["marge_pct_max"] = {"label": best_pct["category"],  "value": best_pct["marge_pct_avg"],  "qty": best_pct["qty"]}
        kpis["marge_pct_min"] = {"label": worst_pct["category"], "value": worst_pct["marge_pct_avg"], "qty": worst_pct["qty"]}
        kpis["marge_dh_max"]  = {"label": best_dh["category"],   "value": best_dh["marge_dh_avg"],   "qty": best_dh["qty"]}
        kpis["marge_dh_min"]  = {"label": worst_dh["category"],  "value": worst_dh["marge_dh_avg"],  "qty": worst_dh["qty"]}
        kpis["difference_gain_dh"] = round(
            float(best_dh["qty"] or 0) * float(best_dh["marge_dh_avg"] or 0) -
            float(worst_dh["qty"] or 0) * float(worst_dh["marge_dh_avg"] or 0),
            2,
        )

    return {"kpis": kpis, "rows": rows_out}


@router.get("/stats/analyse-marge")
def stats_analyse_marge(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    category_type: str = Query("all"),
    mode: str = Query("produit"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "admin":
        raise HTTPException(status_code=403, detail="Admins use /admin/pharmacy/{id}/stats/analyse-marge")
    return _compute_analyse_marge(
        db, current_user.pharmacy_id, date_from or None, date_to or None, category_type, mode
    )


# ── Excel export (pharmacy user) ───────────────────────────────────────────────

@router.get("/stats/export-excel")
def export_stats_excel(
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    category_type: str = Query("all"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "admin":
        raise HTTPException(status_code=403, detail="Admins use /admin/pharmacy/{id}/stats/export-excel")

    df, dt = date_from or None, date_to or None
    pharmacy_id = current_user.pharmacy_id

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

    extra = _compute_extra_stats(db, pharmacy_id, df, dt, category_type)

    titles = {"all": "Rapport Analytique", "pharmacie": "Rapport Pharmacie", "parapharmacie": "Rapport Parapharmacie"}
    title = titles.get(category_type, "Rapport Analytique")
    period = f"{df or 'Toutes dates'} → {dt or 'aujourd\'hui'}"

    kpis = {
        "ventes_total": float(ventes_total or 0),
        "achats_total": float(achats_total or 0),
        "ventes_count": ventes_count or 0,
        "achats_count": achats_count or 0,
    }

    cat_filter = ([_pharma_expr() == True] if category_type == "pharmacie"
                  else [_pharma_expr() == False] if category_type == "parapharmacie"
                  else None)
    med_rows = _fetch_med_rows(db, pharmacy_id, df, dt, cat_filter)
    buf = _build_excel(title, period, kpis, extra, med_rows)
    filename = f"rapport_{category_type}_{df or 'all'}_{dt or 'all'}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── Admin system stats ────────────────────────────────────────────────────────

@router.get("/admin/pharmacy/{pharmacy_id}/stats")
def get_pharmacy_stats_for_admin(
    pharmacy_id: int,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    df = date_from or None
    dt = date_to or None

    vq = db.query(func.sum(Vente.total), func.count(Vente.id)).filter(Vente.pharmacy_id == pharmacy_id)
    aq = db.query(func.sum(Achat.total), func.count(Achat.id)).filter(Achat.pharmacy_id == pharmacy_id)
    if df:
        vq = vq.filter(Vente.date >= df)
        aq = aq.filter(Achat.delivery_date >= df)
    if dt:
        vq = vq.filter(Vente.date <= dt)
        aq = aq.filter(Achat.delivery_date <= dt)
    ventes_total, ventes_count = vq.one()
    achats_total, achats_count = aq.one()

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
    v_by_month = {
        _month_label(r.month.date()): float(r.total or 0)
        for r in db.query(
            func.date_trunc("month", func.cast(Vente.date, Date)).label("month"),
            func.sum(Vente.total).label("total"),
        ).filter(Vente.pharmacy_id == pharmacy_id, Vente.date >= trend_start_str, Vente.date < trend_end_str)
        .group_by("month").all()
    }
    a_by_month = {
        _month_label(r.month.date()): float(r.total or 0)
        for r in db.query(
            func.date_trunc("month", func.cast(Achat.delivery_date, Date)).label("month"),
            func.sum(Achat.total).label("total"),
        ).filter(Achat.pharmacy_id == pharmacy_id, Achat.delivery_date >= trend_start_str, Achat.delivery_date < trend_end_str)
        .group_by("month").all()
    }
    monthly_trend = []
    cursor = trend_start
    while cursor <= trend_end:
        label = _month_label(cursor)
        monthly_trend.append({"month": label, "ventes": v_by_month.get(label, 0.0), "achats": a_by_month.get(label, 0.0)})
        cursor = cursor.replace(month=cursor.month + 1) if cursor.month < 12 else cursor.replace(year=cursor.year + 1, month=1)

    cat_q = (
        db.query(Medicament.category.label("category"), func.sum(Vente.total).label("total"))
        .join(Medicament, Vente.medicament_id == Medicament.id)
        .filter(Vente.pharmacy_id == pharmacy_id, Medicament.category.isnot(None))
    )
    if df:
        cat_q = cat_q.filter(Vente.date >= df)
    if dt:
        cat_q = cat_q.filter(Vente.date <= dt)
    cat_rows = cat_q.group_by(Medicament.category).all()
    top_categories = _merge_top_categories(cat_rows)

    extra = _compute_extra_stats(db, pharmacy_id, df, dt)

    return {
        "kpis": {
            "ventes_total": float(ventes_total or 0),
            "achats_total": float(achats_total or 0),
            "ventes_count": ventes_count or 0,
            "achats_count": achats_count or 0,
        },
        **extra,
        "monthly_trend": monthly_trend,
        "top_categories": top_categories,
    }


# ── Admin Excel export for a specific pharmacy ────────────────────────────────

@router.get("/admin/pharmacy/{pharmacy_id}/stats/export-excel")
def export_pharmacy_stats_excel(
    pharmacy_id: int,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    category_type: str = Query("all"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    df, dt = date_from or None, date_to or None

    vq = db.query(func.sum(Vente.total), func.count(Vente.id)).filter(Vente.pharmacy_id == pharmacy_id)
    aq = db.query(func.sum(Achat.total), func.count(Achat.id)).filter(Achat.pharmacy_id == pharmacy_id)
    if df:
        vq = vq.filter(Vente.date >= df)
        aq = aq.filter(Achat.delivery_date >= df)
    if dt:
        vq = vq.filter(Vente.date <= dt)
        aq = aq.filter(Achat.delivery_date <= dt)
    ventes_total, ventes_count = vq.one()
    achats_total, achats_count = aq.one()

    extra = _compute_extra_stats(db, pharmacy_id, df, dt, category_type)

    titles = {"all": "Rapport Analytique", "pharmacie": "Rapport Pharmacie", "parapharmacie": "Rapport Parapharmacie"}
    title = titles.get(category_type, "Rapport Analytique")
    period = f"{df or 'Toutes dates'} → {dt or 'aujourd\'hui'}"
    kpis = {
        "ventes_total": float(ventes_total or 0),
        "achats_total": float(achats_total or 0),
        "ventes_count": ventes_count or 0,
        "achats_count": achats_count or 0,
    }

    cat_filter = ([_pharma_expr() == True] if category_type == "pharmacie"
                  else [_pharma_expr() == False] if category_type == "parapharmacie"
                  else None)
    med_rows = _fetch_med_rows(db, pharmacy_id, df, dt, cat_filter)
    buf = _build_excel(title, period, kpis, extra, med_rows)
    filename = f"rapport_pharmacie{pharmacy_id}_{category_type}_{df or 'all'}_{dt or 'all'}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/admin/pharmacy/{pharmacy_id}/stats/analyse-marge")
def admin_analyse_marge(
    pharmacy_id: int,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    category_type: str = Query("all"),
    mode: str = Query("produit"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return _compute_analyse_marge(
        db, pharmacy_id, date_from or None, date_to or None, category_type, mode
    )


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
