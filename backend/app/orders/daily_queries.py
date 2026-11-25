"""« Commandes du jour » (D-7): the pharmacy's drafts, one per supplier, built from each product's need
(`purchasing.needs_queries`) and priced with the supplier's confirmed conditions (`purchasing.conditions_engine`).

  - A product's supplier: the one of its latest purchase (`Achat.supplier`, matched to « Fournisseurs » by name,
    `supplier_names.bare_name`); none found → the « À vérifier » draft (no supplier).
  - Its price: its latest purchase price, else the catalogue's PPH.
  - Its group: « Promis » (boxes promised), « Urgences » (free stock under the minimum), « Réassort » (else),
    « À vérifier » (no supplier or no price).
  - « Recalculer »: a line the person did not touch follows the calculation (gone when nothing is needed any more);
    a line the person changed or added keeps its quantity.

Example: Doliprane, max 3, free 0, Mme Alami waiting for 1, bought from « BOTTU » at 12 MAD → the Bottu draft,
4 boxes, group « Promis », « 3 pour le rayon + 1 pour Mme Alami »."""

from __future__ import annotations

from datetime import date

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.core.models import (
    Achat,
    ConditionProduct,
    Medicament,
    PharmacyProductEdit,
    PharmacyStock,
    Promis,
    PromisLine,
    PurchaseOrder,
    PurchaseOrderLine,
    Supplier,
    SupplierCondition,
)
from app.purchasing.conditions_engine import Line, Rule, evaluate
from app.purchasing.needs_queries import WAITING, ProductNeed, product_needs
from app.purchasing.supplier_names import bare_name


def _supplier_ids_by_name(db: Session) -> dict[str, int]:
    out: dict[str, int] = {}
    for sid, name in db.query(Supplier.id, Supplier.name).filter(Supplier.archived_at.is_(None)).order_by(Supplier.id):
        out.setdefault(bare_name(name), sid)
    return out


def _last_purchases(db: Session, pharmacy_id: int, med_ids: list[int]) -> dict[int, tuple[str | None, float | None]]:
    """{medicament_id: (supplier text, unit price)} of its latest purchase line with units."""
    ranked = (
        db.query(
            Achat.medicament_id,
            Achat.supplier,
            Achat.unit_price,
            func.row_number()
            .over(
                partition_by=Achat.medicament_id,
                order_by=(Achat.delivery_date.desc().nullslast(), Achat.id.desc()),
            )
            .label("rank"),
        )
        .filter(Achat.pharmacy_id == pharmacy_id, Achat.medicament_id.in_(med_ids), Achat.quantity > 0)
        .subquery()
    )
    rows = db.query(ranked.c.medicament_id, ranked.c.supplier, ranked.c.unit_price).filter(ranked.c.rank == 1)
    return {mid: (supplier, price) for mid, supplier, price in rows}


def _catalogue_pph(db: Session, pharmacy_id: int, med_ids: list[int]) -> dict[int, float | None]:
    e = PharmacyProductEdit
    rows = (
        db.query(Medicament.id, func.coalesce(e.pph, Medicament.pph))
        .outerjoin(e, and_(e.pharmacy_id == pharmacy_id, e.medicament_id == Medicament.id))
        .filter(Medicament.id.in_(med_ids))
    )
    return dict(rows.all())


def _group(need: ProductNeed, supplier_id: int | None, price: float | None) -> str:
    if supplier_id is None or price is None:
        return "check"
    if need.for_promis > 0:
        return "promis"
    return "urgent" if need.free < need.stock_min else "restock"


def drafts(db: Session, pharmacy_id: int) -> list[PurchaseOrder]:
    return (
        db.query(PurchaseOrder)
        .filter(PurchaseOrder.pharmacy_id == pharmacy_id, PurchaseOrder.state == "draft")
        .order_by(PurchaseOrder.id)
        .all()
    )


def _draft_for(db: Session, pharmacy_id: int, supplier_id: int | None, cache: dict) -> PurchaseOrder:
    if supplier_id not in cache:
        order = PurchaseOrder(pharmacy_id=pharmacy_id, supplier_id=supplier_id, state="draft")
        db.add(order)
        db.flush()
        cache[supplier_id] = order
    return cache[supplier_id]


def placement(db: Session, pharmacy_id: int, med_ids: list[int]) -> dict[int, tuple[int | None, float | None]]:
    """{medicament_id: (supplier id or None, unit price or None)}."""
    names = _supplier_ids_by_name(db)
    last = _last_purchases(db, pharmacy_id, med_ids)
    pph = _catalogue_pph(db, pharmacy_id, med_ids)
    out = {}
    for mid in med_ids:
        supplier, price = last.get(mid, (None, None))
        out[mid] = (names.get(bare_name(supplier)) if supplier else None, price if price is not None else pph.get(mid))
    return out


def rebuild(db: Session, pharmacy_id: int) -> None:
    """« Recalculer » (and the first opening): every product of the pharmacy's stock or promis, its need now."""
    stocked = {m for (m,) in db.query(PharmacyStock.medicament_id).filter(PharmacyStock.pharmacy_id == pharmacy_id)}
    promised = {
        m
        for (m,) in db.query(PromisLine.medicament_id)
        .join(Promis, Promis.id == PromisLine.promis_id)
        .filter(Promis.pharmacy_id == pharmacy_id, Promis.state.in_(WAITING), PromisLine.medicament_id.isnot(None))
    }
    orders = drafts(db, pharmacy_id)
    existing = {
        line.medicament_id: line
        for line in db.query(PurchaseOrderLine).filter(PurchaseOrderLine.order_id.in_([o.id for o in orders]))
    }
    med_ids = sorted(stocked | promised | set(existing))
    needs = product_needs(db, pharmacy_id, med_ids)
    where = placement(db, pharmacy_id, med_ids)
    cache = {o.supplier_id: o for o in orders}
    for mid in med_ids:
        need, (supplier_id, price) = needs[mid], where[mid]
        line = existing.get(mid)
        if need.need <= 0 and (line is None or not line.edited):
            if line is not None:
                db.delete(line)
            continue
        if line is None:
            order = _draft_for(db, pharmacy_id, supplier_id, cache)
            line = PurchaseOrderLine(order_id=order.id, medicament_id=mid, quantity=need.need)
            db.add(line)
        line.suggested = need.need
        if not line.edited:
            line.quantity = need.need
        line.group = _group(need, supplier_id, price)
        line.for_shelf, line.for_promis, line.customers = need.for_shelf, need.for_promis, need.customers
        line.unit_price = price
    db.flush()
    for order in drafts(db, pharmacy_id):  # a draft left without a line goes away
        if not db.query(PurchaseOrderLine.id).filter(PurchaseOrderLine.order_id == order.id).first():
            db.delete(order)
    db.commit()


def _rules(db: Session, supplier_id: int) -> tuple[list[Rule], int]:
    """The supplier's rules for the engine, and how many are « À vérifier »."""
    rows = (
        db.query(SupplierCondition)
        .filter(SupplierCondition.supplier_id == supplier_id, SupplierCondition.deleted_at.is_(None))
        .all()
    )
    products: dict[int, set[int]] = {}
    for cid, mid in db.query(ConditionProduct.condition_id, ConditionProduct.medicament_id).filter(
        ConditionProduct.condition_id.in_([c.id for c in rows])
    ):
        products.setdefault(cid, set()).add(mid)
    rules = [
        Rule(
            id=c.id,
            kind=c.kind,
            state=c.state,
            basis=c.basis,
            value=c.value,
            days=c.days,
            tiers=tuple((t["from"], t["pct"]) for t in (c.tiers or [])),
            product_ids=frozenset(products.get(c.id, set())),
            valid_from=c.valid_from,
            valid_to=c.valid_to,
        )
        for c in rows
    ]
    return rules, sum(1 for c in rows if c.state != "confirmed")


def order_view(db: Session, pharmacy_id: int, order: PurchaseOrder, today: date) -> dict:
    """One draft as the page shows it: its lines (product names as the pharmacy edited them) + the engine's result."""
    e = PharmacyProductEdit
    rows = (
        db.query(PurchaseOrderLine, Medicament.pid, func.coalesce(e.product, Medicament.product))
        .join(Medicament, Medicament.id == PurchaseOrderLine.medicament_id)
        .outerjoin(e, and_(e.pharmacy_id == pharmacy_id, e.medicament_id == Medicament.id))
        .filter(PurchaseOrderLine.order_id == order.id)
        .all()
    )
    order_rank = {"urgent": 0, "promis": 1, "restock": 2, "check": 3}
    rows.sort(key=lambda r: (order_rank[r[0].group], r[2]))
    supplier = db.get(Supplier, order.supplier_id) if order.supplier_id else None
    rules, unverified = _rules(db, supplier.id) if supplier else ([], 0)
    result = evaluate([Line(r[0].medicament_id, r[0].quantity, r[0].unit_price or 0.0) for r in rows], rules, today)
    by_product = {x.product_id: x for x in result.lines}
    return {
        "id": order.id,
        "supplier": {"id": supplier.id, "name": supplier.name} if supplier else None,
        "lines": [
            {
                "id": line.id,
                "medicament_id": line.medicament_id,
                "pid": pid,
                "product": name,
                "quantity": line.quantity,
                "suggested": line.suggested,
                "edited": line.edited,
                "group": line.group,
                "for_shelf": line.for_shelf,
                "for_promis": line.for_promis,
                "customers": line.customers or [],
                "unit_price": line.unit_price,
                "discount_pct": by_product[line.medicament_id].discount_pct,
                "net_total": by_product[line.medicament_id].net_total,
                "packaging": by_product[line.medicament_id].packaging,
            }
            for line, pid, name in rows
        ],
        "gross_total": result.gross_total,
        "net_total": result.net_total,
        "minimums": [vars(m) for m in result.minimums],
        "next_tiers": [vars(n) for n in result.next_tiers],
        "transport_missing": result.transport_missing,
        "unverified_rules": unverified,
        "created_at": order.created_at,
    }
