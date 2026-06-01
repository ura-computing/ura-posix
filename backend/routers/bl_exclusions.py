"""PG-007 (achats half) — owner endpoints to manage BL-number exclusions.

An excluded BL stops contributing to every Achat-side aggregation that already filters
non-declared products (marge, KPIs, analyse-marge, dashboard). The exclusion lives on
`PharmacyBlExclusion` (one row = one excluded delivery_ref per pharmacy).

Ventes are NOT filtered. The schema has no Vente↔BL link, so matching ventes to a specific
BL is out of scope for this commit; we'll revisit once the client picks a matching rule.
"""
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Achat, PharmacyBlExclusion, User
from routers.auth import get_current_user
from utils.constants import Role


router = APIRouter(prefix="/bl-exclusions", tags=["bl-exclusions"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class BlExclusionCreate(BaseModel):
    delivery_ref: str = Field(..., min_length=1, max_length=200)
    notes: Optional[str] = None


class BlExclusionOut(BaseModel):
    id: int
    delivery_ref: str
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    # Convenience: latest supplier / date / total found on the BL in this pharmacy's achats,
    # so the owner can recognise what they excluded.
    supplier: Optional[str] = None
    delivery_date: Optional[str] = None
    total_mad: Optional[float] = None
    nb_lines: Optional[int] = None

    model_config = {"from_attributes": True}


class BlSuggestion(BaseModel):
    delivery_ref: str
    supplier: Optional[str]
    delivery_date: Optional[str]
    total_mad: float
    nb_lines: int


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_owner_or_employee(user: User):
    if user.role not in (Role.OWNER, Role.EMPLOYEE):
        raise HTTPException(status_code=403, detail="Réservé aux propriétaires de pharmacie")
    if not user.pharmacy_id:
        raise HTTPException(status_code=400, detail="Aucune pharmacie associée")


def _summarise_bl(db: Session, pharmacy_id: int, delivery_ref: str) -> dict:
    """Aggregate per-BL info (supplier / date / total / nb lignes) from Achat rows."""
    row = (
        db.query(
            func.max(Achat.supplier).label("supplier"),
            func.max(Achat.delivery_date).label("delivery_date"),
            func.sum(Achat.total).label("total_mad"),
            func.count(Achat.id).label("nb_lines"),
        )
        .filter(
            Achat.pharmacy_id == pharmacy_id,
            Achat.delivery_ref == delivery_ref,
        )
        .first()
    )
    return {
        "supplier":      row.supplier if row and row.supplier else None,
        "delivery_date": row.delivery_date if row and row.delivery_date else None,
        "total_mad":     round(float(row.total_mad), 2) if row and row.total_mad else 0.0,
        "nb_lines":      int(row.nb_lines or 0) if row else 0,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("", response_model=List[BlExclusionOut])
def list_bl_exclusions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List BL numbers the current pharmacy has excluded from accounting (newest first)."""
    _require_owner_or_employee(current_user)
    rows = (
        db.query(PharmacyBlExclusion)
        .filter(PharmacyBlExclusion.pharmacy_id == current_user.pharmacy_id)
        .order_by(PharmacyBlExclusion.created_at.desc())
        .all()
    )
    out: list[BlExclusionOut] = []
    for r in rows:
        summary = _summarise_bl(db, current_user.pharmacy_id, r.delivery_ref)
        out.append(BlExclusionOut(
            id=r.id,
            delivery_ref=r.delivery_ref,
            notes=r.notes,
            created_at=r.created_at,
            **summary,
        ))
    return out


@router.post("", response_model=BlExclusionOut)
def create_bl_exclusion(
    body: BlExclusionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Exclude a BL number from this pharmacy's accounting calculations.

    The BL must exist in the pharmacy's Achat history; otherwise we refuse — pharmacists
    sometimes typo a reference and would silently end up with a no-op exclusion."""
    _require_owner_or_employee(current_user)
    ref = body.delivery_ref.strip()
    if not ref:
        raise HTTPException(status_code=400, detail="Numéro de BL requis")

    has_bl = (
        db.query(Achat.id)
        .filter(Achat.pharmacy_id == current_user.pharmacy_id, Achat.delivery_ref == ref)
        .first()
    )
    if not has_bl:
        raise HTTPException(
            status_code=400,
            detail=f"Aucun BL '{ref}' dans vos achats — vérifiez le numéro.",
        )

    existing = (
        db.query(PharmacyBlExclusion)
        .filter(
            PharmacyBlExclusion.pharmacy_id == current_user.pharmacy_id,
            PharmacyBlExclusion.delivery_ref == ref,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Ce BL est déjà exclu")

    row = PharmacyBlExclusion(
        pharmacy_id=current_user.pharmacy_id,
        delivery_ref=ref,
        notes=body.notes,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    summary = _summarise_bl(db, current_user.pharmacy_id, ref)
    return BlExclusionOut(
        id=row.id,
        delivery_ref=row.delivery_ref,
        notes=row.notes,
        created_at=row.created_at,
        **summary,
    )


@router.delete("/{delivery_ref}")
def delete_bl_exclusion(
    delivery_ref: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-integrate a previously excluded BL into accounting calculations."""
    _require_owner_or_employee(current_user)
    row = (
        db.query(PharmacyBlExclusion)
        .filter(
            PharmacyBlExclusion.pharmacy_id == current_user.pharmacy_id,
            PharmacyBlExclusion.delivery_ref == delivery_ref,
        )
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Ce BL n'est pas exclu")
    db.delete(row)
    db.commit()
    return {"deleted": True, "delivery_ref": delivery_ref}


@router.get("/suggestions", response_model=List[BlSuggestion])
def bl_suggestions(
    q: str = Query("", max_length=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Autocomplete BL refs that match `q` over this pharmacy's achats (used by the
    Produits Spéciaux dialog). Returns up to 10 most-recent matches with a summary so
    the owner can confirm before excluding."""
    _require_owner_or_employee(current_user)
    term = q.strip()
    if len(term) < 2:
        return []
    rows = (
        db.query(
            Achat.delivery_ref,
            func.max(Achat.supplier).label("supplier"),
            func.max(Achat.delivery_date).label("delivery_date"),
            func.sum(Achat.total).label("total_mad"),
            func.count(Achat.id).label("nb_lines"),
        )
        .filter(
            Achat.pharmacy_id == current_user.pharmacy_id,
            Achat.delivery_ref.isnot(None),
            Achat.delivery_ref.ilike(f"%{term}%"),
        )
        .group_by(Achat.delivery_ref)
        .order_by(func.max(Achat.delivery_date).desc())
        .limit(10)
        .all()
    )
    return [
        BlSuggestion(
            delivery_ref=r.delivery_ref,
            supplier=r.supplier,
            delivery_date=r.delivery_date,
            total_mad=round(float(r.total_mad or 0), 2),
            nb_lines=int(r.nb_lines or 0),
        )
        for r in rows
    ]
