"""Stock ABCD analysis — classifies pharmacy products by sales velocity."""

import math
from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import Achat, Medicament, PharmacyMedicamentStatus, PharmacyStock, Vente


def _compute_stock_abcd(db: Session, pharmacy_id: int, df: str | None, dt: str | None) -> dict:
    """
    For each medicament sold or stocked by this pharmacy in the last 12 months,
    compute the ABCD class, stock_min, stock_max and current_stock.

    Returns { distribution, total_references, products }.
    """

    # ── Determine 12-month and 4-month windows ────────────────────────────────
    today = date.today()
    if dt:
        end_date = date.fromisoformat(dt)
    else:
        end_date = today

    if df:
        start_12m = date.fromisoformat(df)
    else:
        start_12m = end_date - timedelta(days=365)

    start_4m = end_date - timedelta(days=120)

    start_12m_str = start_12m.isoformat()
    start_4m_str = start_4m.isoformat()
    end_date_str = end_date.isoformat()

    # ── Non-declared products filter ──────────────────────────────────────────
    non_declared_sub = (
        db.query(PharmacyMedicamentStatus.medicament_id)
        .filter(
            PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
            PharmacyMedicamentStatus.declared == False,
        )
        .subquery()
    )

    # ── Total units sold per medicament in 12 months ──────────────────────────
    sales_12m = (
        db.query(
            Vente.medicament_id,
            func.sum(Vente.quantity).label("units_sold_12m"),
        )
        .filter(
            Vente.pharmacy_id == pharmacy_id,
            Vente.medicament_id.isnot(None),
            Vente.date >= start_12m_str,
            Vente.date <= end_date_str,
            Vente.medicament_id.notin_(non_declared_sub),
        )
        .group_by(Vente.medicament_id)
        .subquery()
    )

    # ── Total units sold per medicament in last 4 months only ─────────────────
    sales_4m = (
        db.query(
            Vente.medicament_id,
            func.sum(Vente.quantity).label("units_sold_4m"),
        )
        .filter(
            Vente.pharmacy_id == pharmacy_id,
            Vente.medicament_id.isnot(None),
            Vente.date >= start_4m_str,
            Vente.date <= end_date_str,
            Vente.medicament_id.notin_(non_declared_sub),
        )
        .group_by(Vente.medicament_id)
        .subquery()
    )

    # ── Sales *before* the last 4 months (to distinguish C- vs C-N) ──────────
    sales_before_4m = (
        db.query(
            Vente.medicament_id,
            func.sum(Vente.quantity).label("units_before_4m"),
        )
        .filter(
            Vente.pharmacy_id == pharmacy_id,
            Vente.medicament_id.isnot(None),
            Vente.date >= start_12m_str,
            Vente.date < start_4m_str,
            Vente.medicament_id.notin_(non_declared_sub),
        )
        .group_by(Vente.medicament_id)
        .subquery()
    )

    # ── Current stock from PharmacyStock (Sobrus stock snapshot) ──────────────
    stock_sub = (
        db.query(
            PharmacyStock.medicament_id,
            PharmacyStock.current_stock,
            PharmacyStock.stock_min.label("sobrus_stock_min"),
            PharmacyStock.stock_max.label("sobrus_stock_max"),
        )
        .filter(
            PharmacyStock.pharmacy_id == pharmacy_id,
            PharmacyStock.medicament_id.notin_(non_declared_sub),
        )
        .subquery()
    )

    # ── Weighted avg purchase price per medicament ───────────────────────────
    avg_pu_sub = (
        db.query(
            Achat.medicament_id,
            (func.sum(Achat.unit_price * Achat.quantity) / func.sum(Achat.quantity)).label("avg_pu"),
        )
        .filter(
            Achat.pharmacy_id == pharmacy_id,
            Achat.medicament_id.isnot(None),
            Achat.quantity > 0,
            Achat.unit_price.isnot(None),
        )
        .group_by(Achat.medicament_id)
        .subquery()
    )

    # ── Collect all medicament IDs that either had sales or have stock ─────────
    sold_ids = (
        db.query(Vente.medicament_id)
        .filter(
            Vente.pharmacy_id == pharmacy_id,
            Vente.medicament_id.isnot(None),
            Vente.date >= start_12m_str,
            Vente.date <= end_date_str,
            Vente.medicament_id.notin_(non_declared_sub),
        )
        .distinct()
    )
    stocked_ids = (
        db.query(PharmacyStock.medicament_id)
        .filter(
            PharmacyStock.pharmacy_id == pharmacy_id,
            PharmacyStock.medicament_id.notin_(non_declared_sub),
        )
        .distinct()
    )
    all_med_ids = {r[0] for r in sold_ids.all()} | {r[0] for r in stocked_ids.all()}

    if not all_med_ids:
        return {
            "distribution": {},
            "total_references": 0,
            "ppv_potentiel": 0,
            "products": [],
        }

    # ── Main query: join everything ───────────────────────────────────────────
    rows = (
        db.query(
            Medicament.id,
            Medicament.product,
            Medicament.ppv,
            func.coalesce(sales_12m.c.units_sold_12m, 0).label("units_sold_12m"),
            func.coalesce(sales_4m.c.units_sold_4m, 0).label("units_sold_4m"),
            func.coalesce(sales_before_4m.c.units_before_4m, 0).label("units_before_4m"),
            stock_sub.c.current_stock,
            stock_sub.c.sobrus_stock_min,
            stock_sub.c.sobrus_stock_max,
            avg_pu_sub.c.avg_pu,
        )
        .outerjoin(sales_12m, Medicament.id == sales_12m.c.medicament_id)
        .outerjoin(sales_4m, Medicament.id == sales_4m.c.medicament_id)
        .outerjoin(sales_before_4m, Medicament.id == sales_before_4m.c.medicament_id)
        .outerjoin(stock_sub, Medicament.id == stock_sub.c.medicament_id)
        .outerjoin(avg_pu_sub, Medicament.id == avg_pu_sub.c.medicament_id)
        .filter(Medicament.id.in_(all_med_ids))
        .all()
    )

    # ── Classify each product ─────────────────────────────────────────────────
    CLASSES = ["A", "A-", "B+", "B", "C", "C-", "C-N", "D"]
    distribution: dict[str, int] = {c: 0 for c in CLASSES}
    products: list[dict] = []
    ppv_potentiel: float = 0.0

    for r in rows:
        units = int(r.units_sold_12m or 0)
        units_4m = int(r.units_sold_4m or 0)
        units_before = int(r.units_before_4m or 0)
        ratio = units / 300.0

        # Classify
        if units >= 300:
            cat = "A"
        elif units >= 250:
            cat = "A-"
        elif units >= 200:
            cat = "B+"
        elif units >= 48:
            cat = "B"
        elif units >= 6:
            cat = "C"
        elif 1 <= units <= 5:
            # C-N if the product was ONLY sold in the last 4 months (new product)
            if units_before == 0 and units_4m >= 1:
                cat = "C-N"
            else:
                cat = "C-"
        else:
            cat = "D"

        # Prefer Sobrus-provided thresholds when present; else compute
        if r.sobrus_stock_min is not None:
            stock_min = int(r.sobrus_stock_min)
        elif cat in ("C", "C-", "C-N"):
            stock_min = 0
        elif cat == "D":
            stock_min = 0
        else:
            stock_min = math.floor(ratio * 14)

        if r.sobrus_stock_max is not None:
            stock_max = int(r.sobrus_stock_max)
        elif cat in ("C", "C-", "C-N"):
            stock_max = 1
        elif cat == "D":
            stock_max = 0
        else:
            stock_max = math.ceil(ratio * 15)

        current_stock = int(r.current_stock) if r.current_stock is not None else None

        # Accumulate PPV potentiel for products with stock > 0
        if current_stock is not None and current_stock > 0 and r.ppv is not None:
            ppv_potentiel += float(r.ppv) * current_stock

        distribution[cat] += 1
        products.append({
            "product": r.product or "---",
            "category": cat,
            "units_sold_12m": units,
            "stock_min": stock_min,
            "stock_max": stock_max,
            "current_stock": current_stock,
            "ppv": round(float(r.ppv), 2) if r.ppv is not None else None,
            "avg_pu": round(float(r.avg_pu), 4) if r.avg_pu is not None else None,
        })

    # Sort products by units_sold_12m descending
    products.sort(key=lambda p: p["units_sold_12m"], reverse=True)

    # Remove zero-count classes from distribution
    distribution = {k: v for k, v in distribution.items() if v > 0}

    return {
        "distribution": distribution,
        "total_references": len(products),
        "ppv_potentiel": round(ppv_potentiel, 2),
        "products": products,
    }
