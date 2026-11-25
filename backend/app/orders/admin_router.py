"""« Commandes à passer » (admin, Support): the orders the pharmacies sent; the admin places each one with its
supplier (the Excel order form is made by the page from the frozen copy), then follows it.

    À passer (validated) ─« Passée »→ Passée (sent) ─« Livrée »→ Livrée (delivered)
    À passer / Passée ─« Annuler » (reason)→ Annulée (cancelled)

GET  /v1/admin/orders?state=&search=   state (none = all: « À passer » first, then « Passée »…), every word of
                                      `search` in the pharmacy (name, code) or the supplier; newest first, 100 at most
POST /v1/admin/orders/{id}/state   {state, reason?}: the pharmacy's owners get a line in their bell
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Path, Query
from sqlalchemy import case

from app.core.audit import user_label
from app.core.database import DbDep
from app.core.errors import ApiError, ErrorCode
from app.core.models import Pharmacy, PurchaseOrder, Supplier
from app.core.search import supplier_search_clauses, tokenize_search
from app.core.permissions import AdminDep, admin_only
from app.notifications.service import notify, owner_ids
from app.orders.schemas import OrderStateIn, SentOrder

router = APIRouter(tags=["orders"], dependencies=[admin_only])

# From each state, where the admin may move it.
NEXT = {"validated": ("sent", "cancelled"), "sent": ("delivered", "cancelled")}


def sent_order(order: PurchaseOrder, pharmacy: Pharmacy) -> SentOrder:
    return SentOrder(
        id=order.id,
        state=order.state,
        pharmacy={"id": pharmacy.id, "name": pharmacy.name, "code": pharmacy.code},
        order=order.frozen,
        validated_at=order.validated_at,
        validated_by_name=order.validated_by_name,
        sent_at=order.sent_at,
        delivered_at=order.delivered_at,
        cancel_reason=order.cancel_reason,
        handled_by_name=order.handled_by_name,
    )


@router.get("/admin/orders", response_model=list[SentOrder])
def list_orders(
    db: DbDep,
    state: Annotated[Literal["validated", "sent", "delivered", "cancelled"] | None, Query()] = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
) -> list[SentOrder]:
    q = (
        db.query(PurchaseOrder, Pharmacy)
        .join(Pharmacy, Pharmacy.id == PurchaseOrder.pharmacy_id)
        .outerjoin(Supplier, Supplier.id == PurchaseOrder.supplier_id)
        .filter(PurchaseOrder.state != "draft")
    )
    if state:
        q = q.filter(PurchaseOrder.state == state)
    for clause in supplier_search_clauses(tokenize_search(search), [Pharmacy.name, Pharmacy.code, Supplier.name]):
        q = q.filter(clause)
    urgency = case({"validated": 0, "sent": 1, "delivered": 2}, value=PurchaseOrder.state, else_=3)
    rows = q.order_by(urgency, PurchaseOrder.validated_at.desc(), PurchaseOrder.id.desc()).limit(100).all()
    return [sent_order(o, p) for o, p in rows]


@router.post("/admin/orders/{order_id}/state", response_model=SentOrder)
def move_order(order_id: Annotated[int, Path(ge=1)], body: OrderStateIn, admin: AdminDep, db: DbDep) -> SentOrder:
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).with_for_update().one_or_none()
    if order is None or order.state not in NEXT:
        raise ApiError(404, ErrorCode.ORDER_NOT_FOUND, "Commande introuvable ou déjà terminée.")
    if body.state not in NEXT[order.state]:
        raise ApiError(409, ErrorCode.ORDER_STATE_CHANGED, "Cette commande a déjà changé d'état. Rechargez la page.")
    reason = (body.reason or "").strip() or None
    if body.state == "cancelled" and reason is None:
        raise ApiError(400, ErrorCode.INVALID_INPUT, "Écrivez la raison de l'annulation.")
    now = datetime.now(timezone.utc)
    order.state, order.handled_by_name = body.state, user_label(admin)
    if body.state == "sent":
        order.sent_at = now
    elif body.state == "delivered":
        order.delivered_at = now
    else:
        order.cancel_reason = reason
    supplier = (order.frozen or {}).get("supplier") or {}
    notify(
        db,
        owner_ids(db, order.pharmacy_id),
        "orderStep",
        {"supplier": supplier.get("name", ""), "state": body.state},
        "commandes",
    )
    db.commit()
    return sent_order(order, db.get(Pharmacy, order.pharmacy_id))
