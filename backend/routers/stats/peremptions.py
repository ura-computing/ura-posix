"""Stock peremptions (expiry monitoring) — classifies products by expiry proximity."""

from datetime import date, timedelta

from sqlalchemy.orm import Session

from models import Medicament, PharmacyMedicamentStatus, PharmacyStock


def _compute_peremptions(db: Session, pharmacy_id: int, df: str | None, dt: str | None) -> dict:
    """
    For each medicament in the pharmacy's current stock (PharmacyStock) with an
    expiry_date, classify by expiry proximity.

    Brackets:
      - expired:    expiry_date < today
      - very_close: today <= expiry_date < today + 6 months
      - close:      today + 6 months <= expiry_date < today + 12 months

    Returns { expired: {...}, very_close: {...}, close: {...} }.

    Note: date filters (df, dt) are no longer meaningful since stock is a
    live snapshot with no delivery_date; they're accepted for API compat but ignored.
    """
    _ = df, dt  # ignored for compat
    today = date.today()
    boundary_6m = today + timedelta(days=6 * 30)
    boundary_12m = today + timedelta(days=12 * 30)

    non_declared_sub = (
        db.query(PharmacyMedicamentStatus.medicament_id)
        .filter(
            PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
            PharmacyMedicamentStatus.declared == False,
        )
        .subquery()
    )

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
            PharmacyStock.expiry_date.isnot(None),
            PharmacyStock.current_stock > 0,
            PharmacyStock.medicament_id.notin_(non_declared_sub),
        )
        .all()
    )

    brackets: dict[str, dict] = {
        "expired": {"count": 0, "total_units": 0, "purchase_value": 0.0, "sale_value": 0.0, "products": []},
        "very_close": {"count": 0, "total_units": 0, "purchase_value": 0.0, "sale_value": 0.0, "products": []},
        "close": {"count": 0, "total_units": 0, "purchase_value": 0.0, "sale_value": 0.0, "products": []},
    }

    for product_name, expiry_date, qty, ppv, pph in rows:
        if not expiry_date:
            continue

        qty_int = int(qty or 0)
        ppv_val = float(ppv or 0)
        pph_val = float(pph or 0)
        purchase_val = pph_val * qty_int
        sale_val = ppv_val * qty_int

        if expiry_date < today:
            bracket = "expired"
        elif expiry_date < boundary_6m:
            bracket = "very_close"
        elif expiry_date < boundary_12m:
            bracket = "close"
        else:
            continue

        b = brackets[bracket]
        b["count"] += 1
        b["total_units"] += qty_int
        b["purchase_value"] += purchase_val
        b["sale_value"] += sale_val
        b["products"].append({
            "product": product_name or "---",
            "expiry_date": expiry_date.isoformat(),
            "quantity": qty_int,
            "ppv": ppv_val,
        })

    for key in brackets:
        brackets[key]["products"].sort(key=lambda p: p["expiry_date"])
        brackets[key]["products"] = brackets[key]["products"][:5]
        brackets[key]["purchase_value"] = round(brackets[key]["purchase_value"], 2)
        brackets[key]["sale_value"] = round(brackets[key]["sale_value"], 2)

    return brackets
