"""Comptabilité — manual monthly payment-method bookkeeping.

The owner records totals per (month, method) on the /comptabilité page; the
data lives in `payment_entries` and is independent of Sobrus CSV imports.

Endpoints all gated by the `accounting` feature (require_pharmacy_owner).
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query

from database import DbDep
from models import PaymentEntry
from permissions import require_pharmacy_owner
from schemas.accounting import PaymentEntryIn, PaymentEntryOut
from security import CurrentUserDep


router = APIRouter(prefix="/accounting", tags=["accounting"])


@router.get("/payments", response_model=list[PaymentEntryOut])
def list_payments(
    user: CurrentUserDep,
    db:   DbDep,
    month: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}$")] = None,
) -> list[PaymentEntry]:
    """All payment entries for the caller's pharmacy, newest month first.
    `month` filters to one specific YYYY-MM bucket (the /comptabilité page
    uses this to load just the currently-displayed month)."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="accounting")
    q = db.query(PaymentEntry).filter(PaymentEntry.pharmacy_id == pharmacy_id)
    if month:
        q = q.filter(PaymentEntry.month == month)
    return q.order_by(PaymentEntry.month.desc(), PaymentEntry.method.asc()).all()


@router.post("/payments", response_model=PaymentEntryOut)
def save_payment(body: PaymentEntryIn, user: CurrentUserDep, db: DbDep) -> PaymentEntry:
    """Upsert by (pharmacy_id, month, method) — POST always succeeds whether
    the row exists or not. Simpler than separate POST/PUT, matches the
    apcm-pharma contract the frontend expects."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="accounting")
    existing = db.query(PaymentEntry).filter_by(
        pharmacy_id=pharmacy_id, month=body.month, method=body.method,
    ).first()
    if existing:
        existing.pharmacie_amount     = body.pharmacie_amount
        existing.parapharmacie_amount = body.parapharmacie_amount
        existing.count                = body.count
        db.commit()
        db.refresh(existing)
        return existing
    entry = PaymentEntry(pharmacy_id=pharmacy_id, **body.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/payments/{entry_id}")
def delete_payment(
    entry_id: Annotated[int, Path(ge=1)],
    user: CurrentUserDep,
    db:   DbDep,
) -> dict:
    pharmacy_id = require_pharmacy_owner(user, db, feature="accounting")
    entry = db.query(PaymentEntry).filter_by(id=entry_id, pharmacy_id=pharmacy_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entrée introuvable.")
    db.delete(entry)
    db.commit()
    return {"deleted": True}
