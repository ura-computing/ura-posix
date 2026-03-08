from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import User
from routers.auth import get_current_user
from schemas import UserAdminOut

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


@router.delete("/employees/{user_id}")
def remove_employee(
    user_id: int,
    db: Session = Depends(get_db),
    current_owner: User = Depends(get_current_owner),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.pharmacy_id != current_owner.pharmacy_id:
        raise HTTPException(status_code=403, detail="Employee does not belong to your pharmacy")
    user.pharmacy_id = None
    user.status = "rejected"
    db.commit()
    return {"removed": True}
