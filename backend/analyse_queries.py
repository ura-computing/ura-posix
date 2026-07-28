"""Analyse de marge query helpers — 1:1 port of apcm-pharma's stats/marge.py +
the analyse-liste matching logic from router.py.

Single-file dispatch over 8 modes (produit / categorie / laboratoire / grossiste /
operateur / mois / annee / liste). Reuses the locked PG-007 (BL exclusion), PG-013
(no PPH fallback), PG-010 (grossiste + laboratoire marge), PG-020 (Diététique →
Pharmacie) invariants via `pharma_expr()` and `achat_bl_filter()`.

Total CA = Σ qty × coalesce(PPV, unit_price) — matches Dashboard /stats so Rapport
↔ Analyse parity holds (locked by previous fix c0536f1).
"""
from __future__ import annotations

from collections import OrderedDict
from typing import Any

from sqlalchemy import Date, and_, func
from sqlalchemy.orm import Session

from csv_parse import strip_accents
from exclusions import achat_exclusion_filter
from models import Achat, Medicament, PharmacyMedicamentStatus, PharmacyStock, Vente
from stats_queries import _strip_pct, pharma_expr


_MONTH_KEYS = ["m01", "m02", "m03", "m04", "m05", "m06", "m07", "m08", "m09", "m10", "m11", "m12"]


def _sanitize_barcode(s: str | None) -> str | None:
    """Keep digit-only strings of length >= 8. Reject Excel-mangled garbage like '8,47E+12'."""
    if not s:
        return None
    cleaned = "".join(ch for ch in str(s) if ch.isdigit())
    return cleaned if len(cleaned) >= 8 else None


# ─── Main dispatch ────────────────────────────────────────────────────────────

def compute_analyse_marge(
    db: Session,
    pharmacy_id: int | None,
    df: str | None,
    dt: str | None,
    category_type: str,
    mode: str,
    product: str | None = None,
) -> dict:
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
            .scalar_subquery()
        )
        base_filter_v.append(Vente.medicament_id.notin_(non_declared_sub))
        base_filter_a.append(Achat.medicament_id.notin_(non_declared_sub))
        # PG-007: exclude pharmacist-excluded BL numbers from achats.
        base_filter_a.append(achat_exclusion_filter(db, pharmacy_id))

    cat_filter: list = []
    if category_type == "pharmacie":
        cat_filter = [pharma_expr() == True]
    elif category_type == "parapharmacie":
        cat_filter = [pharma_expr() == False]

    # Product search (année mode only): filter ventes by product name so the year
    # rows AND the KPI cards both reflect the searched product.
    if mode == "annee" and product and product.strip():
        base_filter_v = [*base_filter_v, Medicament.product.ilike(f"%{product.strip()}%")]

    rows_out: list[dict[str, Any]] = []

    if mode == "produit":
        rows_out = _mode_produit(db, pharmacy_id, base_filter_v, base_filter_a, cat_filter)
    elif mode == "categorie":
        rows_out = _mode_categorie(db, base_filter_v, base_filter_a, cat_filter)
    elif mode == "grossiste":
        rows_out = _mode_grossiste(db, base_filter_v, base_filter_a)
    elif mode == "laboratoire":
        rows_out = _mode_laboratoire(db, base_filter_v, base_filter_a)
    elif mode == "operateur":
        rows_out = _mode_operateur(db, base_filter_v, cat_filter)
    elif mode == "mois":
        rows_out = _mode_mois(db, base_filter_v, cat_filter)
    elif mode == "annee":
        rows_out = _mode_annee(db, base_filter_v, cat_filter)
    # "liste" mode handled by compute_analyse_liste below

    kpis = _compute_kpis(db, base_filter_v, cat_filter, rows_out)
    return {"kpis": kpis, "rows": rows_out}


# ─── Mode: produit ────────────────────────────────────────────────────────────

def _mode_produit(db: Session, pharmacy_id: int | None, base_filter_v: list, base_filter_a: list, cat_filter: list) -> list[dict]:
    """Per-medicament rows: stock_dispo + qty + ca + avg/min/max PU + marge + best/worst margin."""
    achat_prices_sub = (
        db.query(
            Achat.medicament_id,
            (func.sum(Achat.unit_price * Achat.quantity) / func.sum(Achat.quantity)).label("avg_pu"),
            func.max(Achat.unit_price).label("pu_max"),
            func.min(Achat.unit_price).label("pu_min"),
            func.sum(Achat.unit_price * Achat.quantity).label("total_achat_cost"),
        )
        .filter(*base_filter_a, Achat.quantity > 0, Achat.unit_price.isnot(None))
        .group_by(Achat.medicament_id)
        .subquery()
    )

    _stock_q = db.query(PharmacyStock.medicament_id, PharmacyStock.current_stock.label("current_stock"))
    if pharmacy_id:
        _stock_q = _stock_q.filter(PharmacyStock.pharmacy_id == pharmacy_id)
    latest_stock_sub = _stock_q.subquery()

    q = (
        db.query(
            Medicament.product, Medicament.category, Medicament.tva, Medicament.ppv,
            achat_prices_sub.c.avg_pu.label("pu"),
            func.sum(Vente.quantity).label("qty"),
            func.sum(Vente.total).label("ca"),
            achat_prices_sub.c.pu_max.label("prix_max"),
            achat_prices_sub.c.pu_min.label("prix_min"),
            achat_prices_sub.c.avg_pu.label("prix_avg"),
            achat_prices_sub.c.total_achat_cost.label("total_achat_cost"),
            latest_stock_sub.c.current_stock.label("stock_dispo"),
        )
        .join(Medicament, Vente.medicament_id == Medicament.id)
        .outerjoin(achat_prices_sub, Medicament.id == achat_prices_sub.c.medicament_id)
        .outerjoin(latest_stock_sub, Medicament.id == latest_stock_sub.c.medicament_id)
        .filter(*base_filter_v, *cat_filter)
        .group_by(
            Medicament.id, Medicament.product, Medicament.category, Medicament.tva, Medicament.ppv,
            achat_prices_sub.c.avg_pu, achat_prices_sub.c.pu_max, achat_prices_sub.c.pu_min,
            achat_prices_sub.c.total_achat_cost, latest_stock_sub.c.current_stock,
        )
    )

    raw_rows: list[dict] = []
    for r in q.all():
        ppv = float(r.ppv or 0)
        pu  = float(r.pu  or 0)
        stock_dispo = int(r.stock_dispo) if r.stock_dispo is not None else None
        prix_max = float(r.prix_max or 0)
        prix_min = float(r.prix_min or 0)
        marge_pct = round((1 - pu / ppv) * 100, 3) if ppv and pu else None
        marge_dh  = round(ppv - pu, 4) if ppv and pu else None
        marge_pct_best  = round((1 - prix_min / ppv) * 100, 3) if ppv and prix_min else marge_pct
        marge_pct_worst = round((1 - prix_max / ppv) * 100, 3) if ppv and prix_max else marge_pct
        marge_dh_best   = round(ppv - prix_min, 4) if ppv and prix_min else marge_dh
        marge_dh_worst  = round(ppv - prix_max, 4) if ppv and prix_max else marge_dh
        ppv_potentiel = round(ppv * stock_dispo, 2) if ppv > 0 and stock_dispo and stock_dispo > 0 else None
        raw_rows.append({
            "product":          r.product or "—",
            "category":         _strip_pct(r.category or ""),
            "tva":              r.tva or "—",
            "ppv":              round(ppv, 4) if ppv else None,
            "pu":               round(pu, 4) if pu else None,
            "prix_max":         round(prix_max, 4),
            "prix_min":         round(prix_min, 4),
            "prix_avg":         round(float(r.prix_avg or 0), 4),
            "qty":              round(float(r.qty or 0), 2),
            "ca":               round(float(r.ca or 0), 2),
            "marge_pct":        marge_pct,
            "marge_dh":         marge_dh,
            "marge_pct_best":   marge_pct_best,
            "marge_pct_worst":  marge_pct_worst,
            "marge_dh_best":    marge_dh_best,
            "marge_dh_worst":   marge_dh_worst,
            "stock_dispo":      stock_dispo,
            "ppv_potentiel":    ppv_potentiel,
            "total_achat_cost": round(float(r.total_achat_cost or 0), 2) if r.total_achat_cost else None,
        })

    # Merge rows that share the same product name (multiple ids → same display name).
    merged: OrderedDict[str, list[dict]] = OrderedDict()
    for row in raw_rows:
        merged.setdefault(row["product"], []).append(row)

    out: list[dict] = []
    for product_name, group in merged.items():
        if len(group) == 1:
            out.append(group[0])
        else:
            total_qty   = sum(r["qty"] or 0 for r in group)
            total_ca    = sum(r["ca"]  or 0 for r in group)
            all_ppv     = [r["ppv"]         for r in group if r["ppv"]]
            all_stock   = [r["stock_dispo"] for r in group if r["stock_dispo"] is not None]
            ppv         = all_ppv[0] if all_ppv else None
            pu_num = sum((r["pu"] or 0) * (r["qty"] or 0) for r in group if r["pu"])
            pu_den = sum(r["qty"] or 0 for r in group if r["pu"])
            avg_pu = round(pu_num / pu_den, 4) if pu_den > 0 else None
            marge_pct = round((1 - avg_pu / ppv) * 100, 3) if ppv and avg_pu else None
            marge_dh  = round(ppv - avg_pu, 4) if ppv and avg_pu else None
            total_stock = sum(all_stock) if all_stock else None
            ppv_pot = round(ppv * total_stock, 2) if ppv and total_stock and total_stock > 0 else None
            out.append({
                "product": product_name,
                "category": group[0]["category"],
                "tva":      group[0]["tva"],
                "ppv":      ppv,
                "pu":       avg_pu,
                "prix_max": max(r["prix_max"] for r in group),
                "prix_min": min(r["prix_min"] for r in group),
                "prix_avg": round(sum((r["prix_avg"] or 0) * (r["qty"] or 0) for r in group) / total_qty, 4) if total_qty > 0 else 0,
                "qty":      round(total_qty, 2),
                "ca":       round(total_ca, 2),
                "marge_pct": marge_pct,
                "marge_dh":  marge_dh,
                "stock_dispo":  total_stock,
                "ppv_potentiel": ppv_pot,
            })
    return out


# ─── Mode: categorie ──────────────────────────────────────────────────────────

def _mode_categorie(db: Session, base_filter_v: list, base_filter_a: list, cat_filter: list) -> list[dict]:
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
    avg_pu_sub = (
        db.query(
            Achat.medicament_id,
            (func.sum(Achat.unit_price * Achat.quantity) / func.sum(Achat.quantity)).label("avg_pu"),
        )
        .filter(*base_filter_a)
        .group_by(Achat.medicament_id)
        .subquery()
    )
    med_marge_q = (
        db.query(
            Medicament.category, Medicament.ppv,
            avg_pu_sub.c.avg_pu.label("pu"),
            func.sum(Vente.quantity).label("qty"),
        )
        .join(Medicament, Vente.medicament_id == Medicament.id)
        .outerjoin(avg_pu_sub, Medicament.id == avg_pu_sub.c.medicament_id)
        .filter(*base_filter_v, *cat_filter, Medicament.ppv.isnot(None))
        .group_by(Medicament.id, Medicament.category, Medicament.ppv, avg_pu_sub.c.avg_pu)
    )
    cat_margin: dict = {}
    for m in med_marge_q.all():
        if m.pu is None:
            continue
        key = _strip_pct(m.category or "")
        qty = float(m.qty or 0)
        ppv = float(m.ppv or 0)
        pu  = float(m.pu  or 0)
        cat_margin.setdefault(key, {"sum_qty_pct": 0.0, "sum_qty_dh": 0.0, "total_qty": 0.0})
        marge_pct = (1 - pu / ppv) * 100 if ppv else 0
        cat_margin[key]["sum_qty_pct"] += qty * marge_pct
        cat_margin[key]["sum_qty_dh"]  += qty * (ppv - pu)
        cat_margin[key]["total_qty"]   += qty

    out: list[dict] = []
    for r in q.all():
        key = _strip_pct(r.category or "")
        m = cat_margin.get(key)
        total_qty = m["total_qty"] if m else 0
        out.append({
            "category":      key or "—",
            "prix_max":      round(float(r.prix_max or 0), 4),
            "prix_min":      round(float(r.prix_min or 0), 4),
            "prix_avg":      round(float(r.prix_avg or 0), 4),
            "qty":           round(float(r.qty or 0), 2),
            "ca":            round(float(r.ca or 0), 2),
            "marge_pct_avg": round(m["sum_qty_pct"] / total_qty, 3) if m and total_qty else None,
            "marge_dh_avg":  round(m["sum_qty_dh"]  / total_qty, 2) if m and total_qty else None,
        })
    return out


# ─── Mode: grossiste (PG-010) ─────────────────────────────────────────────────

def _supplier_axis(
    db: Session, base_filter_v: list, base_filter_a: list, *, supplier_clause, key: str,
) -> list[dict]:
    """Marge grouped by `Achat.supplier` — the shared engine behind the Grossiste
    and Laboratoire tabs (the two supplier axes). `supplier_clause` selects which
    suppliers belong to this axis (grossiste = name starts "GROSSISTE"; laboratoire
    = every OTHER non-null supplier). `key` is the output field name. CA/qty/prix
    come from Ventes joined by medicament_id; PU + cost from Achats. PG-010 marge."""
    supplier_med_sub = (
        db.query(
            Achat.supplier.label("supplier"),
            Achat.medicament_id.label("medicament_id"),
            (func.sum(Achat.unit_price * Achat.quantity) / func.sum(Achat.quantity)).label("avg_pu"),
            func.sum(Achat.unit_price * Achat.quantity).label("total_cost"),
        )
        .filter(*base_filter_a, Achat.quantity > 0, Achat.unit_price.isnot(None))
        .filter(supplier_clause)
        .group_by(Achat.supplier, Achat.medicament_id)
        .subquery()
    )
    q = (
        db.query(
            supplier_med_sub.c.supplier.label(key),
            func.sum(Vente.quantity).label("qty"),
            func.sum(Vente.total).label("ca"),
            func.max(Vente.unit_price).label("prix_max"),
            func.min(Vente.unit_price).label("prix_min"),
            func.avg(Vente.unit_price).label("prix_avg"),
        )
        .join(Vente, Vente.medicament_id == supplier_med_sub.c.medicament_id)
        .filter(*base_filter_v)
        .group_by(supplier_med_sub.c.supplier)
    )
    med_marge_q = (
        db.query(
            supplier_med_sub.c.supplier.label("supplier"),
            Medicament.ppv,
            supplier_med_sub.c.avg_pu.label("pu"),
            func.sum(Vente.quantity).label("qty"),
        )
        .join(Medicament, Medicament.id == supplier_med_sub.c.medicament_id)
        .join(Vente, Vente.medicament_id == supplier_med_sub.c.medicament_id)
        .filter(*base_filter_v, Medicament.ppv.isnot(None))
        .group_by(supplier_med_sub.c.supplier, supplier_med_sub.c.medicament_id,
                  Medicament.ppv, supplier_med_sub.c.avg_pu)
    )
    margin: dict = {}
    for m in med_marge_q.all():
        if m.pu is None:
            continue
        ppv = float(m.ppv or 0)
        if not ppv:
            continue
        qty = float(m.qty or 0)
        pu  = float(m.pu  or 0)
        bucket = margin.setdefault(m.supplier, {"sum_qty_pct": 0.0, "sum_qty_dh": 0.0, "total_qty": 0.0})
        marge_pct = (1 - pu / ppv) * 100
        bucket["sum_qty_pct"] += qty * marge_pct
        bucket["sum_qty_dh"]  += qty * (ppv - pu)
        bucket["total_qty"]   += qty

    cost_q = (
        db.query(
            supplier_med_sub.c.supplier.label("supplier"),
            func.sum(supplier_med_sub.c.total_cost).label("total_cost"),
        )
        .group_by(supplier_med_sub.c.supplier)
    )
    total_cost = {r.supplier: float(r.total_cost or 0) for r in cost_q.all()}

    out: list[dict] = []
    for r in q.all():
        name = getattr(r, key) or "—"
        m = margin.get(name)
        total_qty = m["total_qty"] if m else 0
        out.append({
            key:                name,
            "prix_max":         round(float(r.prix_max or 0), 4),
            "prix_min":         round(float(r.prix_min or 0), 4),
            "prix_avg":         round(float(r.prix_avg or 0), 4),
            "qty":              round(float(r.qty or 0), 2),
            "ca":               round(float(r.ca or 0), 2),
            "marge_pct_avg":    round(m["sum_qty_pct"] / total_qty, 3) if m and total_qty else None,
            "marge_dh_avg":     round(m["sum_qty_dh"]  / total_qty, 2) if m and total_qty else None,
            "total_achat_cost": round(total_cost.get(name, 0.0), 2),
        })
    return out


def _mode_grossiste(db: Session, base_filter_v: list, base_filter_a: list) -> list[dict]:
    return _supplier_axis(
        db, base_filter_v, base_filter_a,
        supplier_clause=func.upper(Achat.supplier).like("GROSSISTE%"),
        key="grossiste",
    )


# ─── Mode: laboratoire — the non-grossiste suppliers (direct labs / sociétés) ──
# The exact complement of Grossiste over the non-null suppliers, so every
# fournisseur shows in exactly ONE of the two supplier tabs. (Previously grouped
# by the `Medicament.laboratoire` catalogue attribute — filled for only ~7% of
# products and NULL for every direct-supplier product; changed to the supplier
# axis the pharmacist actually purchases from, per the /analyses redesign.)
def _mode_laboratoire(db: Session, base_filter_v: list, base_filter_a: list) -> list[dict]:
    return _supplier_axis(
        db, base_filter_v, base_filter_a,
        supplier_clause=and_(
            Achat.supplier.isnot(None),
            func.upper(Achat.supplier).notlike("GROSSISTE%"),
        ),
        key="laboratoire",
    )


# ─── Mode: operateur (client) ─────────────────────────────────────────────────

def _mode_operateur(db: Session, base_filter_v: list, cat_filter: list) -> list[dict]:
    q = (
        db.query(
            Vente.client,
            func.sum(Vente.quantity).label("qty"),
            func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)).label("ca"),
            func.count(Vente.id).label("nb_transactions"),
        )
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
        .filter(*base_filter_v, *cat_filter)
        .group_by(Vente.client)
    )
    return [{
        "client":          r.client or "Anonyme",
        "nb_transactions": r.nb_transactions or 0,
        "qty":             round(float(r.qty or 0), 2),
        "ca":              round(float(r.ca or 0), 2),
    } for r in q.all()]


# ─── Mode: mois ───────────────────────────────────────────────────────────────

def _mode_mois(db: Session, base_filter_v: list, cat_filter: list) -> list[dict]:
    q = (
        db.query(
            func.to_char(func.cast(Vente.date, Date), "YYYY-MM").label("mois"),
            func.sum(Vente.quantity).label("qty"),
            func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)).label("ca"),
            func.count(Vente.id).label("nb_transactions"),
        )
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
        .filter(*base_filter_v, *cat_filter)
        .group_by("mois")
        .order_by("mois")
    )
    return [{
        "mois":            r.mois or "—",
        "nb_transactions": r.nb_transactions or 0,
        "qty":             round(float(r.qty or 0), 2),
        "ca":              round(float(r.ca or 0), 2),
    } for r in q.all()]


# ─── Mode: annee (pivot) ──────────────────────────────────────────────────────

def _mode_annee(db: Session, base_filter_v: list, cat_filter: list) -> list[dict]:
    # Product filtering (for the search box in année mode) is applied upstream via
    # base_filter_v in compute_analyse_marge, so both these rows AND the KPI cards
    # stay consistent. Each month cell is {"qty", "ca"}.
    q = (
        db.query(
            func.extract("year",  func.cast(Vente.date, Date)).label("annee"),
            func.extract("month", func.cast(Vente.date, Date)).label("mois"),
            func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)).label("ca"),
            func.sum(Vente.quantity).label("qty"),
        )
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
        .filter(*base_filter_v, *cat_filter)
        .group_by("annee", "mois")
    )
    bucket: dict[int, dict] = {}
    for r in q.all():
        yr = int(r.annee or 0)
        mo = int(r.mois or 0)
        if yr == 0 or not (1 <= mo <= 12):
            continue
        row = bucket.setdefault(
            yr,
            {"annee": yr, **{k: {"qty": 0.0, "ca": 0.0} for k in _MONTH_KEYS}, "ca": 0.0, "qty": 0.0},
        )
        row[_MONTH_KEYS[mo - 1]] = {
            "qty": round(float(r.qty or 0), 2),
            "ca":  round(float(r.ca or 0), 2),
        }
        row["ca"]  += float(r.ca or 0)
        row["qty"] += float(r.qty or 0)
    for row in bucket.values():
        row["ca"]  = round(row["ca"], 2)
        row["qty"] = round(row["qty"], 2)
    return sorted(bucket.values(), key=lambda r: r["annee"], reverse=True)


# ─── KPI computation (shared across all modes) ────────────────────────────────

def _compute_kpis(db: Session, base_filter_v: list, cat_filter: list, rows_out: list[dict]) -> dict:
    # Parity with Dashboard /stats: same CA formula so totals match for the same window.
    _ca_q = (
        db.query(func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)))
        .join(Medicament, Vente.medicament_id == Medicament.id, isouter=True)
        .filter(*base_filter_v, *cat_filter)
    )
    total_ventes_dh     = float(_ca_q.scalar() or 0)
    total_ventes_unites = sum(float(r.get("qty") or 0) for r in rows_out)

    total_units_available = sum(float(r.get("stock_dispo")      or 0) for r in rows_out)
    total_pu_purchased    = sum(float(r.get("total_achat_cost") or 0) for r in rows_out)
    ppv_total_available   = sum(float(r.get("ppv_potentiel")    or 0) for r in rows_out)

    marge_rows     = [r for r in rows_out if r.get("marge_pct")     is not None]
    marge_avg_rows = [r for r in rows_out if r.get("marge_pct_avg") is not None]

    kpis: dict = {
        "total_ventes_dh":       round(total_ventes_dh, 2),
        "total_ventes_unites":   round(total_ventes_unites, 2),
        "total_units_available": round(total_units_available, 2) if total_units_available else None,
        "total_pu_purchased":    round(total_pu_purchased, 2)    if total_pu_purchased    else None,
        "ppv_total_available":   round(ppv_total_available, 2)   if ppv_total_available   else None,
        "marge_pct_avg": None, "marge_pct_min": None, "marge_pct_max": None,
        "marge_dh_avg":  None, "marge_dh_min":  None, "marge_dh_max":  None,
        "difference_gain_dh": None,
    }

    if marge_rows:
        total_qty = sum(float(r["qty"] or 0) for r in marge_rows)
        if total_qty:
            # Marge moyenne (%) matches Dashboard's "marge mixte": (1 − Σqty·PU / Σqty·PPV) × 100.
            sum_qty_ppv = sum(float(r["qty"] or 0) * float(r["ppv"] or 0) for r in marge_rows)
            sum_qty_pu  = sum(float(r["qty"] or 0) * float(r["pu"]  or 0) for r in marge_rows)
            kpis["marge_pct_avg"] = round((1 - sum_qty_pu / sum_qty_ppv) * 100, 3) if sum_qty_ppv else None
            kpis["marge_dh_avg"]  = round(
                sum(float(r["qty"] or 0) * float(r["marge_dh"] or 0) for r in marge_rows) / total_qty, 2)
        best_pct_key  = "marge_pct_best"  if "marge_pct_best"  in marge_rows[0] else "marge_pct"
        worst_pct_key = "marge_pct_worst" if "marge_pct_worst" in marge_rows[0] else "marge_pct"
        best_dh_key   = "marge_dh_best"   if "marge_dh_best"   in marge_rows[0] else "marge_dh"
        worst_dh_key  = "marge_dh_worst"  if "marge_dh_worst"  in marge_rows[0] else "marge_dh"
        best_pct  = max(marge_rows, key=lambda r: float(r.get(best_pct_key)  or r["marge_pct"]))
        worst_pct = min(marge_rows, key=lambda r: float(r.get(worst_pct_key) or r["marge_pct"]))
        best_dh   = max(marge_rows, key=lambda r: float(r.get(best_dh_key)   or r["marge_dh"]))
        worst_dh  = min(marge_rows, key=lambda r: float(r.get(worst_dh_key)  or r["marge_dh"]))
        kpis["marge_pct_max"] = {"label": best_pct["product"],  "value": float(best_pct.get(best_pct_key)  or best_pct["marge_pct"]),  "qty": best_pct["qty"]}
        kpis["marge_pct_min"] = {"label": worst_pct["product"], "value": float(worst_pct.get(worst_pct_key) or worst_pct["marge_pct"]), "qty": worst_pct["qty"]}
        kpis["marge_dh_max"]  = {"label": best_dh["product"],   "value": float(best_dh.get(best_dh_key)    or best_dh["marge_dh"]),   "qty": best_dh["qty"]}
        kpis["marge_dh_min"]  = {"label": worst_dh["product"],  "value": float(worst_dh.get(worst_dh_key)  or worst_dh["marge_dh"]),  "qty": worst_dh["qty"]}
        kpis["difference_gain_dh"] = round(
            float(best_dh["qty"] or 0) * float(best_dh["marge_dh"] or 0)
            - float(worst_dh["qty"] or 0) * float(worst_dh["marge_dh"] or 0), 2,
        )
    elif marge_avg_rows:
        sample = marge_avg_rows[0]
        label_key = next((k for k in ("category", "grossiste", "laboratoire") if k in sample), "category")
        total_qty = sum(float(r["qty"] or 0) for r in marge_avg_rows)
        if total_qty:
            kpis["marge_pct_avg"] = round(
                sum(float(r["qty"] or 0) * float(r["marge_pct_avg"] or 0) for r in marge_avg_rows) / total_qty, 3)
            kpis["marge_dh_avg"]  = round(
                sum(float(r["qty"] or 0) * float(r["marge_dh_avg"]  or 0) for r in marge_avg_rows) / total_qty, 2)
        best_pct  = max(marge_avg_rows, key=lambda r: r["marge_pct_avg"])
        worst_pct = min(marge_avg_rows, key=lambda r: r["marge_pct_avg"])
        best_dh   = max(marge_avg_rows, key=lambda r: r["marge_dh_avg"])
        worst_dh  = min(marge_avg_rows, key=lambda r: r["marge_dh_avg"])
        kpis["marge_pct_max"] = {"label": best_pct[label_key],  "value": best_pct["marge_pct_avg"],  "qty": best_pct["qty"]}
        kpis["marge_pct_min"] = {"label": worst_pct[label_key], "value": worst_pct["marge_pct_avg"], "qty": worst_pct["qty"]}
        kpis["marge_dh_max"]  = {"label": best_dh[label_key],   "value": best_dh["marge_dh_avg"],   "qty": best_dh["qty"]}
        kpis["marge_dh_min"]  = {"label": worst_dh[label_key],  "value": worst_dh["marge_dh_avg"],  "qty": worst_dh["qty"]}
        kpis["difference_gain_dh"] = round(
            float(best_dh["qty"] or 0) * float(best_dh["marge_dh_avg"] or 0)
            - float(worst_dh["qty"] or 0) * float(worst_dh["marge_dh_avg"] or 0), 2,
        )

    return kpis


# ─── Liste mode: CSV-upload match against catalogue ───────────────────────────

def compute_analyse_liste(
    db: Session,
    pharmacy_id: int,
    items: list,
    df: str | None,
    dt: str | None,
    category_type: str,
) -> dict:
    """Match an uploaded list of products (by name → barcode1 → barcode2 → PID) against
    the pharmacy's catalogue + ventes. Returns the same shape as compute_analyse_marge
    but every row has `match_status` set ('found' | 'not_found')."""
    normalized_inputs: dict[str, str] = {}
    item_by_norm: dict[str, Any] = {}
    barcode_inputs: list[tuple[Any, list[str]]] = []
    for it in items:
        name = (it.name or "").strip()
        bcs = [b for b in (_sanitize_barcode(it.barcode1), _sanitize_barcode(it.barcode2)) if b]
        if name:
            norm = strip_accents(name.lower())
            normalized_inputs[norm] = name
            item_by_norm[norm] = it
        if bcs:
            barcode_inputs.append((it, bcs))

    if not normalized_inputs and not barcode_inputs:
        return {"kpis": _empty_kpis(), "rows": []}

    med_rows = db.query(
        Medicament.id, Medicament.product, Medicament.pid,
        Medicament.barcode1, Medicament.barcode2,
        Medicament.category, Medicament.tva, Medicament.ppv, Medicament.pph,
    ).all()

    med_lookup     = {strip_accents((m.product or "").strip().lower()): m for m in med_rows}
    pid_to_med     = {str(m.pid).strip(): m for m in med_rows if m.pid}
    barcode_to_med: dict[str, Any] = {}
    for m in med_rows:
        for bc in (_sanitize_barcode(m.barcode1), _sanitize_barcode(m.barcode2)):
            if bc:
                barcode_to_med[bc] = m

    matched_ids: set[int] = set()
    unmatched: list[str] = []
    for norm_name, original_name in normalized_inputs.items():
        found = False
        if norm_name in med_lookup:
            matched_ids.add(med_lookup[norm_name].id); found = True
        else:
            for db_norm, m in med_lookup.items():
                if norm_name in db_norm or db_norm in norm_name:
                    matched_ids.add(m.id); found = True; break
        it = item_by_norm.get(norm_name)
        if not found and it:
            if it.pid and str(it.pid).strip() in pid_to_med:
                matched_ids.add(pid_to_med[str(it.pid).strip()].id); found = True
            else:
                for bc in (_sanitize_barcode(it.barcode1), _sanitize_barcode(it.barcode2)):
                    if bc and bc in barcode_to_med:
                        matched_ids.add(barcode_to_med[bc].id); found = True; break
        if not found:
            unmatched.append(original_name)

    # Run produit mode then filter to matched ids
    full = compute_analyse_marge(db, pharmacy_id, df, dt, category_type, "produit")
    matched_meds_by_id = {m.id: m for m in med_rows if m.id in matched_ids}
    matched_norms_db   = {strip_accents((m.product or "").strip().lower()) for m in matched_meds_by_id.values()}

    matched_rows: list[dict] = []
    covered_norms: set[str] = set()
    for row in full.get("rows", []):
        norm = strip_accents(row.get("product", "").strip().lower())
        if norm in matched_norms_db or any(norm == k or norm in k or k in norm for k in normalized_inputs):
            row["match_status"] = "found"
            matched_rows.append(row)
            covered_norms.add(norm)

    # Stock-only products (no vente in window): synthesize a stub row.
    uncovered = [m for m in matched_meds_by_id.values()
                 if strip_accents((m.product or "").strip().lower()) not in covered_norms]
    if uncovered:
        stock_map = dict(
            db.query(PharmacyStock.medicament_id, PharmacyStock.current_stock)
            .filter(PharmacyStock.pharmacy_id == pharmacy_id,
                    PharmacyStock.medicament_id.in_([m.id for m in uncovered]))
            .all()
        )
        for m in uncovered:
            stock_dispo = stock_map.get(m.id)
            ppv = float(m.ppv or 0)
            ppv_potentiel = round(ppv * stock_dispo, 2) if ppv and stock_dispo else None
            matched_rows.append({
                "product": m.product or "—", "category": _strip_pct(m.category or ""),
                "tva": m.tva, "ppv": round(ppv, 4) if ppv else None,
                "pu": None, "prix_max": None, "prix_min": None, "prix_avg": None,
                "qty": 0, "ca": 0, "marge_pct": None, "marge_dh": None,
                "stock_dispo": stock_dispo, "ppv_potentiel": ppv_potentiel,
                "total_achat_cost": None, "match_status": "found",
            })

    for name in unmatched:
        matched_rows.append({
            "product": name, "match_status": "not_found",
            "category": None, "tva": None, "ppv": None, "pu": None,
            "prix_max": None, "prix_min": None, "prix_avg": None,
            "qty": 0, "ca": 0, "marge_pct": None, "marge_dh": None,
            "stock_dispo": None, "ppv_potentiel": None, "total_achat_cost": None,
        })

    # Recompute KPIs from FOUND rows only (not global)
    found_rows = [r for r in matched_rows if r.get("match_status") == "found"]
    kpis = _compute_kpis_from_liste(found_rows)
    return {"kpis": kpis, "rows": matched_rows}


def _compute_kpis_from_liste(found_rows: list[dict]) -> dict:
    total_ventes_dh       = sum(float(r.get("ca") or 0) for r in found_rows)
    total_ventes_unites   = sum(float(r.get("qty") or 0) for r in found_rows)
    total_units_available = sum(float(r.get("stock_dispo") or 0) for r in found_rows)
    total_pu_purchased    = sum(float(r.get("total_achat_cost") or 0) for r in found_rows)
    ppv_total_available   = sum(float(r.get("ppv_potentiel") or 0) for r in found_rows)
    marge_rows = [r for r in found_rows if r.get("marge_pct") is not None]
    kpis = {
        "total_ventes_dh":       round(total_ventes_dh, 2),
        "total_ventes_unites":   round(total_ventes_unites, 2),
        "total_units_available": round(total_units_available, 2) if total_units_available else None,
        "total_pu_purchased":    round(total_pu_purchased, 2)    if total_pu_purchased    else None,
        "ppv_total_available":   round(ppv_total_available, 2)   if ppv_total_available   else None,
        "marge_pct_avg": None, "marge_pct_min": None, "marge_pct_max": None,
        "marge_dh_avg":  None, "marge_dh_min":  None, "marge_dh_max":  None,
        "difference_gain_dh": None,
    }
    if marge_rows:
        total_qty = sum(float(r["qty"] or 0) for r in marge_rows)
        if total_qty:
            kpis["marge_pct_avg"] = round(
                sum(float(r["qty"] or 0) * float(r["marge_pct"] or 0) for r in marge_rows) / total_qty, 3)
            kpis["marge_dh_avg"] = round(
                sum(float(r["qty"] or 0) * float(r["marge_dh"] or 0) for r in marge_rows) / total_qty, 2)
        best_pct  = max(marge_rows, key=lambda r: float(r["marge_pct"]))
        worst_pct = min(marge_rows, key=lambda r: float(r["marge_pct"]))
        best_dh   = max(marge_rows, key=lambda r: float(r["marge_dh"]))
        worst_dh  = min(marge_rows, key=lambda r: float(r["marge_dh"]))
        kpis["marge_pct_max"] = {"label": best_pct["product"],  "value": best_pct["marge_pct"],  "qty": best_pct["qty"]}
        kpis["marge_pct_min"] = {"label": worst_pct["product"], "value": worst_pct["marge_pct"], "qty": worst_pct["qty"]}
        kpis["marge_dh_max"]  = {"label": best_dh["product"],   "value": best_dh["marge_dh"],   "qty": best_dh["qty"]}
        kpis["marge_dh_min"]  = {"label": worst_dh["product"],  "value": worst_dh["marge_dh"],  "qty": worst_dh["qty"]}
        kpis["difference_gain_dh"] = round(
            float(best_dh["qty"] or 0) * float(best_dh["marge_dh"] or 0)
            - float(worst_dh["qty"] or 0) * float(worst_dh["marge_dh"] or 0), 2,
        )
    return kpis


def _empty_kpis() -> dict:
    return {
        "total_ventes_dh": 0.0, "total_ventes_unites": 0.0,
        "total_units_available": None, "total_pu_purchased": None, "ppv_total_available": None,
        "marge_pct_avg": None, "marge_pct_min": None, "marge_pct_max": None,
        "marge_dh_avg":  None, "marge_dh_min":  None, "marge_dh_max":  None,
        "difference_gain_dh": None,
    }
