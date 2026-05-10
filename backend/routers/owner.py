import secrets
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Pharmacy, User
from utils.permissions import get_current_owner
from utils.constants import Role, Status
from utils.email import send_invite_email
from schemas import EmployeeInvite, EmployeePermissionsUpdate, UserAdminOut

router = APIRouter(prefix="/owner", tags=["owner"])

# Invite tokens are good for 7 days.
_INVITE_TTL = timedelta(days=7)


@router.get("/employees", response_model=List[UserAdminOut])
def list_employees(
    db: Session = Depends(get_db),
    current_owner: User = Depends(get_current_owner),
):
    """List all employees (active + pending) in the owner's pharmacy."""
    return (
        db.query(User)
        .filter(
            User.pharmacy_id == current_owner.pharmacy_id,
            User.role == Role.EMPLOYEE,
        )
        .order_by(User.created_at.desc())
        .all()
    )


@router.put("/employees/{user_id}/approve", response_model=UserAdminOut)
def approve_employee(
    user_id: int,
    db: Session = Depends(get_db),
    current_owner: User = Depends(get_current_owner),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if user.pharmacy_id != current_owner.pharmacy_id:
        raise HTTPException(status_code=403, detail="Cet employé n'appartient pas à votre pharmacie")
    if user.status != Status.PENDING:
        raise HTTPException(status_code=400, detail="L'utilisateur n'est pas en attente")
    user.status = Status.ACTIVE
    db.commit()
    db.refresh(user)
    return user


@router.put("/employees/{user_id}/reject", response_model=UserAdminOut)
def reject_employee(
    user_id: int,
    db: Session = Depends(get_db),
    current_owner: User = Depends(get_current_owner),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if user.pharmacy_id != current_owner.pharmacy_id:
        raise HTTPException(status_code=403, detail="Cet employé n'appartient pas à votre pharmacie")
    user.status = Status.REJECTED
    db.commit()
    db.refresh(user)
    return user


@router.put("/employees/{user_id}/permissions", response_model=UserAdminOut)
def update_employee_permissions(
    user_id: int,
    body: EmployeePermissionsUpdate,
    db: Session = Depends(get_db),
    current_owner: User = Depends(get_current_owner),
):
    """Update feature permissions for an employee. Owner can only grant features they have access to."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if user.pharmacy_id != current_owner.pharmacy_id:
        raise HTTPException(status_code=403, detail="Cet employé n'appartient pas à votre pharmacie")
    if user.role != Role.EMPLOYEE:
        raise HTTPException(status_code=400, detail="L'utilisateur cible n'est pas un employé")
    # Owner cannot grant features that are blocked for themselves or at pharmacy level
    owner_perms = current_owner.permissions or {}
    pharmacy = db.query(Pharmacy).filter(Pharmacy.id == current_owner.pharmacy_id).first()
    pharmacy_options = (pharmacy.options or {}) if pharmacy else {}
    sanitized = {
        k: v for k, v in body.permissions.items()
        if not (v is True and (owner_perms.get(k) is False or pharmacy_options.get(k) is False))
    }
    user.permissions = sanitized
    db.commit()
    db.refresh(user)
    return user


@router.get("/notifications")
def get_owner_notifications(
    db: Session = Depends(get_db),
    current_owner: User = Depends(get_current_owner),
):
    """Return pending employees for the owner's pharmacy."""
    pending = (
        db.query(User)
        .filter(
            User.pharmacy_id == current_owner.pharmacy_id,
            User.role == Role.EMPLOYEE,
            User.status == Status.PENDING,
        )
        .order_by(User.created_at.desc())
        .all()
    )
    return {
        "pending_employees": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in pending
        ]
    }


@router.put("/employees/{user_id}/revoke", response_model=UserAdminOut)
def revoke_employee(
    user_id: int,
    db: Session = Depends(get_db),
    current_owner: User = Depends(get_current_owner),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if user.pharmacy_id != current_owner.pharmacy_id:
        raise HTTPException(status_code=403, detail="Cet employé n'appartient pas à votre pharmacie")
    if user.status != Status.ACTIVE:
        raise HTTPException(status_code=400, detail="L'employé n'est pas actif")
    user.status = Status.PENDING
    db.commit()
    db.refresh(user)
    return user


@router.post("/employees/invite", response_model=UserAdminOut, status_code=201)
async def invite_employee(
    body: EmployeeInvite,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    current_owner: User = Depends(get_current_owner),
):
    """Owner-driven invitation: create an ACTIVE employee without a password,
    generate a 7-day reset token, and email the invitee a link to the
    /reset-password page where they set their initial password."""
    if not current_owner.pharmacy_id:
        raise HTTPException(status_code=400, detail="Aucune pharmacie associée à votre compte")
    email = body.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Email déjà enregistré")

    token = secrets.token_urlsafe(32)
    pharmacy = db.query(Pharmacy).filter(Pharmacy.id == current_owner.pharmacy_id).first()
    user = User(
        email=email,
        name=body.name,
        phone=body.phone,
        role=Role.EMPLOYEE,
        status=Status.ACTIVE,
        pharmacy_id=current_owner.pharmacy_id,
        pharmacy_name=pharmacy.name if pharmacy else None,
        permissions=body.permissions or {},
        reset_token=token,
        reset_token_expires=datetime.now(timezone.utc) + _INVITE_TTL,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    background.add_task(
        send_invite_email,
        email,
        token,
        current_owner.name,
        pharmacy.name if pharmacy else None,
    )
    return user
