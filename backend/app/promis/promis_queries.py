"""« Promis » SQL: customers, catalogue search with free stock, the list, the 7-day expiry, the messages due.

Free stock = Sobrus stock (the pharmacy's own value when edited) − damaged boxes − boxes reserved by « Prêt » promis
(and « Expiré » ones: the box waits on the shelf until « Rendre au stock »)."""

from __future__ import annotations

import re
from datetime import date, timedelta

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.core.models import (
    Customer,
    Medicament,
    PharmacyProductEdit,
    PharmacyStock,
    Promis,
    PromisEvent,
    PromisLine,
    PromisMessage,
)
from app.core.search import product_search_clauses, supplier_search_clauses, tokenize_search
from app.core.utils import PHARMACY_TZ, today as pharmacy_today
from app.damaged.damage_queries import damaged_boxes

RESERVING = ("ready", "expired")
REMINDER_DAYS = 2  # reminders from J+5 (deadline − 2 days) to J+7, once a day


def reserved_boxes(db: Session, pharmacy_id: int, med_ids: list[int]) -> dict[int, int]:
    """{medicament_id: boxes kept for customers} for these products (absent = 0)."""
    rows = (
        db.query(PromisLine.medicament_id, func.sum(PromisLine.reserved_qty))
        .join(Promis, Promis.id == PromisLine.promis_id)
        .filter(Promis.pharmacy_id == pharmacy_id, Promis.state.in_(RESERVING), PromisLine.medicament_id.in_(med_ids))
        .group_by(PromisLine.medicament_id)
    )
    return {mid: int(n) for mid, n in rows}


def _phone_clause(token: str):
    """« 0612 » also finds the stored « +212612… »."""
    clauses = supplier_search_clauses([token], [Customer.name, Customer.phone])
    if re.fullmatch(r"0\d+", token):
        clauses = [or_(clauses[0], Customer.phone.like(f"+%{token[1:]}%"))]
    return clauses[0]


def search_customers(db: Session, pharmacy_id: int, search: str | None, limit: int = 8) -> list[Customer]:
    q = db.query(Customer).filter(Customer.pharmacy_id == pharmacy_id)
    for token in tokenize_search(search):
        q = q.filter(_phone_clause(token))
    return q.order_by(Customer.name, Customer.id).limit(limit).all()


def catalogue_products(db: Session, pharmacy_id: int, *, search: str | None = None, ids: list[int] | None = None):
    """Catalogue products (by search, or these ids) with the pharmacy's price and stock; those it stocks first."""
    e, s = PharmacyProductEdit, PharmacyStock
    name = func.coalesce(e.product, Medicament.product)
    q = (
        db.query(
            Medicament.id,
            Medicament.pid,
            name.label("product"),
            func.coalesce(e.ppv, Medicament.ppv).label("price"),
            func.coalesce(e.counter_discount, 0).label("counter_discount"),
            func.coalesce(e.current_stock, s.current_stock).label("current_stock"),
        )
        .outerjoin(s, and_(s.pharmacy_id == pharmacy_id, s.medicament_id == Medicament.id))
        .outerjoin(e, and_(e.pharmacy_id == pharmacy_id, e.medicament_id == Medicament.id))
    )
    if ids is not None:
        rows = q.filter(Medicament.id.in_(ids)).all()
    else:
        for clause in product_search_clauses(tokenize_search(search), [e.product]):
            q = q.filter(clause)
        rows = q.order_by(s.id.is_(None), name, Medicament.id).limit(8).all()
    found = [r.id for r in rows]
    damaged, reserved = damaged_boxes(db, pharmacy_id, found), reserved_boxes(db, pharmacy_id, found)
    return [
        {
            "id": r.id,
            "pid": r.pid,
            "product": r.product,
            "price": round(float(r.price), 2) if r.price is not None else None,
            "counter_discount": float(r.counter_discount),
            "free_stock": max(0, r.current_stock - damaged.get(r.id, 0) - reserved.get(r.id, 0))
            if r.current_stock is not None
            else None,
        }
        for r in rows
    ]


def list_query(db: Session, pharmacy_id: int, search: str | None, state: str | None, deadline: str | None = None):
    """(Promis, Customer) rows. Every word matches the customer (name, phone) or a product (name, PID, barcode).
    `deadline`: today / tomorrow / week (« Prêt », last pickup day then) · late (« Expiré »)."""
    q = db.query(Promis, Customer).join(Customer, Customer.id == Promis.customer_id)
    q = q.filter(Promis.pharmacy_id == pharmacy_id)
    for token in tokenize_search(search):
        line = (
            select(PromisLine.id)
            .outerjoin(Medicament, Medicament.id == PromisLine.medicament_id)
            .where(
                PromisLine.promis_id == Promis.id,
                or_(
                    supplier_search_clauses([token], [PromisLine.name])[0],
                    product_search_clauses([token])[0],
                ),
            )
        )
        q = q.filter(or_(_phone_clause(token), line.exists()))
    if state:
        q = q.filter(Promis.state == state)
    today = pharmacy_today()
    if deadline == "late":
        q = q.filter(Promis.state == "expired")
    elif deadline:
        last = {"today": today, "tomorrow": today + timedelta(days=1), "week": today + timedelta(days=7)}[deadline]
        first = today if deadline == "week" else last
        q = q.filter(Promis.state == "ready", Promis.pickup_deadline.between(first, last))
    return q


def lines_of(db: Session, promis_ids: list[int]) -> dict[int, list[PromisLine]]:
    out: dict[int, list[PromisLine]] = {}
    for line in db.query(PromisLine).filter(PromisLine.promis_id.in_(promis_ids)).order_by(PromisLine.id):
        out.setdefault(line.promis_id, []).append(line)
    return out


def expire_overdue(db: Session, pharmacy_id: int | None = None) -> int:
    """« Prêt » whose pickup deadline is past → « Expiré » (actor « Robot »). The robot runs it every few minutes for
    every pharmacy; the promis pages also run it for theirs (a robot stopped in dev). Returns how many expired."""
    q = db.query(Promis).filter(Promis.state == "ready", Promis.pickup_deadline < pharmacy_today())
    if pharmacy_id is not None:
        q = q.filter(Promis.pharmacy_id == pharmacy_id)
    overdue = q.with_for_update(skip_locked=True).all()
    for promis in overdue:
        db.add(PromisEvent(promis_id=promis.id, from_state="ready", to_state="expired", actor_name="Robot"))
        promis.state = "expired"
    if overdue:
        db.commit()
    return len(overdue)


def sent_messages(db: Session, promis_ids: list[int]) -> dict[int, list[PromisMessage]]:
    out: dict[int, list[PromisMessage]] = {}
    for m in db.query(PromisMessage).filter(PromisMessage.promis_id.in_(promis_ids)).order_by(PromisMessage.id):
        out.setdefault(m.promis_id, []).append(m)
    return out


def message_due(promis: Promis, customer: Customer, sent: list[PromisMessage], today: date) -> str | None:
    """The WhatsApp message to send now, else None. Only to a customer with a phone who accepts messages.
    created (any state before « Prêt ») · ready · reminder (J+5 → J+7, once a day) · returned."""
    if not customer.phone or not customer.whatsapp_ok:
        return None
    kinds = {m.kind for m in sent}
    if promis.state in ("created", "to_order", "ordered", "received", "incident"):
        return None if "created" in kinds else "created"
    if promis.state == "ready":
        if "ready" not in kinds:
            return "ready"
        last = max(
            (m.sent_at.astimezone(PHARMACY_TZ).date() for m in sent if m.kind in ("ready", "reminder")), default=None
        )
        soon = promis.pickup_deadline is not None and today >= promis.pickup_deadline - timedelta(days=REMINDER_DAYS)
        return "reminder" if soon and last != today else None
    if promis.state == "returned":
        return None if "returned" in kinds else "returned"
    return None


# Dashboard « À faire aujourd'hui »: one line per promis, its most urgent job first.
TODO_ORDER = ("expired", "last_day", "msg_ready", "msg_reminder", "msg_returned", "msg_created", "received", "to_order")


def summary(db: Session, pharmacy_id: int) -> dict:
    """Counts per state, the promis needing something today (most urgent first, 50 at most), pickups of the next
    7 days."""
    today = pharmacy_today()
    counts = dict(
        db.query(Promis.state, func.count()).filter(Promis.pharmacy_id == pharmacy_id).group_by(Promis.state).all()
    )
    told = select(PromisMessage.id).where(PromisMessage.promis_id == Promis.id, PromisMessage.kind == "returned")
    open_rows = (
        db.query(Promis, Customer)
        .join(Customer, Customer.id == Promis.customer_id)
        .filter(
            Promis.pharmacy_id == pharmacy_id,
            or_(
                Promis.state.notin_(("picked_up", "cancelled", "returned")),
                and_(Promis.state == "returned", ~told.exists()),
            ),
        )
        .all()
    )
    sent = sent_messages(db, [p.id for p, _ in open_rows])
    todo = []
    for promis, customer in open_rows:
        due = message_due(promis, customer, sent.get(promis.id, []), today)
        jobs = [
            "expired" if promis.state == "expired" else None,
            "last_day" if promis.state == "ready" and promis.pickup_deadline == today else None,
            f"msg_{due}" if due else None,
            promis.state if promis.state in ("received", "to_order") else None,
        ]
        found = [j for j in jobs if j]
        if found:
            job = min(found, key=TODO_ORDER.index)
            todo.append({"promis": promis, "customer": customer, "todo": job})
    todo.sort(key=lambda r: (TODO_ORDER.index(r["todo"]), r["promis"].number))
    week = sum(
        1
        for p, _ in open_rows
        if p.state == "ready" and p.pickup_deadline and today <= p.pickup_deadline <= today + timedelta(days=7)
    )
    return {"counts": counts, "todo": todo[:50], "week": week}
