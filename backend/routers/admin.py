from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Pharmacy, User
from routers.auth import get_current_user
from schemas import (
    PharmacyCreate,
    PharmacyOut,
    PharmacyUpdate,
    UserAdminOut,
    UserPharmacyUpdate,
    UserRoleUpdate,
)

router = APIRouter(prefix="/admin", tags=["admin"])

VALID_ROLES = {"admin", "owner", "employee"}


def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ── Pharmacies ─────────────────────────────────────────────────────────────────

@router.get("/pharmacies", response_model=List[PharmacyOut])
def list_pharmacies(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    pharmacies = db.query(Pharmacy).order_by(Pharmacy.created_at.desc()).all()
    result = []
    for p in pharmacies:
        user_count = db.query(User).filter(User.pharmacy_id == p.id).count()
        out = PharmacyOut(
            id=p.id,
            name=p.name,
            address=p.address,
            phone=p.phone,
            email=p.email,
            created_at=p.created_at,
            user_count=user_count,
        )
        result.append(out)
    return result


@router.post("/pharmacies", response_model=PharmacyOut)
def create_pharmacy(
    body: PharmacyCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    pharmacy = Pharmacy(
        name=body.name,
        address=body.address,
        phone=body.phone,
        email=body.email,
    )
    db.add(pharmacy)
    db.commit()
    db.refresh(pharmacy)
    return PharmacyOut(
        id=pharmacy.id,
        name=pharmacy.name,
        address=pharmacy.address,
        phone=pharmacy.phone,
        email=pharmacy.email,
        created_at=pharmacy.created_at,
        user_count=0,
    )


@router.put("/pharmacies/{pharmacy_id}", response_model=PharmacyOut)
def update_pharmacy(
    pharmacy_id: int,
    body: PharmacyUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    pharmacy = db.query(Pharmacy).filter(Pharmacy.id == pharmacy_id).first()
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    if body.name is not None:
        pharmacy.name = body.name
    if body.address is not None:
        pharmacy.address = body.address
    if body.phone is not None:
        pharmacy.phone = body.phone
    if body.email is not None:
        pharmacy.email = body.email
    db.commit()
    db.refresh(pharmacy)
    user_count = db.query(User).filter(User.pharmacy_id == pharmacy.id).count()
    return PharmacyOut(
        id=pharmacy.id,
        name=pharmacy.name,
        address=pharmacy.address,
        phone=pharmacy.phone,
        email=pharmacy.email,
        created_at=pharmacy.created_at,
        user_count=user_count,
    )


@router.delete("/pharmacies/{pharmacy_id}")
def delete_pharmacy(
    pharmacy_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    pharmacy = db.query(Pharmacy).filter(Pharmacy.id == pharmacy_id).first()
    if not pharmacy:
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    # Unlink users before deleting
    db.query(User).filter(User.pharmacy_id == pharmacy_id).update({"pharmacy_id": None})
    db.delete(pharmacy)
    db.commit()
    return {"deleted": True}


# ── Users ──────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=List[UserAdminOut])
def list_users(
    pharmacy_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    q = db.query(User)
    if pharmacy_id is not None:
        q = q.filter(User.pharmacy_id == pharmacy_id)
    return q.order_by(User.created_at.desc()).all()


@router.put("/users/{user_id}/role", response_model=UserAdminOut)
def update_user_role(
    user_id: int,
    body: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = body.role
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}/pharmacy", response_model=UserAdminOut)
def update_user_pharmacy(
    user_id: int,
    body: UserPharmacyUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.pharmacy_id is not None:
        pharmacy = db.query(Pharmacy).filter(Pharmacy.id == body.pharmacy_id).first()
        if not pharmacy:
            raise HTTPException(status_code=404, detail="Pharmacy not found")
    user.pharmacy_id = body.pharmacy_id
    db.commit()
    db.refresh(user)
    return user
