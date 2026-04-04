from sqlalchemy import func
from sqlalchemy.orm import Session

from models import Achat, Medicament, PharmacyMedicamentStatus, Vente
from utils.strings import strip_percentage as _strip_pct
from .queries import _pharma_expr


def _compute_analyse_marge(db: Session, pharmacy_id, df, dt, category_type: str, mode: str) -> dict:
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

    cat_filter: list = []
    if category_type == "pharmacie":
        cat_filter = [_pharma_expr() == True]
    elif category_type == "parapharmacie":
        cat_filter = [_pharma_expr() == False]

    rows_out = []

    if mode == "produit":
        avg_pu_sub = (
            db.query(
                Achat.medicament_id,
                (func.sum(Achat.unit_price * Achat.quantity) / func.sum(Achat.quantity)).label("avg_pu"),
            )
            .filter(*base_filter_a)
            .group_by(Achat.medicament_id)
            .subquery()
        )
        q = (
            db.query(
                Medicament.product,
                Medicament.category,
                Medicament.tva,
                Medicament.ppv,
                func.coalesce(avg_pu_sub.c.avg_pu, Medicament.pph).label("pu"),
                func.sum(Vente.quantity).label("qty"),
                func.sum(Vente.total).label("ca"),
                func.max(Vente.unit_price).label("prix_max"),
                func.min(Vente.unit_price).label("prix_min"),
                func.avg(Vente.unit_price).label("prix_avg"),
            )
            .join(Medicament, Vente.medicament_id == Medicament.id)
            .outerjoin(avg_pu_sub, Medicament.id == avg_pu_sub.c.medicament_id)
            .filter(*base_filter_v, *cat_filter)
            .group_by(
                Medicament.id, Medicament.product, Medicament.category,
                Medicament.tva, Medicament.ppv, Medicament.pph, avg_pu_sub.c.avg_pu,
            )
        )
        for r in q.all():
            ppv = float(r.ppv or 0)
            pu  = float(r.pu or 0)
            marge_pct = round((1 - pu / ppv) * 100, 2) if ppv and pu else None
            marge_dh  = round(ppv - pu, 4) if ppv and pu else None
            rows_out.append({
                "product":   r.product or "—",
                "category":  _strip_pct(r.category or ""),
                "tva":       r.tva or "—",
                "ppv":       round(ppv, 4) if ppv else None,
                "pu":        round(pu, 4) if pu else None,
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
        # Weighted marge per category (using avg actual purchase price)
        avg_pu_sub_cat = (
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
                Medicament.category,
                Medicament.ppv,
                func.coalesce(avg_pu_sub_cat.c.avg_pu, Medicament.pph).label("pu"),
                func.sum(Vente.quantity).label("qty"),
            )
            .join(Medicament, Vente.medicament_id == Medicament.id)
            .outerjoin(avg_pu_sub_cat, Medicament.id == avg_pu_sub_cat.c.medicament_id)
            .filter(*base_filter_v, *cat_filter,
                    Medicament.ppv.isnot(None))
            .group_by(Medicament.id, Medicament.category, Medicament.ppv, Medicament.pph, avg_pu_sub_cat.c.avg_pu)
        )
        cat_margin: dict = {}
        for m in med_marge_q.all():
            if m.pu is None:
                continue
            key = _strip_pct(m.category or "")
            qty = float(m.qty or 0)
            ppv = float(m.ppv or 0)
            pu  = float(m.pu or 0)
            if key not in cat_margin:
                cat_margin[key] = {"sum_qty_pct": 0.0, "sum_qty_dh": 0.0, "total_qty": 0.0}
            marge_pct = (1 - pu / ppv) * 100 if ppv else 0
            cat_margin[key]["sum_qty_pct"] += qty * marge_pct
            cat_margin[key]["sum_qty_dh"]  += qty * (ppv - pu)
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

    elif mode == "laboratoire":
        q = (
            db.query(
                Medicament.laboratoire,
                func.sum(Vente.quantity).label("qty"),
                func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)).label("ca"),
                func.max(Vente.unit_price).label("prix_max"),
                func.min(Vente.unit_price).label("prix_min"),
                func.avg(Vente.unit_price).label("prix_avg"),
            )
            .join(Medicament, Vente.medicament_id == Medicament.id)
            .filter(*base_filter_v, *cat_filter)
            .filter(Medicament.laboratoire.isnot(None))
            .group_by(Medicament.laboratoire)
        )
        for r in q.all():
            rows_out.append({
                "laboratoire": r.laboratoire or "—",
                "prix_max": round(float(r.prix_max or 0), 4),
                "prix_min": round(float(r.prix_min or 0), 4),
                "prix_avg": round(float(r.prix_avg or 0), 4),
                "qty":      round(float(r.qty or 0), 2),
                "ca":       round(float(r.ca or 0), 2),
            })

    elif mode == "operateur":
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
        for r in q.all():
            rows_out.append({
                "client":          r.client or "Anonyme",
                "nb_transactions": r.nb_transactions or 0,
                "qty":             round(float(r.qty or 0), 2),
                "ca":              round(float(r.ca or 0), 2),
            })

    elif mode == "mois":
        from sqlalchemy import Date
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
        for r in q.all():
            rows_out.append({
                "mois":            r.mois or "—",
                "nb_transactions": r.nb_transactions or 0,
                "qty":             round(float(r.qty or 0), 2),
                "ca":              round(float(r.ca or 0), 2),
            })

    # ── KPI computation ────────────────────────────────────────────────────────
    total_ventes_dh     = sum(r.get("ca", r.get("total", 0)) or 0 for r in rows_out)
    total_ventes_unites = sum(float(r.get("qty") or 0) for r in rows_out)

    marge_rows     = [r for r in rows_out if r.get("marge_pct") is not None]
    marge_avg_rows = [r for r in rows_out if r.get("marge_pct_avg") is not None]

    kpis: dict = {
        "total_ventes_dh":     round(total_ventes_dh, 2),
        "total_ventes_unites": round(total_ventes_unites, 2),
        "marge_pct_avg":       None,
        "marge_pct_min":       None,
        "marge_pct_max":       None,
        "marge_dh_avg":        None,
        "marge_dh_min":        None,
        "marge_dh_max":        None,
        "difference_gain_dh":  None,
    }

    if marge_rows:
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


def _compute_margin_alerts(db: Session, pharmacy_id, df, dt, category_type: str) -> dict:
    """Group products by margin brackets for the Alertes Marges dashboard section."""

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

    cat_filter: list = []
    if category_type == "pharmacie":
        cat_filter = [_pharma_expr() == True]
    elif category_type == "parapharmacie":
        cat_filter = [_pharma_expr() == False]

    # Weighted average purchase price per product
    avg_pu_sub = (
        db.query(
            Achat.medicament_id,
            (func.sum(Achat.unit_price * Achat.quantity) / func.sum(Achat.quantity)).label("avg_pu"),
        )
        .filter(*base_filter_a)
        .group_by(Achat.medicament_id)
        .subquery()
    )

    q = (
        db.query(
            Medicament.product,
            Medicament.ppv,
            func.coalesce(avg_pu_sub.c.avg_pu, Medicament.pph).label("pu"),
            func.sum(Vente.quantity).label("qty"),
            func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price)).label("ca"),
        )
        .join(Medicament, Vente.medicament_id == Medicament.id)
        .outerjoin(avg_pu_sub, Medicament.id == avg_pu_sub.c.medicament_id)
        .filter(*base_filter_v, *cat_filter)
        .filter(Medicament.ppv.isnot(None))
        .group_by(
            Medicament.id, Medicament.product, Medicament.ppv,
            Medicament.pph, avg_pu_sub.c.avg_pu,
        )
    )

    # Define brackets
    brackets = {
        "negative":  {"min": None, "max": 0},
        "low":       {"min": 0,    "max": 10},
        "medium":    {"min": 10,   "max": 60},
        "high":      {"min": 60,   "max": 90},
        "very_high": {"min": 90,   "max": None},
    }
    result: dict = {
        key: {"count": 0, "total_ca": 0.0, "total_margin_dh": 0.0, "products": []}
        for key in brackets
    }

    for r in q.all():
        ppv = float(r.ppv or 0)
        pu = float(r.pu or 0)
        if not ppv or not pu:
            continue

        marge_pct = round((1 - pu / ppv) * 100, 2)
        ca = float(r.ca or 0)
        qty = float(r.qty or 0)
        margin_dh = round(qty * (ppv - pu), 2)

        # Determine bracket
        bracket_key = None
        for key, bounds in brackets.items():
            lo = bounds["min"]
            hi = bounds["max"]
            if lo is None and marge_pct < hi:
                bracket_key = key
                break
            elif hi is None and marge_pct >= lo:
                bracket_key = key
                break
            elif lo is not None and hi is not None and lo <= marge_pct < hi:
                bracket_key = key
                break
        if bracket_key is None:
            continue

        bucket = result[bracket_key]
        bucket["count"] += 1
        bucket["total_ca"] += ca
        bucket["total_margin_dh"] += margin_dh
        bucket["products"].append({
            "product": r.product or "—",
            "marge_pct": marge_pct,
            "ca": round(ca, 2),
        })

    # Keep only top 5 products per bracket (sorted by absolute margin desc)
    for key in result:
        bucket = result[key]
        bucket["total_ca"] = round(bucket["total_ca"], 2)
        bucket["total_margin_dh"] = round(bucket["total_margin_dh"], 2)
        bucket["products"] = sorted(
            bucket["products"],
            key=lambda p: abs(p["marge_pct"]),
            reverse=True,
        )[:5]

    return result
