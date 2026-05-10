"""Stock ABCD analysis — classifies pharmacy products by sales velocity."""

import math
from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import Achat, Medicament, PharmacyMedicamentStatus, PharmacyStock, Vente
from utils.strings import tokenize_search


_SORT_KEYS = {
    "product", "category", "units_sold_12m", "stock_min", "stock_max",
    "current_stock", "ppv", "avg_pu", "status",
}


def stock_abcd_window(today: date) -> tuple[date, date]:
    """Calendar-aligned analysis window used when no explicit du/au is set.

    - Jan-Jun → full previous calendar year (Jan 1 → Dec 31 of Y-1)
    - Jul-Dec → rolling Y-1 Jul 1 → Y Jun 30

    Examples: on 2026-05-02 returns (2025-01-01, 2025-12-31);
    on 2026-07-01 returns (2025-07-01, 2026-06-30).
    """
    year = today.year
    if today.month <= 6:
        return date(year - 1, 1, 1), date(year - 1, 12, 31)
    return date(year - 1, 7, 1), date(year, 6, 30)


def _stock_status(current_stock: int | None, stock_min: int, stock_max: int) -> str:
    """Compute the human-readable stock status used by the products table."""
    if current_stock is None:
        return "inconnu"
    if current_stock < 0:
        return "negatif"
    if current_stock < stock_min:
        return "sous-stock"
    if current_stock > stock_max:
        return "sur-stock"
    return "ok"


def _compute_stock_abcd(
    db: Session,
    pharmacy_id: int,
    df: str | None,
    dt: str | None,
    class_filter: str | None = None,
    status: str | None = None,
    search: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> dict:
    """
    For each medicament sold or stocked by this pharmacy in the last 12 months,
    compute the ABCD class, stock_min, stock_max and current_stock.

    Distribution + global metrics reflect the full dataset; only `products` is
    filtered/sorted by the optional parameters so the chart still shows the
    big picture.

    Returns { distribution, total_references, ppv_potentiel, products }.
    """

    # ── Determine 12-month and 4-month windows ────────────────────────────────
    # When neither du nor au is supplied we use the calendar-aligned rule
    # (`stock_abcd_window`). When only one bound is supplied we keep the
    # legacy 365-day fallback so the user's partial input still works.
    today = date.today()
    if df and dt:
        start_12m = date.fromisoformat(df)
        end_date = date.fromisoformat(dt)
    elif not df and not dt:
        start_12m, end_date = stock_abcd_window(today)
    else:
        end_date = date.fromisoformat(dt) if dt else today
        start_12m = date.fromisoformat(df) if df else end_date - timedelta(days=365)

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
            "status": _stock_status(current_stock, stock_min, stock_max),
        })

    total_references = len(products)
    distribution = {k: v for k, v in distribution.items() if v > 0}

    # Apply optional filters
    if class_filter:
        products = [p for p in products if p["category"] == class_filter]
    if status:
        products = [p for p in products if p["status"] == status]
    tokens = tokenize_search(search)
    if tokens:
        products = [
            p for p in products
            if all(tok in (p["product"] or "").lower() for tok in tokens)
        ]

    # Apply optional sort, falling back to units_sold_12m desc
    if sort_by in _SORT_KEYS:
        reverse = sort_order != "asc"
        products.sort(
            key=lambda p: (p[sort_by] is None, p[sort_by] if p[sort_by] is not None else 0),
            reverse=reverse,
        )
    else:
        products.sort(key=lambda p: p["units_sold_12m"], reverse=True)

    return {
        "distribution": distribution,
        "total_references": total_references,
        "ppv_potentiel": round(ppv_potentiel, 2),
        "products": products,
    }
