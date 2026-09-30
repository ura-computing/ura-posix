"""Comptabilité — manual monthly payment-method bookkeeping.

The owner records totals per (month, method) on the /comptabilité page; the
data lives in `payment_entries` and is independent of Sobrus CSV imports.

Endpoints all gated by the `accounting` feature (`member("accounting")`).
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path, Query

from database import DbDep
from errors import ApiError, ErrorCode
from models import PaymentEntry
from permissions import member
from schemas.accounting import PaymentEntryIn, PaymentEntryOut


router = APIRouter(prefix="/accounting", tags=["accounting"])


@router.get("/payments", response_model=list[PaymentEntryOut])
def list_payments(
    pharmacy_id: Annotated[int, member("accounting")],
    db:   DbDep,
    month: Annotated[str | None, Query(pattern=r"^\d{4}-\d{2}$")] = None,
) -> list[PaymentEntry]:
    """All payment entries for the caller's pharmacy, newest month first.
    `month` filters to one specific YYYY-MM bucket (the /comptabilité page
    uses this to load just the currently-displayed month)."""
    q = db.query(PaymentEntry).filter(PaymentEntry.pharmacy_id == pharmacy_id)
    if month:
        q = q.filter(PaymentEntry.month == month)
    return q.order_by(PaymentEntry.month.desc(), PaymentEntry.method.asc()).all()


@router.post("/payments", response_model=PaymentEntryOut)
def save_payment(body: PaymentEntryIn, pharmacy_id: Annotated[int, member("accounting")], db: DbDep) -> PaymentEntry:
    """Upsert by (pharmacy_id, month, method) — POST always succeeds whether
    the row exists or not. Simpler than separate POST/PUT, matches the
    apcm-pharma contract the frontend expects."""
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


@router.delete("/payments/{entry_id}", status_code=204)
def delete_payment(
    entry_id: Annotated[int, Path(ge=1)],
    pharmacy_id: Annotated[int, member("accounting")],
    db:   DbDep,
) -> None:
    entry = db.query(PaymentEntry).filter_by(id=entry_id, pharmacy_id=pharmacy_id).first()
    if not entry:
        raise ApiError(404, ErrorCode.PAYMENT_NOT_FOUND, "Entrée introuvable.")
    db.delete(entry)
    db.commit()
