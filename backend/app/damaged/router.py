"""« Stock abîmé » (owner, employee with « Stock abîmé »): boxes declared damaged, taken off PharmaGest's free stock
(free stock = Sobrus stock − damaged boxes; Sobrus can't remove them). Declared from the product sheet; the page lists
them and moves each one: « À traiter » → « Rendu au fournisseur » / « Détruit »; « Remis en vente » (a mistake) gives
the boxes back. Every change goes to « Historique ».

GET   /v1/damaged          search (product, PID), status, page; export=true → every matching row (Excel)
POST  /v1/damaged          {medicament_id, quantity, reason?, note?}
PATCH /v1/damaged/{id}     {status}: from « À traiter »; « Remis en vente » also from returned / destroyed
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Path, Query, status
from sqlalchemy import func

from app.core.audit import AuditAction, log_action, user_label
from app.core.database import DbDep
from app.core.errors import ApiError, ErrorCode
from app.core.models import Medicament, StockDamage
from app.core.permissions import member
from app.core.search import product_search_clauses, tokenize_search
from app.core.security import CurrentUserDep
from app.damaged.schemas import DamageIn, DamageListResponse, DamageRow, DamageStatus, DamageStatusIn
from app.ledger.schemas import paginate
from app.products.product_queries import linked_product

router = APIRouter(tags=["damaged"])

DamagedDep = Annotated[int, member("damaged")]
# From « À traiter » anywhere; once returned / destroyed, only « Remis en vente » (declared by mistake).
_NEXT = {
    "pending": {"returned", "destroyed", "back_on_sale"},
    "returned": {"back_on_sale"},
    "destroyed": {"back_on_sale"},
}


def _row(d: StockDamage, med: Medicament) -> DamageRow:
    return DamageRow(
        id=d.id,
        medicament_id=med.id,
        pid=med.pid,
        product=med.product,
        quantity=d.quantity,
        reason=d.reason,
        note=d.note,
        status=d.status,
        created_by_name=d.created_by_name,
        created_at=d.created_at,
        closed_at=d.closed_at,
    )


@router.get("/damaged", response_model=DamageListResponse)
def list_damaged(
    pharmacy_id: DamagedDep,
    db: DbDep,
    search: Annotated[str | None, Query()] = None,
    status_: Annotated[DamageStatus | None, Query(alias="status")] = None,
    medicament_id: Annotated[int | None, Query(ge=1)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    export: Annotated[bool, Query(description="If true, return every matching row (Excel)")] = False,
) -> DamageListResponse:
    """Newest first."""
    q = (
        db.query(StockDamage, Medicament)
        .join(Medicament, Medicament.id == StockDamage.medicament_id)
        .filter(StockDamage.pharmacy_id == pharmacy_id)
    )
    for clause in product_search_clauses(tokenize_search(search)):
        q = q.filter(clause)
    if status_:
        q = q.filter(StockDamage.status == status_)
    if medicament_id:
        q = q.filter(StockDamage.medicament_id == medicament_id)
    total = q.count()
    boxes_off = (
        q.filter(StockDamage.status != "back_on_sale").with_entities(func.coalesce(func.sum(StockDamage.quantity), 0))
    ).scalar()
    q = q.order_by(StockDamage.created_at.desc(), StockDamage.id.desc())
    rows = q.all() if export else q.offset((page - 1) * limit).limit(limit).all()
    return DamageListResponse(
        data=[_row(d, med) for d, med in rows],
        pagination=paginate(total, 1 if export else page, max(total, 1) if export else limit),
        boxes_off=int(boxes_off),
    )


@router.post("/damaged", response_model=DamageRow, status_code=status.HTTP_201_CREATED)
def declare_damaged(body: DamageIn, pharmacy_id: DamagedDep, user: CurrentUserDep, db: DbDep) -> DamageRow:
    """« Déclarer des boîtes abîmées » (product sheet)."""
    med = linked_product(db, pharmacy_id, body.medicament_id)
    if med is None:
        raise ApiError(404, ErrorCode.PRODUCT_NOT_FOUND, "Ce produit n'est pas dans votre pharmacie.")
    reason = (body.reason or "").strip() or None
    damage = StockDamage(
        pharmacy_id=pharmacy_id,
        medicament_id=med.id,
        quantity=body.quantity,
        reason=reason,
        note=(body.note or "").strip() or None,
        created_by=user.id,
        created_by_name=user_label(user),
    )
    db.add(damage)
    log_action(
        db,
        user,
        pharmacy_id,
        AuditAction.DAMAGE_DECLARED,
        {"product": med.product, "quantity": body.quantity, "reason": reason},
        med.id,
    )
    db.commit()
    db.refresh(damage)
    return _row(damage, med)


@router.patch("/damaged/{damage_id}", response_model=DamageRow)
def move_damaged(
    damage_id: Annotated[int, Path(ge=1)],
    body: DamageStatusIn,
    pharmacy_id: DamagedDep,
    user: CurrentUserDep,
    db: DbDep,
) -> DamageRow:
    damage = db.get(StockDamage, damage_id)
    if damage is None or damage.pharmacy_id != pharmacy_id:
        raise ApiError(404, ErrorCode.DAMAGE_NOT_FOUND, "Déclaration introuvable.")
    if body.status not in _NEXT.get(damage.status, set()):
        raise ApiError(409, ErrorCode.DAMAGE_CLOSED, "Cette déclaration ne peut plus passer à cet état.")
    med = db.get(Medicament, damage.medicament_id)
    before = damage.status
    damage.status = body.status
    damage.closed_at = datetime.now(timezone.utc)
    log_action(
        db,
        user,
        pharmacy_id,
        AuditAction.DAMAGE_STATUS_CHANGED,
        {"product": med.product, "quantity": damage.quantity, "before": before, "after": body.status},
        med.id,
    )
    db.commit()
    return _row(damage, med)
