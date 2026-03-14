from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user
from schemas import EmployeePermissionsUpdate, UserAdminOut

router = APIRouter(prefix="/owner", tags=["owner"])


def get_current_owner(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Owner access required")
    if not current_user.pharmacy_id:
        raise HTTPException(status_code=403, detail="No pharmacy associated with this account")
    return current_user


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
            User.role == "employee",
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
        raise HTTPException(status_code=404, detail="User not found")
    if user.pharmacy_id != current_owner.pharmacy_id:
        raise HTTPException(status_code=403, detail="Employee does not belong to your pharmacy")
    if user.status != "pending":
        raise HTTPException(status_code=400, detail="User is not pending")
    user.status = "active"
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
        raise HTTPException(status_code=404, detail="User not found")
    if user.pharmacy_id != current_owner.pharmacy_id:
        raise HTTPException(status_code=403, detail="Employee does not belong to your pharmacy")
    user.status = "rejected"
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
        raise HTTPException(status_code=404, detail="User not found")
    if user.pharmacy_id != current_owner.pharmacy_id:
        raise HTTPException(status_code=403, detail="Employee does not belong to your pharmacy")
    if user.role != "employee":
        raise HTTPException(status_code=400, detail="Target user is not an employee")
    # Owner cannot grant features that are blocked for themselves
    owner_perms = current_owner.permissions or {}
    sanitized = {
        k: v for k, v in body.permissions.items()
        if not (v is True and owner_perms.get(k) is False)
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
            User.role == "employee",
            User.status == "pending",
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
        raise HTTPException(status_code=404, detail="User not found")
    if user.pharmacy_id != current_owner.pharmacy_id:
        raise HTTPException(status_code=403, detail="Employee does not belong to your pharmacy")
    if user.status != "active":
        raise HTTPException(status_code=400, detail="Employee is not active")
    user.status = "pending"
    db.commit()
    db.refresh(user)
    return user
