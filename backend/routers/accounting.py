"""Payment entries — CRUD for manually entered payment method totals."""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import PaymentEntry, User
from routers.auth import get_current_user
from utils.constants import Role

router = APIRouter(prefix="/accounting", tags=["accounting"])


class PaymentEntryCreate(BaseModel):
    month: str  # "2026-03"
    method: str  # tpe, especes, cheques, virement
    pharmacie_amount: float = 0
    parapharmacie_amount: float = 0
    count: int = 0


class PaymentEntryOut(BaseModel):
    id: int
    month: str
    method: str
    pharmacie_amount: float
    parapharmacie_amount: float
    count: int

    model_config = {"from_attributes": True}


@router.get("/payments", response_model=List[PaymentEntryOut])
def list_payments(
    month: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List payment entries for the current pharmacy."""
    if current_user.role == Role.ADMIN:
        raise HTTPException(status_code=403, detail="Les admins utilisent les endpoints par pharmacie")
    q = db.query(PaymentEntry).filter(PaymentEntry.pharmacy_id == current_user.pharmacy_id)
    if month:
        q = q.filter(PaymentEntry.month == month)
    return q.order_by(PaymentEntry.month.desc(), PaymentEntry.method).all()


@router.post("/payments", response_model=PaymentEntryOut)
def create_or_update_payment(
    body: PaymentEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create or update a payment entry (upsert by month + method)."""
    if current_user.role not in (Role.OWNER, Role.ADMIN):
        raise HTTPException(status_code=403, detail="Seuls les propriétaires peuvent modifier les paiements")

    pharmacy_id = current_user.pharmacy_id
    if not pharmacy_id:
        raise HTTPException(status_code=400, detail="Aucune pharmacie associée")

    existing = (
        db.query(PaymentEntry)
        .filter(
            PaymentEntry.pharmacy_id == pharmacy_id,
            PaymentEntry.month == body.month,
            PaymentEntry.method == body.method,
        )
        .first()
    )

    if existing:
        existing.pharmacie_amount = body.pharmacie_amount
        existing.parapharmacie_amount = body.parapharmacie_amount
        existing.count = body.count
        db.commit()
        db.refresh(existing)
        return existing

    entry = PaymentEntry(
        pharmacy_id=pharmacy_id,
        month=body.month,
        method=body.method,
        pharmacie_amount=body.pharmacie_amount,
        parapharmacie_amount=body.parapharmacie_amount,
        count=body.count,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/payments/{entry_id}")
def delete_payment(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(PaymentEntry).filter(PaymentEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entrée introuvable")
    if current_user.pharmacy_id and entry.pharmacy_id != current_user.pharmacy_id:
        raise HTTPException(status_code=403, detail="Accès refusé")
    db.delete(entry)
    db.commit()
    return {"deleted": True}
