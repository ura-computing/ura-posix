"""Stock ABCD analysis — classifies pharmacy products by sales velocity."""

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


# PG-001/PG-002: 4-band status keyed on days-of-coverage, plus "inconnu"/"negatif"
# for missing-data / data-quality cases. Client-confirmed thresholds.
STOCK_STATUS_KEYS = ("sous-stock", "ideal", "a-surveiller", "sur-stock", "inconnu", "negatif")


def _stock_status_from_coverage(current_stock: int | None, units_sold_12m: int) -> str:
    """Status based on `current_stock × 365 / ventes_12m` (days of coverage).
    Bands: ≤45 sous-stock · 46-60 idéal · 61-99 à surveiller · ≥100 sur-stock."""
    if current_stock is None:
        return "inconnu"
    if current_stock < 0:
        return "negatif"
    if not units_sold_12m or units_sold_12m <= 0:
        # No sales history → can't compute coverage meaningfully.
        return "inconnu"
    days = current_stock * 365.0 / units_sold_12m
    if days <= 45:
        return "sous-stock"
    if days <= 60:
        return "ideal"
    if days <= 99:
        return "a-surveiller"
    return "sur-stock"


def _stock_min_for(units_sold_12m: int) -> int:
    """Displayed `Stock Min` = round(ventes_12m × 45 / 365) — boundary into the idéal band."""
    if not units_sold_12m or units_sold_12m <= 0:
        return 0
    return round(units_sold_12m * 45 / 365)


def _stock_max_for(units_sold_12m: int) -> int:
    """Displayed `Stock Max` = round(ventes_12m × 60 / 365) — top of the idéal band."""
    if not units_sold_12m or units_sold_12m <= 0:
        return 0
    return round(units_sold_12m * 60 / 365)


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
    # PG-001/PG-002: Sobrus's snapshot `stock_min/max` values are intentionally NOT read
    # here. Targets are derived from the client-confirmed idéal band × avg daily sales
    # (see `_stock_min_for` / `_stock_max_for`). The PharmacyStock columns stay in the
    # schema so ingestion keeps populating them.
    stock_sub = (
        db.query(
            PharmacyStock.medicament_id,
            PharmacyStock.current_stock,
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

        # Classify (ABCD class is independent from the new stock status)
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

        # Targets + status from days-of-coverage (PG-001 / PG-002).
        stock_min = _stock_min_for(units)
        stock_max = _stock_max_for(units)
        current_stock = int(r.current_stock) if r.current_stock is not None else None
        status_val = _stock_status_from_coverage(current_stock, units)

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
            "status": status_val,
        })

    total_references = len(products)
    distribution = {k: v for k, v in distribution.items() if v > 0}

    # Apply optional filters
    if class_filter:
        products = [p for p in products if p["category"] == class_filter]
    if status:
        # Comma-separated values supported, e.g. ?status=sous-stock,a-surveiller
        wanted = {s.strip() for s in status.split(",") if s.strip()}
        if wanted:
            products = [p for p in products if p["status"] in wanted]
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
