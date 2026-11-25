"""« Promis » SQL: customers, catalogue search with free stock, the list.

Free stock = Sobrus stock (the pharmacy's own value when edited) − damaged boxes − boxes reserved by « Prêt » promis."""

from __future__ import annotations

import re

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.core.models import Customer, Medicament, PharmacyProductEdit, PharmacyStock, Promis, PromisLine
from app.core.search import product_search_clauses, supplier_search_clauses, tokenize_search
from app.damaged.damage_queries import damaged_boxes


def reserved_boxes(db: Session, pharmacy_id: int, med_ids: list[int]) -> dict[int, int]:
    """{medicament_id: boxes kept for customers} for these products (absent = 0)."""
    rows = (
        db.query(PromisLine.medicament_id, func.sum(PromisLine.reserved_qty))
        .join(Promis, Promis.id == PromisLine.promis_id)
        .filter(Promis.pharmacy_id == pharmacy_id, Promis.state == "ready", PromisLine.medicament_id.in_(med_ids))
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
            "free_stock": max(0, r.current_stock - damaged.get(r.id, 0) - reserved.get(r.id, 0))
            if r.current_stock is not None
            else None,
        }
        for r in rows
    ]


def list_query(db: Session, pharmacy_id: int, search: str | None, state: str | None):
    """(Promis, Customer) rows. Every word matches the customer (name, phone) or a product (name, PID, barcode)."""
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
    return q


def lines_of(db: Session, promis_ids: list[int]) -> dict[int, list[PromisLine]]:
    out: dict[int, list[PromisLine]] = {}
    for line in db.query(PromisLine).filter(PromisLine.promis_id.in_(promis_ids)).order_by(PromisLine.id):
        out.setdefault(line.promis_id, []).append(line)
    return out
