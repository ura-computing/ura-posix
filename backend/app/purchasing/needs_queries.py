"""Each product's stock picture for ordering (D-6): Sobrus stock (the owner's value when edited), damaged boxes,
reserved boxes, minimum / maximum (the Stock page's rules: 12 months of sales, the owner's value when edited),
promis waiting, and the need (`needs.need_for`)."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.analytics.stock_queries import _stock_max_for, _stock_min_for, _vente_units_subq, stock_abcd_window
from app.core.models import (
    Customer,
    PharmacyProductEdit,
    PharmacyStock,
    Promis,
    PromisLine,
    PurchaseOrder,
    PurchaseOrderLine,
)
from app.core.utils import today as pharmacy_today
from app.damaged.damage_queries import damaged_boxes
from app.promis.promis_queries import reserved_boxes
from app.purchasing.needs import need_for

WAITING = ("created", "to_order", "ordered", "received", "incident")  # promis not reserved yet


@dataclass
class ProductNeed:
    medicament_id: int
    current: int | None
    damaged: int
    reserved: int
    free: int
    stock_min: int
    stock_max: int
    waiting: int  # boxes promised, not reserved yet
    incoming: int  # boxes of our orders sent / placed, or delivered after the last stock import
    customers: list[str]  # who they are for (« Mme Alami »)
    for_shelf: int
    for_promis: int

    @property
    def need(self) -> int:
        return self.for_shelf + self.for_promis


def product_needs(db: Session, pharmacy_id: int, med_ids: list[int]) -> dict[int, ProductNeed]:
    """{medicament_id: its picture} for these products."""
    if not med_ids:
        return {}
    start, end = (d.isoformat() for d in stock_abcd_window(pharmacy_today()))
    sold = _vente_units_subq(pharmacy_id, start, end, db)
    units = dict(db.query(sold.c.medicament_id, sold.c.units).filter(sold.c.medicament_id.in_(med_ids)).all())
    stock = dict(
        db.query(PharmacyStock.medicament_id, PharmacyStock.current_stock).filter(
            PharmacyStock.pharmacy_id == pharmacy_id, PharmacyStock.medicament_id.in_(med_ids)
        )
    )
    edits = {
        e.medicament_id: e
        for e in db.query(PharmacyProductEdit).filter(
            PharmacyProductEdit.pharmacy_id == pharmacy_id, PharmacyProductEdit.medicament_id.in_(med_ids)
        )
    }
    damaged, reserved = damaged_boxes(db, pharmacy_id, med_ids), reserved_boxes(db, pharmacy_id, med_ids)
    waiting: dict[int, tuple[int, list[str]]] = {}
    rows = (
        db.query(PromisLine.medicament_id, func.sum(PromisLine.quantity), func.array_agg(func.distinct(Customer.name)))
        .join(Promis, Promis.id == PromisLine.promis_id)
        .join(Customer, Customer.id == Promis.customer_id)
        .filter(Promis.pharmacy_id == pharmacy_id, Promis.state.in_(WAITING), PromisLine.medicament_id.in_(med_ids))
        .group_by(PromisLine.medicament_id)
    )
    for mid, qty, names in rows:
        waiting[mid] = (int(qty), sorted(names))

    # Incoming: boxes of our orders sent to the admin or placed, and the ones delivered after the last stock import
    # (Sobrus counts them only from the next import).
    last_import = (
        db.query(func.max(PharmacyStock.imported_at)).filter(PharmacyStock.pharmacy_id == pharmacy_id).scalar()
    )
    on_the_way = PurchaseOrder.state.in_(("validated", "sent"))
    if last_import is not None:
        on_the_way = or_(on_the_way, and_(PurchaseOrder.state == "delivered", PurchaseOrder.delivered_at > last_import))
    else:
        on_the_way = or_(on_the_way, PurchaseOrder.state == "delivered")
    incoming = dict(
        db.query(PurchaseOrderLine.medicament_id, func.sum(PurchaseOrderLine.quantity))
        .join(PurchaseOrder, PurchaseOrder.id == PurchaseOrderLine.order_id)
        .filter(PurchaseOrder.pharmacy_id == pharmacy_id, on_the_way, PurchaseOrderLine.medicament_id.in_(med_ids))
        .group_by(PurchaseOrderLine.medicament_id)
        .all()
    )
    out = {}
    for mid in med_ids:
        edit = edits.get(mid)
        sales = int(units.get(mid) or 0)
        current = edit.current_stock if edit and edit.current_stock is not None else stock.get(mid)
        low = edit.stock_min if edit and edit.stock_min is not None else _stock_min_for(sales)
        high = edit.stock_max if edit and edit.stock_max is not None else _stock_max_for(sales)
        qty, names = waiting.get(mid, (0, []))
        n = need_for(current, damaged.get(mid, 0), reserved.get(mid, 0), high, qty, int(incoming.get(mid) or 0))
        out[mid] = ProductNeed(
            medicament_id=mid,
            current=current,
            damaged=damaged.get(mid, 0),
            reserved=reserved.get(mid, 0),
            free=n.free,
            stock_min=low,
            stock_max=high,
            waiting=qty,
            incoming=int(incoming.get(mid) or 0),
            customers=names,
            for_shelf=n.for_shelf,
            for_promis=n.for_promis,
        )
    return out
