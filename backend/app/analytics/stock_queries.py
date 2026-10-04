"""Stock analytics: ABCD classification + peremption brackets.

Ported verbatim from apcm-pharma's `routers/stats/stock.py` +
`routers/stats/peremptions.py`. Formulas are LOCKED (PG-001/002/008 + the
client-confirmed `_stock_min_for` / `_stock_max_for` of 2026-06-15).

ABCD class thresholds (lines per units_sold_12m):
    A  ≥300, A- 250-299, B+ 200-249, B 48-199, C 6-47, C-/C-N 1-5, D 0
    (C-N applies when product was ONLY sold in last 4 months — new product.)

Stock status bands (days_of_coverage = current_stock × 365 / units_sold_12m):
    sous-stock ≤45 · idéal 46-60 · à surveiller 61-99 · sur-stock ≥100
    inconnu when no 12m sales · negatif when current_stock < 0
"""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.models import Achat, Medicament, PharmacyStock, Vente
from app.analytics.query_parts import avg_pu_subquery
from app.core.utils import today as pharmacy_today


STOCK_SORT_KEYS = {
    "product",
    "category",
    "units_sold_12m",
    "stock_min",
    "stock_max",
    "current_stock",
    "ppv",
    "avg_pu",
    "status",
}

STOCK_STATUS_KEYS = ("sous-stock", "ideal", "a-surveiller", "sur-stock", "inconnu", "negatif")

_ABCD_CLASSES = ["A", "A-", "B+", "B", "C", "C-", "C-N", "D"]


def stock_abcd_window(today: date) -> tuple[date, date]:
    """Calendar-aligned 12-month window when no explicit du/au is set.

    Jan-Jun → previous full calendar year. Jul-Dec → rolling Y-1 Jul → Y Jun.
    On 2026-05-02 → (2025-01-01, 2025-12-31). On 2026-07-01 → (2025-07-01, 2026-06-30)."""
    year = today.year
    if today.month <= 6:
        return date(year - 1, 1, 1), date(year - 1, 12, 31)
    return date(year - 1, 7, 1), date(year, 6, 30)


def _stock_status_from_coverage(current_stock: int | None, units_sold_12m: int) -> str:
    if current_stock is None:
        return "inconnu"
    if current_stock < 0:
        return "negatif"
    if not units_sold_12m or units_sold_12m <= 0:
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
    """round(ventes_12m / 300 × 14). Client formula 2026-06-15."""
    if not units_sold_12m or units_sold_12m <= 0:
        return 0
    return round(units_sold_12m / 300 * 14)


def _stock_max_for(units_sold_12m: int) -> int:
    """round(ventes_12m / 300 × 15). One extra day above the min."""
    if not units_sold_12m or units_sold_12m <= 0:
        return 0
    return round(units_sold_12m / 300 * 15)


def _classify_abcd(units: int, units_4m: int, units_before: int) -> str:
    if units >= 300:
        return "A"
    if units >= 250:
        return "A-"
    if units >= 200:
        return "B+"
    if units >= 48:
        return "B"
    if units >= 6:
        return "C"
    if 1 <= units <= 5:
        # C-N when product was ONLY sold in the last 4 months (new product)
        return "C-N" if (units_before == 0 and units_4m >= 1) else "C-"
    return "D"


def _resolve_windows(df: str | None, dt: str | None) -> tuple[str, str, str]:
    """Return (start_12m_iso, start_4m_iso, end_iso) honouring partial inputs."""
    today = pharmacy_today()
    if df and dt:
        start_12m = date.fromisoformat(df)
        end_date = date.fromisoformat(dt)
    elif not df and not dt:
        start_12m, end_date = stock_abcd_window(today)
    else:
        end_date = date.fromisoformat(dt) if dt else today
        start_12m = date.fromisoformat(df) if df else end_date - timedelta(days=365)
    start_4m = end_date - timedelta(days=120)
    return start_12m.isoformat(), start_4m.isoformat(), end_date.isoformat()


def _vente_units_subq(pharmacy_id: int, start: str, end: str, db: Session):
    """Subquery: Σ(quantity) per medicament_id over [start, end]."""
    return (
        db.query(
            Vente.medicament_id,
            func.sum(Vente.quantity).label("units"),
        )
        .filter(
            Vente.pharmacy_id == pharmacy_id,
            Vente.medicament_id.isnot(None),
            Vente.date >= start,
            Vente.date <= end,
        )
        .group_by(Vente.medicament_id)
        .subquery()
    )


def compute_stock_abcd(
    db: Session,
    pharmacy_id: int,
    df: str | None,
    dt: str | None,
    *,
    class_filter: str | None = None,
    status: str | None = None,
    sort_by: str | None = None,
    sort_order: str | None = None,
) -> dict:
    """Return { distribution, total_references, ppv_potentiel, products[] }.

    Distribution + total_references + ppv_potentiel reflect the FULL dataset.
    Only the `products` list is filtered/sorted by class/status/sort.
    """
    start_12m, start_4m, end_date = _resolve_windows(df, dt)

    sales_12m = _vente_units_subq(pharmacy_id, start_12m, end_date, db)
    sales_4m = _vente_units_subq(pharmacy_id, start_4m, end_date, db)
    sales_before_4m_q = (
        db.query(Vente.medicament_id, func.sum(Vente.quantity).label("units"))
        .filter(
            Vente.pharmacy_id == pharmacy_id,
            Vente.medicament_id.isnot(None),
            Vente.date >= start_12m,
            Vente.date < start_4m,
        )
        .group_by(Vente.medicament_id)
        .subquery()
    )

    stock_sub = (
        db.query(PharmacyStock.medicament_id, PharmacyStock.current_stock)
        .filter(
            PharmacyStock.pharmacy_id == pharmacy_id,
        )
        .subquery()
    )

    # Full purchasing history (no window, no exclusions — Comptabilité only).
    avg_pu_sub = avg_pu_subquery(
        db,
        Achat.pharmacy_id == pharmacy_id,
        Achat.medicament_id.isnot(None),
    )

    # Collect every medicament that was either sold or stocked
    sold_ids = (
        db.query(Vente.medicament_id)
        .filter(
            Vente.pharmacy_id == pharmacy_id,
            Vente.medicament_id.isnot(None),
            Vente.date >= start_12m,
            Vente.date <= end_date,
        )
        .distinct()
    )
    stocked_ids = (
        db.query(PharmacyStock.medicament_id)
        .filter(
            PharmacyStock.pharmacy_id == pharmacy_id,
        )
        .distinct()
    )
    all_med_ids = {r[0] for r in sold_ids.all()} | {r[0] for r in stocked_ids.all()}

    if not all_med_ids:
        return {"distribution": {}, "total_references": 0, "ppv_potentiel": 0.0, "products": []}

    rows = (
        db.query(
            Medicament.id,
            Medicament.product,
            Medicament.ppv,
            func.coalesce(sales_12m.c.units, 0).label("units_sold_12m"),
            func.coalesce(sales_4m.c.units, 0).label("units_sold_4m"),
            func.coalesce(sales_before_4m_q.c.units, 0).label("units_before_4m"),
            stock_sub.c.current_stock,
            avg_pu_sub.c.avg_pu,
        )
        .outerjoin(sales_12m, Medicament.id == sales_12m.c.medicament_id)
        .outerjoin(sales_4m, Medicament.id == sales_4m.c.medicament_id)
        .outerjoin(sales_before_4m_q, Medicament.id == sales_before_4m_q.c.medicament_id)
        .outerjoin(stock_sub, Medicament.id == stock_sub.c.medicament_id)
        .outerjoin(avg_pu_sub, Medicament.id == avg_pu_sub.c.medicament_id)
        .filter(Medicament.id.in_(all_med_ids))
        .all()
    )

    distribution: dict[str, int] = {c: 0 for c in _ABCD_CLASSES}
    products: list[dict] = []
    ppv_potentiel: float = 0.0

    for r in rows:
        units = int(r.units_sold_12m or 0)
        units_4m = int(r.units_sold_4m or 0)
        units_before = int(r.units_before_4m or 0)

        cat = _classify_abcd(units, units_4m, units_before)
        current_stock = int(r.current_stock) if r.current_stock is not None else None
        status_val = _stock_status_from_coverage(current_stock, units)

        if current_stock is not None and current_stock > 0 and r.ppv is not None:
            ppv_potentiel += float(r.ppv) * current_stock

        distribution[cat] += 1
        products.append(
            {
                "product": r.product or "---",
                "category": cat,
                "units_sold_12m": units,
                "stock_min": _stock_min_for(units),
                "stock_max": _stock_max_for(units),
                "current_stock": current_stock,
                "ppv": round(float(r.ppv), 2) if r.ppv is not None else None,
                "avg_pu": round(float(r.avg_pu), 4) if r.avg_pu is not None else None,
                "status": status_val,
            }
        )

    total_references = len(products)
    distribution = {k: v for k, v in distribution.items() if v > 0}

    # Optional filters
    if class_filter:
        products = [p for p in products if p["category"] == class_filter]
    if status:
        wanted = {s.strip() for s in status.split(",") if s.strip()}
        if wanted:
            products = [p for p in products if p["status"] in wanted]

    # Sort (whitelisted)
    if sort_by in STOCK_SORT_KEYS:
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


# ── Peremptions ──────────────────────────────────────────────────────────────


def compute_peremptions(db: Session, pharmacy_id: int) -> dict:
    """4 mutually exclusive buckets keyed on expiry proximity — ports the
    apcm-pharma behavior verbatim (client asked for parity with the old app,
    including its UI labels "<30j"/"<90j" over these 6/12-month windows):

      expired    : expiry_date < today          (already past, regulatory disposal)
      very_close : today ≤ expiry_date < today + 6 months (6×30d)
      close      : today + 6m ≤ expiry_date < today + 12 months (12×30d)
      no_date    : expiry_date IS NULL          (data-quality bucket so products
                                                 without a Sobrus expiry date
                                                 aren't silently dropped)

    Products further out than 12 months are skipped — not urgent enough
    to surface here."""
    today = pharmacy_today()
    boundary_6m = today + timedelta(days=6 * 30)
    boundary_12m = today + timedelta(days=12 * 30)

    rows = (
        db.query(
            Medicament.product,
            PharmacyStock.expiry_date,
            PharmacyStock.current_stock,
            Medicament.ppv,
            Medicament.pph,
        )
        .join(Medicament, Medicament.id == PharmacyStock.medicament_id)
        .filter(
            PharmacyStock.pharmacy_id == pharmacy_id,
            PharmacyStock.current_stock > 0,
        )
        .all()
    )

    brackets: dict[str, dict] = {
        "expired": {"count": 0, "total_units": 0, "purchase_value": 0.0, "sale_value": 0.0, "products": []},
        "very_close": {"count": 0, "total_units": 0, "purchase_value": 0.0, "sale_value": 0.0, "products": []},
        "close": {"count": 0, "total_units": 0, "purchase_value": 0.0, "sale_value": 0.0, "products": []},
        "no_date": {"count": 0, "total_units": 0, "purchase_value": 0.0, "sale_value": 0.0, "products": []},
    }

    for product_name, expiry, qty, ppv, pph in rows:
        if expiry is None:
            key = "no_date"
        elif expiry < today:
            key = "expired"
        elif expiry < boundary_6m:
            key = "very_close"
        elif expiry < boundary_12m:
            key = "close"
        else:
            continue

        qty_int = int(qty or 0)
        ppv_val = float(ppv or 0)
        pph_val = float(pph or 0)

        b = brackets[key]
        b["count"] += 1
        b["total_units"] += qty_int
        b["purchase_value"] += pph_val * qty_int
        b["sale_value"] += ppv_val * qty_int
        b["products"].append(
            {
                "product": product_name or "---",
                "expiry_date": expiry.isoformat() if expiry else None,
                "quantity": qty_int,
                "ppv": ppv_val,
            }
        )

    # date-bucketed lists sort by expiry asc; no_date sorts by product name
    for key in ("expired", "very_close", "close"):
        brackets[key]["products"].sort(key=lambda p: p["expiry_date"])
    brackets["no_date"]["products"].sort(key=lambda p: p["product"])
    for key in brackets:
        brackets[key]["purchase_value"] = round(brackets[key]["purchase_value"], 2)
        brackets[key]["sale_value"] = round(brackets[key]["sale_value"], 2)

    return brackets
