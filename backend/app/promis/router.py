"""« Promis » (owner, employee with « Promis »): a product a customer asked for that the pharmacy can't give right now,
followed until the customer takes it (states: `PROMIS_STATES`).

GET  /v1/promis              search (customer, phone, product, barcode), state, page; export=true → every matching row
POST /v1/promis              {customer_id | customer, unreachable, note?, lines: [{medicament_id | name, quantity}]}
GET  /v1/promis/customers    the pharmacy's customers matching `search` (wizard step 1)
GET  /v1/promis/products     catalogue products matching `search`, with price + free stock (wizard step 2)
GET  /v1/promis/summary      dashboard: counts per state, « À faire aujourd'hui », pickups of the next 7 days
GET  /v1/promis/{id}         its sheet: customer, lines (free stock), steps, where it may go now
POST /v1/promis/{id}/state   {state, reason?, shelf_place?}: one step (`NEXT`); « Prêt » reserves its boxes for 7 days,
                             even when the free stock is too low (the screen warns: Sobrus stock arrives at night)
POST /v1/promis/{id}/messages {kind}: « Envoyer sur WhatsApp » was clicked (the dashboard stops listing it)
Every read first turns « Prêt » past its 7 days into « Expiré » (the robot also does it, `expire_overdue`).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Path, Query, status
from sqlalchemy import func

from app.core.audit import user_label
from app.core.database import DbDep
from app.core.errors import ApiError, ErrorCode
from app.core.models import Customer, Pharmacy, Promis, PromisEvent, PromisLine, PromisMessage
from app.core.permissions import member
from app.core.security import CurrentUserDep
from app.core.utils import today as pharmacy_today
from app.ledger.schemas import paginate
from app.promis.promis_queries import (
    catalogue_products,
    expire_overdue,
    lines_of,
    list_query,
    message_due,
    search_customers,
    sent_messages,
    summary,
)
from app.promis.schemas import (
    CustomerOut,
    PromisIn,
    PromisLineOut,
    PromisListResponse,
    PromisMessageIn,
    PromisMessageOut,
    PromisMoveIn,
    PromisSummary,
    PromisTodo,
    PromisSheet,
    PromisProduct,
    PromisRow,
    PromisSheetLine,
    PromisEventOut,
    PromisState,
)

router = APIRouter(tags=["promis"])

PromisDep = Annotated[int, member("promis")]
SearchQ = Annotated[str | None, Query()]
PICKUP_DAYS = 7  # fixed: nobody changes it
# Where a promis may go from each state; « Annulé » from any state before « Retiré ».
NEXT: dict[str, tuple[str, ...]] = {
    "created": ("ordered", "received", "ready", "cancelled"),
    "to_order": ("ordered", "received", "ready", "cancelled"),
    "ordered": ("received", "ready", "cancelled"),
    "received": ("ready", "incident", "cancelled"),
    "incident": ("ordered", "cancelled"),
    "ready": ("picked_up", "cancelled"),
    "expired": ("returned", "cancelled"),
}


def _rows(db, found: list[tuple[Promis, Customer]]) -> list[PromisRow]:
    lines = lines_of(db, [p.id for p, _ in found])
    return [
        PromisRow(
            id=p.id,
            number=p.number,
            state=p.state,
            customer_name=c.name,
            customer_phone=c.phone,
            lines=[
                PromisLineOut(medicament_id=line.medicament_id, name=line.name, quantity=line.quantity)
                for line in lines.get(p.id, [])
            ],
            note=p.note,
            pickup_deadline=p.pickup_deadline,
            created_by_name=p.created_by_name,
            created_at=p.created_at,
        )
        for p, c in found
    ]


def _customer(c: Customer) -> CustomerOut:
    return CustomerOut(id=c.id, name=c.name, phone=c.phone, whatsapp_ok=c.whatsapp_ok)


@router.get("/promis/customers", response_model=list[CustomerOut])
def list_customers(pharmacy_id: PromisDep, db: DbDep, search: SearchQ = None) -> list[CustomerOut]:
    return [_customer(c) for c in search_customers(db, pharmacy_id, search)]


@router.get("/promis/products", response_model=list[PromisProduct])
def list_products(
    pharmacy_id: PromisDep, db: DbDep, search: Annotated[str, Query(min_length=2, max_length=100)]
) -> list[dict]:
    return catalogue_products(db, pharmacy_id, search=search)


@router.get("/promis/summary", response_model=PromisSummary)
def promis_summary(pharmacy_id: PromisDep, db: DbDep) -> PromisSummary:
    expire_overdue(db, pharmacy_id)
    found = summary(db, pharmacy_id)
    return PromisSummary(
        counts=found["counts"],
        todo=[
            PromisTodo(id=r["promis"].id, number=r["promis"].number, customer_name=r["customer"].name, todo=r["todo"])
            for r in found["todo"]
        ],
        week=found["week"],
    )


@router.get("/promis", response_model=PromisListResponse)
def list_promis(
    pharmacy_id: PromisDep,
    db: DbDep,
    search: SearchQ = None,
    state: Annotated[PromisState | None, Query()] = None,
    deadline: Annotated[Literal["today", "tomorrow", "week", "late"] | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    export: Annotated[bool, Query(description="If true, return every matching row (Excel)")] = False,
) -> PromisListResponse:
    """Newest first."""
    expire_overdue(db, pharmacy_id)
    q = list_query(db, pharmacy_id, search, state, deadline)
    total = q.count()
    q = q.order_by(Promis.number.desc())
    found = q.all() if export else q.offset((page - 1) * limit).limit(limit).all()
    return PromisListResponse(
        data=_rows(db, found),
        pagination=paginate(total, 1 if export else page, max(total, 1) if export else limit),
    )


@router.post("/promis", response_model=PromisRow, status_code=status.HTTP_201_CREATED)
def create_promis(body: PromisIn, pharmacy_id: PromisDep, user: CurrentUserDep, db: DbDep) -> PromisRow:
    """« Nouveau promis »: needs a way to reach the customer (a phone) or « client injoignable » ticked."""
    if body.customer is not None:
        customer = Customer(pharmacy_id=pharmacy_id, **body.customer.model_dump())
    else:
        customer = db.get(Customer, body.customer_id)
        if customer is None or customer.pharmacy_id != pharmacy_id:
            raise ApiError(404, ErrorCode.CUSTOMER_NOT_FOUND, "Client introuvable.")
    if not customer.phone and not body.unreachable:
        raise ApiError(400, ErrorCode.PROMIS_NO_CONTACT, "Ajoutez un téléphone ou cochez « Client injoignable ».")

    ids = [line.medicament_id for line in body.lines if line.medicament_id is not None]
    products = {p["id"]: p for p in catalogue_products(db, pharmacy_id, ids=ids)}
    if len(products) != len(set(ids)):
        raise ApiError(404, ErrorCode.PRODUCT_NOT_FOUND, "Produit introuvable.")

    if body.customer is not None:
        db.add(customer)
        db.flush()
    # One promis at a time per pharmacy: two employees never get the same number.
    db.query(Pharmacy.id).filter(Pharmacy.id == pharmacy_id).with_for_update().one()
    last = db.query(func.max(Promis.number)).filter(Promis.pharmacy_id == pharmacy_id).scalar()
    actor = user_label(user)
    promis = Promis(
        pharmacy_id=pharmacy_id,
        number=(last or 0) + 1,
        customer_id=customer.id,
        unreachable=body.unreachable,
        note=(body.note or "").strip() or None,
        created_by=user.id,
        created_by_name=actor,
    )
    db.add(promis)
    db.flush()
    for line in body.lines:
        product = products.get(line.medicament_id)
        db.add(
            PromisLine(
                promis_id=promis.id,
                medicament_id=line.medicament_id,
                name=product["product"] if product else line.name,
                quantity=line.quantity,
                unit_price=product["price"] if product else None,
            )
        )
    db.add(PromisEvent(promis_id=promis.id, from_state=None, to_state="created", actor_name=actor))
    # Not enough free stock for a line (or a product outside the catalogue / the stock) → « À commander ».
    short = any(
        line.medicament_id is None
        or products[line.medicament_id]["free_stock"] is None
        or products[line.medicament_id]["free_stock"] < line.quantity
        for line in body.lines
    )
    if short:
        promis.state = "to_order"
        db.add(PromisEvent(promis_id=promis.id, from_state="created", to_state="to_order", actor_name=actor))
    db.commit()
    db.refresh(promis)
    return _rows(db, [(promis, customer)])[0]


def _own(db, pharmacy_id: int, promis_id: int, *, lock: bool = False) -> Promis:
    q = db.query(Promis).filter(Promis.id == promis_id, Promis.pharmacy_id == pharmacy_id)
    promis = (q.with_for_update() if lock else q).one_or_none()
    if promis is None:
        raise ApiError(404, ErrorCode.PROMIS_NOT_FOUND, "Promis introuvable.")
    return promis


def _sheet(db, promis: Promis) -> PromisSheet:
    customer = db.get(Customer, promis.customer_id)
    lines = lines_of(db, [promis.id]).get(promis.id, [])
    ids = [line.medicament_id for line in lines if line.medicament_id is not None]
    products = {p["id"]: p for p in catalogue_products(db, promis.pharmacy_id, ids=ids)}
    events = db.query(PromisEvent).filter(PromisEvent.promis_id == promis.id).order_by(PromisEvent.id)
    sent = sent_messages(db, [promis.id]).get(promis.id, [])
    return PromisSheet(
        id=promis.id,
        number=promis.number,
        state=promis.state,
        customer=_customer(customer),
        unreachable=promis.unreachable,
        note=promis.note,
        ready_at=promis.ready_at,
        pickup_deadline=promis.pickup_deadline,
        created_by_name=promis.created_by_name,
        created_at=promis.created_at,
        lines=[
            PromisSheetLine(
                id=line.id,
                medicament_id=line.medicament_id,
                pid=products[line.medicament_id]["pid"] if line.medicament_id in products else None,
                name=line.name,
                quantity=line.quantity,
                reserved_qty=line.reserved_qty,
                shelf_place=line.shelf_place,
                unit_price=line.unit_price,
                free_stock=products[line.medicament_id]["free_stock"] if line.medicament_id in products else None,
            )
            for line in lines
        ],
        events=[
            PromisEventOut(
                from_state=e.from_state, to_state=e.to_state, actor_name=e.actor_name, reason=e.reason, at=e.at
            )
            for e in events
        ],
        next=list(NEXT.get(promis.state, ())),
        messages=[PromisMessageOut(kind=m.kind, sent_by_name=m.sent_by_name, sent_at=m.sent_at) for m in sent],
        message_due=message_due(promis, customer, sent, pharmacy_today()),
    )


@router.get("/promis/{promis_id}", response_model=PromisSheet)
def get_promis(promis_id: Annotated[int, Path(ge=1)], pharmacy_id: PromisDep, db: DbDep) -> PromisSheet:
    expire_overdue(db, pharmacy_id)
    return _sheet(db, _own(db, pharmacy_id, promis_id))


@router.post("/promis/{promis_id}/messages", response_model=PromisSheet, status_code=status.HTTP_201_CREATED)
def message_sent(
    promis_id: Annotated[int, Path(ge=1)],
    body: PromisMessageIn,
    pharmacy_id: PromisDep,
    user: CurrentUserDep,
    db: DbDep,
) -> PromisSheet:
    """« Envoyer sur WhatsApp »: the person opened WhatsApp with the text ready; noted so it is not due any more."""
    promis = _own(db, pharmacy_id, promis_id)
    db.add(PromisMessage(promis_id=promis.id, kind=body.kind, sent_by_name=user_label(user)))
    db.commit()
    return _sheet(db, promis)


@router.post("/promis/{promis_id}/state", response_model=PromisSheet)
def move_promis(
    promis_id: Annotated[int, Path(ge=1)],
    body: PromisMoveIn,
    pharmacy_id: PromisDep,
    user: CurrentUserDep,
    db: DbDep,
) -> PromisSheet:
    """The screen asks, the server checks the step (row locked: two clicks never both pass), writes, logs."""
    promis = _own(db, pharmacy_id, promis_id, lock=True)
    if body.state not in NEXT.get(promis.state, ()):
        raise ApiError(409, ErrorCode.PROMIS_STATE_CHANGED, "Ce promis a déjà changé d'état. Rechargez la page.")
    reason = body.reason
    if body.state == "ready":
        # Every box of the catalogue lines is kept for the customer (counted while « Prêt »), 7 days.
        for line in lines_of(db, [promis.id]).get(promis.id, []):
            line.shelf_place = body.shelf_place
            line.reserved_qty = line.quantity if line.medicament_id is not None else 0
        promis.ready_at = datetime.now(timezone.utc)
        promis.pickup_deadline = pharmacy_today() + timedelta(days=PICKUP_DAYS)
        reason = body.shelf_place
    db.add(
        PromisEvent(
            promis_id=promis.id,
            from_state=promis.state,
            to_state=body.state,
            actor_name=user_label(user),
            reason=reason,
        )
    )
    promis.state = body.state
    db.commit()
    return _sheet(db, promis)
