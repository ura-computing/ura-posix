"""Stock peremptions (expiry monitoring) — classifies products by expiry proximity."""

from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import Achat, Medicament, PharmacyMedicamentStatus


def _compute_peremptions(db: Session, pharmacy_id: int, df: str | None, dt: str | None) -> dict:
    """
    For each medicament in the pharmacy's achats that has an expiry_date,
    get the latest achat record per medicament and classify by expiry proximity.

    Brackets:
      - expired:    expiry_date < today
      - very_close: today <= expiry_date < today + 6 months
      - close:      today + 6 months <= expiry_date < today + 12 months

    Returns { expired: {...}, very_close: {...}, close: {...} }.
    """
    today = date.today()
    boundary_6m = today + timedelta(days=6 * 30)   # ~6 months
    boundary_12m = today + timedelta(days=12 * 30)  # ~12 months

    today_str = today.isoformat()
    boundary_6m_str = boundary_6m.isoformat()
    boundary_12m_str = boundary_12m.isoformat()

    # ── Non-declared products filter ─────────────────────────────────────────
    non_declared_sub = (
        db.query(PharmacyMedicamentStatus.medicament_id)
        .filter(
            PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
            PharmacyMedicamentStatus.declared == False,
        )
        .subquery()
    )

    # ── Latest achat per medicament (most recent delivery) ───────────────────
    latest_achat_rn = (
        db.query(
            Achat.medicament_id,
            Achat.expiry_date,
            Achat.quantity,
            Achat.unit_price,
            func.row_number()
            .over(
                partition_by=Achat.medicament_id,
                order_by=Achat.delivery_date.desc(),
            )
            .label("rn"),
        )
        .filter(
            Achat.pharmacy_id == pharmacy_id,
            Achat.medicament_id.isnot(None),
            Achat.expiry_date.isnot(None),
            Achat.expiry_date != "",
            Achat.medicament_id.notin_(non_declared_sub),
        )
    )

    # Apply optional date filters on delivery_date
    if df:
        latest_achat_rn = latest_achat_rn.filter(Achat.delivery_date >= df)
    if dt:
        latest_achat_rn = latest_achat_rn.filter(Achat.delivery_date <= dt)

    latest_achat_sub = latest_achat_rn.subquery()

    # Pick only rn == 1 (latest per medicament)
    latest = (
        db.query(
            latest_achat_sub.c.medicament_id,
            latest_achat_sub.c.expiry_date,
            latest_achat_sub.c.quantity,
            latest_achat_sub.c.unit_price,
        )
        .filter(latest_achat_sub.c.rn == 1)
        .subquery()
    )

    # ── Join with Medicament to get product name + PPV ───────────────────────
    rows = (
        db.query(
            Medicament.product,
            latest.c.expiry_date,
            latest.c.quantity,
            latest.c.unit_price,
            Medicament.ppv,
        )
        .join(Medicament, Medicament.id == latest.c.medicament_id)
        .all()
    )

    # ── Classify into brackets ───────────────────────────────────────────────
    brackets: dict[str, dict] = {
        "expired": {"count": 0, "total_units": 0, "purchase_value": 0.0, "sale_value": 0.0, "products": []},
        "very_close": {"count": 0, "total_units": 0, "purchase_value": 0.0, "sale_value": 0.0, "products": []},
        "close": {"count": 0, "total_units": 0, "purchase_value": 0.0, "sale_value": 0.0, "products": []},
    }

    for product_name, expiry_date_str, qty, unit_price, ppv in rows:
        if not expiry_date_str:
            continue

        qty = float(qty or 0)
        unit_price = float(unit_price or 0)
        ppv_val = float(ppv or 0)
        purchase_val = unit_price * qty
        sale_val = ppv_val * qty

        # Classify
        if expiry_date_str < today_str:
            bracket = "expired"
        elif expiry_date_str < boundary_6m_str:
            bracket = "very_close"
        elif expiry_date_str < boundary_12m_str:
            bracket = "close"
        else:
            continue  # Not in any alert bracket

        b = brackets[bracket]
        b["count"] += 1
        b["total_units"] += int(qty)
        b["purchase_value"] += purchase_val
        b["sale_value"] += sale_val
        b["products"].append({
            "product": product_name or "---",
            "expiry_date": expiry_date_str,
            "quantity": int(qty),
            "ppv": ppv_val,
        })

    # ── Sort products by expiry_date ascending, keep top 5 ───────────────────
    for key in brackets:
        brackets[key]["products"].sort(key=lambda p: p["expiry_date"])
        brackets[key]["products"] = brackets[key]["products"][:5]
        brackets[key]["purchase_value"] = round(brackets[key]["purchase_value"], 2)
        brackets[key]["sale_value"] = round(brackets[key]["sale_value"], 2)

    return brackets
