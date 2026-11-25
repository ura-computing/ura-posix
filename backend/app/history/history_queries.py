"""« Historique des modifications »: the pharmacy's `audit_logs`, newest first. The owner's page
filters by person, type, dates and text (product, file, note); a product's tab shows its own lines
(edits, observations) and the imports that brought its purchase / sale / stock lines."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.audit import AuditAction
from app.core.models import Achat, AuditLog, Medicament, PharmacyStock, Vente
from app.core.search import supplier_search_clauses, tokenize_search
from app.core.utils import PHARMACY_TZ
from app.ledger.schemas import paginate

IMPORT_ACTIONS = [
    AuditAction.IMPORT_DONE,
    AuditAction.IMPORT_CANCELLED,
    AuditAction.IMPORT_FAILED,
    AuditAction.IMPORT_DELETED,
]
# The page's « Type » filter.
KINDS = {
    "imports": IMPORT_ACTIONS,
    "product": [AuditAction.PRODUCT_EDITED, AuditAction.PRODUCT_REVERTED],
    "notes": [AuditAction.NOTE_ADDED, AuditAction.NOTE_DELETED],
    "damaged": [AuditAction.DAMAGE_DECLARED, AuditAction.DAMAGE_STATUS_CHANGED],
}


def _rows(db: Session, q, page: int, limit: int, export: bool) -> tuple[list[dict], dict]:
    total = db.execute(select(func.count()).select_from(q.subquery())).scalar_one()
    q = q.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
    if not export:
        q = q.offset((page - 1) * limit).limit(limit)
    data = [
        {
            "id": a.id,
            "created_at": a.created_at,
            "user_name": a.user_name,
            "action": a.action,
            "details": a.details,
            "medicament_id": a.medicament_id,
            "product": product,
        }
        for a, product in db.execute(q)
    ]
    pagination = paginate(total, 1 if export else page, max(total, 1) if export else limit)
    return data, pagination


def _base(pharmacy_id: int):
    return (
        select(AuditLog, Medicament.product)
        .outerjoin(Medicament, Medicament.id == AuditLog.medicament_id)
        .where(AuditLog.pharmacy_id == pharmacy_id)
    )


def pharmacy_history(
    db: Session,
    pharmacy_id: int,
    *,
    person: str | None,
    kind: str,
    date_from: date | None,
    date_to: date | None,
    search: str | None,
    page: int,
    limit: int,
    export: bool,
) -> dict:
    """Every line of the pharmacy (owner page). Dates = pharmacy days (Casablanca), inclusive."""
    q = _base(pharmacy_id)
    if person:
        q = q.where(AuditLog.user_name == person)
    if kind in KINDS:
        q = q.where(AuditLog.action.in_(KINDS[kind]))
    if date_from:
        q = q.where(AuditLog.created_at >= datetime.combine(date_from, time.min, PHARMACY_TZ))
    if date_to:
        q = q.where(AuditLog.created_at < datetime.combine(date_to + timedelta(days=1), time.min, PHARMACY_TZ))
    text_cols = [
        func.coalesce(Medicament.product, ""),
        func.coalesce(AuditLog.details["product"].as_string(), ""),
        func.coalesce(AuditLog.details["file"].as_string(), ""),
        func.coalesce(AuditLog.details["text"].as_string(), ""),
    ]
    q = q.where(*supplier_search_clauses(tokenize_search(search), text_cols))
    data, pagination = _rows(db, q, page, limit, export)
    people = db.scalars(
        select(AuditLog.user_name)
        .where(AuditLog.pharmacy_id == pharmacy_id, AuditLog.user_name != "")
        .distinct()
        .order_by(AuditLog.user_name)
    ).all()
    return {"data": data, "pagination": pagination, "people": list(people)}


def product_history(db: Session, pharmacy_id: int, med_id: int, *, page: int, limit: int) -> dict:
    """One product's tab: its edits + observations, and the imports that brought its lines; an import
    line says how many of them are this product's (`product_lines`: 247, not the file's 136 529)."""
    lines: dict[int, int] = {}
    for model in (Achat, Vente, PharmacyStock):
        counts = db.execute(
            select(model.import_batch_id, func.count())
            .where(model.pharmacy_id == pharmacy_id, model.medicament_id == med_id, model.import_batch_id.isnot(None))
            .group_by(model.import_batch_id)
        ).all()
        for batch_id, n in counts:
            lines[batch_id] = lines.get(batch_id, 0) + n
    q = _base(pharmacy_id).where(
        or_(
            AuditLog.medicament_id == med_id,
            AuditLog.action.in_(IMPORT_ACTIONS) & AuditLog.details["batch_id"].as_integer().in_(list(lines)),
        )
    )
    data, pagination = _rows(db, q, page, limit, export=False)
    for row in data:
        if row["action"] in IMPORT_ACTIONS:
            row["product_lines"] = lines.get(row["details"].get("batch_id"))
    return {"data": data, "pagination": pagination}
