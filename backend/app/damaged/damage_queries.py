"""« Boîtes abîmées » still taken off the free stock: every declaration but « Remis en vente » (Sobrus keeps counting a
damaged box forever, so returned / destroyed ones stay off too)."""

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.models import StockDamage


def damaged_boxes(db: Session, pharmacy_id: int, med_ids: list[int]) -> dict[int, int]:
    """{medicament_id: boxes off the free stock} for these products (absent = 0)."""
    rows = (
        db.query(StockDamage.medicament_id, func.sum(StockDamage.quantity))
        .filter(
            StockDamage.pharmacy_id == pharmacy_id,
            StockDamage.medicament_id.in_(med_ids),
            StockDamage.status != "back_on_sale",
        )
        .group_by(StockDamage.medicament_id)
    )
    return {mid: int(n) for mid, n in rows}
