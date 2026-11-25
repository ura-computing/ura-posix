"""« Commandes du jour » (owner, employee with « Commander »): one draft per supplier, built from each product's need,
priced with the supplier's confirmed conditions (`daily_queries`).

GET    /v1/orders/daily              the drafts (built at the first opening)
POST   /v1/orders/daily/refresh      « Recalculer »: lines follow the calculation, except the ones the person changed
POST   /v1/orders/lines              {medicament_id, quantity}: « Commander N » on the product sheet → its supplier's draft
PATCH  /v1/orders/lines/{id}         {quantity}: the person's quantity (kept by « Recalculer »)
DELETE /v1/orders/lines/{id}         « Enlever »
POST   /v1/orders/{id}/validate      « Envoyer à l'administrateur »: frozen copy of the lines + the conditions applied;
                                     the admin and Support get a line in their bell (« Commandes à passer »)
GET    /v1/orders/sent               the orders sent to the admin, where each one stands (newest first, 50)
Orders sent and not delivered count as incoming in each product's need (`needs_queries`).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Path, status

from app.core.audit import user_label
from app.core.database import DbDep
from app.core.errors import ApiError, ErrorCode
from app.core.models import Pharmacy, PurchaseOrder, PurchaseOrderLine
from app.core.permissions import member
from app.core.security import CurrentUserDep
from app.core.utils import today as pharmacy_today
from app.orders.daily_queries import drafts, order_view, placement, rebuild
from app.notifications.service import admin_and_support_ids, notify
from app.orders.admin_router import sent_order
from app.orders.schemas import AddLineIn, AddLineOut, DailyOrder, DailyOrders, LineQuantityIn, SentOrder
from app.products.product_queries import linked_product
from app.purchasing.needs_queries import product_needs

router = APIRouter(tags=["orders"])

OrdersDep = Annotated[int, member("orders")]


def _daily(db, pharmacy_id: int) -> DailyOrders:
    today = pharmacy_today()
    views = [order_view(db, pharmacy_id, o, today) for o in drafts(db, pharmacy_id)]
    views.sort(key=lambda v: (v["supplier"] is None, (v["supplier"] or {}).get("name", "")))
    counts: dict[str, int] = {}
    for v in views:
        for line in v["lines"]:
            counts[line["group"]] = counts.get(line["group"], 0) + 1
    return DailyOrders(orders=[DailyOrder(**v) for v in views], counts=counts)


def _line(db, pharmacy_id: int, line_id: int) -> PurchaseOrderLine:
    line = db.get(PurchaseOrderLine, line_id)
    order = db.get(PurchaseOrder, line.order_id) if line else None
    if order is None or order.pharmacy_id != pharmacy_id or order.state != "draft":
        raise ApiError(404, ErrorCode.ORDER_LINE_NOT_FOUND, "Ligne de commande introuvable.")
    return line


@router.get("/orders/daily", response_model=DailyOrders)
def daily_orders(pharmacy_id: OrdersDep, db: DbDep) -> DailyOrders:
    if not drafts(db, pharmacy_id):
        rebuild(db, pharmacy_id)
    return _daily(db, pharmacy_id)


@router.post("/orders/daily/refresh", response_model=DailyOrders)
def refresh_daily(pharmacy_id: OrdersDep, db: DbDep) -> DailyOrders:
    rebuild(db, pharmacy_id)
    return _daily(db, pharmacy_id)


@router.post("/orders/lines", response_model=AddLineOut, status_code=status.HTTP_201_CREATED)
def add_line(body: AddLineIn, pharmacy_id: OrdersDep, db: DbDep) -> AddLineOut:
    """The product's supplier's draft (made if missing); already there → its quantity becomes this one."""
    if linked_product(db, pharmacy_id, body.medicament_id) is None:
        raise ApiError(404, ErrorCode.PRODUCT_NOT_FOUND, "Ce produit n'est pas dans votre pharmacie.")
    supplier_id, price = placement(db, pharmacy_id, [body.medicament_id])[body.medicament_id]
    orders = drafts(db, pharmacy_id)
    line = (
        db.query(PurchaseOrderLine)
        .filter(
            PurchaseOrderLine.order_id.in_([o.id for o in orders]),
            PurchaseOrderLine.medicament_id == body.medicament_id,
        )
        .first()
    )
    if line is None:
        order = next((o for o in orders if o.supplier_id == supplier_id), None)
        if order is None:
            order = PurchaseOrder(pharmacy_id=pharmacy_id, supplier_id=supplier_id, state="draft")
            db.add(order)
            db.flush()
        need = product_needs(db, pharmacy_id, [body.medicament_id])[body.medicament_id]
        line = PurchaseOrderLine(
            order_id=order.id,
            medicament_id=body.medicament_id,
            quantity=body.quantity,
            suggested=need.need,
            group="check" if supplier_id is None or price is None else ("promis" if need.for_promis else "restock"),
            for_shelf=need.for_shelf,
            for_promis=need.for_promis,
            customers=need.customers,
            unit_price=price,
        )
        db.add(line)
    line.quantity, line.edited = body.quantity, True
    db.commit()
    order = db.get(PurchaseOrder, line.order_id)
    view = order_view(db, pharmacy_id, order, pharmacy_today())
    return AddLineOut(order_id=order.id, supplier=view["supplier"])


@router.patch("/orders/lines/{line_id}", response_model=DailyOrders)
def set_quantity(
    line_id: Annotated[int, Path(ge=1)], body: LineQuantityIn, pharmacy_id: OrdersDep, db: DbDep
) -> DailyOrders:
    line = _line(db, pharmacy_id, line_id)
    line.quantity, line.edited = body.quantity, True
    db.commit()
    return _daily(db, pharmacy_id)


@router.delete("/orders/lines/{line_id}", response_model=DailyOrders)
def remove_line(line_id: Annotated[int, Path(ge=1)], pharmacy_id: OrdersDep, db: DbDep) -> DailyOrders:
    line = _line(db, pharmacy_id, line_id)
    order_id = line.order_id
    db.delete(line)
    db.flush()
    if not db.query(PurchaseOrderLine.id).filter(PurchaseOrderLine.order_id == order_id).first():
        db.delete(db.get(PurchaseOrder, order_id))
    db.commit()
    return _daily(db, pharmacy_id)


@router.post("/orders/{order_id}/validate", response_model=DailyOrders)
def validate_order(
    order_id: Annotated[int, Path(ge=1)], pharmacy_id: OrdersDep, user: CurrentUserDep, db: DbDep
) -> DailyOrders:
    order = db.get(PurchaseOrder, order_id)
    if order is None or order.pharmacy_id != pharmacy_id or order.state != "draft":
        raise ApiError(404, ErrorCode.ORDER_NOT_FOUND, "Commande introuvable ou déjà validée.")
    view = DailyOrder(**order_view(db, pharmacy_id, order, pharmacy_today()))
    if order.supplier_id is None:
        raise ApiError(409, ErrorCode.ORDER_NO_SUPPLIER, "Choisissez d'abord le fournisseur de ces produits.")
    order.frozen = view.model_dump(mode="json")
    order.state = "validated"
    order.validated_at = datetime.now(timezone.utc)
    order.validated_by_name = user_label(user)
    pharmacy = db.get(Pharmacy, pharmacy_id)
    notify(
        db,
        admin_and_support_ids(db),
        "orderToPlace",
        {"pharmacy": pharmacy.name, "supplier": view.supplier.name, "n": len(view.lines)},
        "commandes-a-passer",
    )
    db.commit()
    return _daily(db, pharmacy_id)


@router.get("/orders/sent", response_model=list[SentOrder])
def sent_orders(pharmacy_id: OrdersDep, db: DbDep) -> list[SentOrder]:
    pharmacy = db.get(Pharmacy, pharmacy_id)
    rows = (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.pharmacy_id == pharmacy_id, PurchaseOrder.state != "draft")
        .order_by(PurchaseOrder.validated_at.desc(), PurchaseOrder.id.desc())
        .limit(50)
        .all()
    )
    return [sent_order(o, pharmacy) for o in rows]
