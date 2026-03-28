from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from database import get_db
from models import Achat, CatalogRequest, CategorySuffix, Medicament, Pharmacy, User, Vente
from utils.strings import normalize_category, strip_accents, strip_percentage
from utils.constants import VALID_ROLES
from routers.auth import get_current_user
from utils.permissions import get_current_admin
from schemas import (
    CategorySuffixCreate,
    CategorySuffixOut,
    CategorySuffixUpdate,
    EmployeePermissionsUpdate,
    MedicamentCreate,
    MedicamentOut,
    MedicamentUpdate,
    OwnerOut,
    PharmacyCreate,
    PharmacyOut,
    PharmacyUpdate,
    UserAdminOut,
    UserPharmacyUpdate,
    UserRejectBody,
    UserRoleUpdate,
)

router = APIRouter(prefix="/admin", tags=["admin"])


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
        owners = (
            db.query(User)
            .filter(User.pharmacy_id == p.id, User.role == "owner", User.status == "active")
            .all()
        )
        first = owners[0] if owners else None
        out = PharmacyOut(
            id=p.id,
            name=p.name,
            address=p.address,
            phone=p.phone,
            email=p.email,
            created_at=p.created_at,
            user_count=user_count,
            owners=[OwnerOut(id=o.id, name=o.name, email=o.email, phone=o.phone) for o in owners],
            owner_name=first.name if first else None,
            owner_email=first.email if first else None,
            owner_phone=first.phone if first else None,
            owner_pharmacy_name=first.pharmacy_name if first else None,
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


@router.get("/users/pending", response_model=List[UserAdminOut])
def list_pending_owners(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """List pharmacy owner accounts awaiting admin approval."""
    return (
        db.query(User)
        .filter(User.status == "pending", User.role == "owner")
        .order_by(User.created_at.desc())
        .all()
    )


@router.get("/notifications")
def get_admin_notifications(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Pending owners + pending catalog requests — for the admin notification bell."""
    pending_users = (
        db.query(User)
        .filter(User.status == "pending", User.role == "owner")
        .order_by(User.created_at.desc())
        .all()
    )
    pending_requests = (
        db.query(CatalogRequest)
        .filter(CatalogRequest.status == "pending")
        .order_by(CatalogRequest.created_at.desc())
        .all()
    )
    return {
        "pending_users": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "pharmacy_name": u.pharmacy_name,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in pending_users
        ],
        "pending_requests": [
            {
                "id": r.id,
                "product": r.product,
                "pharmacy_name": r.requester.pharmacy_name if r.requester else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in pending_requests
        ],
    }


@router.put("/users/{user_id}/approve", response_model=UserAdminOut)
def approve_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Approve a pending owner: activate account and auto-create their pharmacy."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.status != "pending":
        raise HTTPException(status_code=400, detail="User is not pending")

    if user.role == "owner" and user.pharmacy_name and not user.pharmacy_id:
        pharmacy = Pharmacy(name=user.pharmacy_name)
        db.add(pharmacy)
        db.flush()
        user.pharmacy_id = pharmacy.id

    user.status = "active"
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}/reject", response_model=UserAdminOut)
def reject_user(
    user_id: int,
    body: UserRejectBody,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "rejected"
    db.commit()
    db.refresh(user)
    return user


@router.put("/users/{user_id}/revoke", response_model=UserAdminOut)
def revoke_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Revoke access from an active user — sets their status back to pending.
    If the user is an owner, also revokes all active employees in their pharmacy."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot revoke your own access")
    if user.status != "active":
        raise HTTPException(status_code=400, detail="User is not active")
    user.status = "pending"
    # If revoking an owner, also revoke all active employees in their pharmacy
    if user.role == "owner" and user.pharmacy_id:
        db.query(User).filter(
            User.pharmacy_id == user.pharmacy_id,
            User.role == "employee",
            User.status == "active",
        ).update({"status": "pending"})
    db.commit()
    db.refresh(user)
    return user


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


@router.put("/users/{user_id}/permissions", response_model=UserAdminOut)
def update_user_permissions(
    user_id: int,
    body: EmployeePermissionsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Set feature permissions for any user. Used to restrict owner access (cascades to their employees)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.permissions = body.permissions
    db.commit()
    db.refresh(user)
    return user


# ── Catalog (direct CRUD) ──────────────────────────────────────────────────────

@router.get("/catalog/categories")
def list_catalog_categories(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return distinct non-null category values from the catalog, sorted alphabetically."""
    rows = (
        db.query(Medicament.category)
        .filter(Medicament.category.isnot(None), Medicament.category != "")
        .distinct()
        .order_by(Medicament.category)
        .all()
    )
    return [r.category for r in rows]


@router.post("/catalog/deduplicate")
def deduplicate_catalog(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """Merge medicament rows that have the same accent-stripped, lowercased name.
    Keeps the row with the most complete PID (prefers a real Sobrus PID over a
    name-derived fallback), then re-points all Achat/Vente rows to the survivor
    and deletes the duplicates.
    Returns { merged_groups: int, deleted: int }.
    """
    all_meds = db.query(Medicament).all()

    # Group by normalised name
    groups: dict[str, list[Medicament]] = {}
    for med in all_meds:
        key = strip_accents((med.product or "").lower().strip())
        groups.setdefault(key, []).append(med)

    merged_groups = 0
    deleted = 0

    for key, meds in groups.items():
        if len(meds) < 2:
            continue

        # Choose the survivor: prefer the entry whose PID looks like a real Sobrus
        # code (all-digits or short alphanumeric), otherwise the one with the lowest id.
        def _pid_score(m: Medicament) -> int:
            p = m.pid or ""
            # A barcode/Sobrus PID is typically pure digits or short alphanum
            if p.isdigit():
                return 0
            if len(p) <= 20 and p.replace("-", "").isalnum():
                return 1
            return 2  # name-derived fallback — least preferred

        meds.sort(key=lambda m: (_pid_score(m), m.id))
        survivor = meds[0]
        duplicates = meds[1:]

        for dup in duplicates:
            # Re-point all transaction rows
            db.query(Achat).filter(Achat.medicament_id == dup.id).update(
                {"medicament_id": survivor.id}
            )
            db.query(Vente).filter(Vente.medicament_id == dup.id).update(
                {"medicament_id": survivor.id}
            )
            db.delete(dup)
            deleted += 1

        # Fill in any missing fields on the survivor from the duplicates
        for dup in duplicates:
            if not survivor.tva and dup.tva:
                survivor.tva = dup.tva
            if survivor.pph is None and dup.pph is not None:
                survivor.pph = dup.pph
            if survivor.ppv is None and dup.ppv is not None:
                survivor.ppv = dup.ppv
            if not survivor.category and dup.category:
                survivor.category = dup.category
            if not survivor.barcode1 and dup.barcode1:
                survivor.barcode1 = dup.barcode1
            if not survivor.laboratoire and dup.laboratoire:
                survivor.laboratoire = dup.laboratoire

        merged_groups += 1

    db.commit()
    return {"merged_groups": merged_groups, "deleted": deleted}


@router.get("/catalog")
def list_catalog(
    search: str = Query(""),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    export: bool = Query(False),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    q = db.query(Medicament)
    if search:
        term = f"%{search}%"
        norm = f"%{strip_accents(search.lower())}%"
        q = q.filter(
            Medicament.product.ilike(term)
            | Medicament.pid.ilike(term)
            | func.lower(Medicament.product).ilike(norm)
        )
    if export:
        items = q.order_by(Medicament.product).all()
        return {
            "data": [MedicamentOut.model_validate(m) for m in items],
            "pagination": {"total": len(items), "current": 1, "pageSize": len(items)},
        }
    total = q.count()
    items = q.order_by(Medicament.product).offset((page - 1) * limit).limit(limit).all()
    return {
        "data": [MedicamentOut.model_validate(m) for m in items],
        "pagination": {"total": total, "current": page, "pageSize": limit},
    }


@router.post("/catalog", response_model=MedicamentOut)
def create_medicament(
    body: MedicamentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    if db.query(Medicament).filter(Medicament.pid == body.pid).first():
        raise HTTPException(status_code=400, detail="PID already exists")
    data = body.model_dump()
    if data.get("category"):
        data["category"] = strip_accents(data["category"].strip())
    med = Medicament(**data)
    db.add(med)
    db.commit()
    db.refresh(med)
    return med


@router.put("/catalog/{med_id}", response_model=MedicamentOut)
def update_medicament(
    med_id: int,
    body: MedicamentUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    med = db.query(Medicament).filter(Medicament.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medicament not found")
    updates = body.model_dump(exclude_unset=True)
    if updates.get("category"):
        updates["category"] = strip_accents(updates["category"].strip())
    for field, value in updates.items():
        setattr(med, field, value)
    db.commit()
    db.refresh(med)
    return med


@router.post("/catalog/normalize-categories")
def normalize_categories(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    """One-time migration: strip accents from all existing category values."""
    meds = db.query(Medicament).filter(Medicament.category.isnot(None)).all()
    updated = 0
    for m in meds:
        norm = strip_accents(m.category.strip())
        if norm != m.category:
            m.category = norm
            updated += 1
    db.commit()
    return {"updated": updated}


@router.delete("/catalog/{med_id}")
def delete_medicament(
    med_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    med = db.query(Medicament).filter(Medicament.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medicament not found")
    db.delete(med)
    db.commit()
    return {"deleted": True}


# ── Category Suffixes ──────────────────────────────────────────────────────────

@router.get("/category-suffixes", response_model=List[CategorySuffixOut])
def list_category_suffixes(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    return db.query(CategorySuffix).order_by(CategorySuffix.category).all()


@router.post("/category-suffixes", response_model=CategorySuffixOut)
def create_category_suffix(
    body: CategorySuffixCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    if db.query(CategorySuffix).filter(CategorySuffix.category == body.category).first():
        raise HTTPException(status_code=400, detail="Category already has a suffix mapping")
    row = CategorySuffix(category=body.category, suffix=body.suffix, color=body.color)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/category-suffixes/{suffix_id}", response_model=CategorySuffixOut)
def update_category_suffix(
    suffix_id: int,
    body: CategorySuffixUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    row = db.query(CategorySuffix).filter(CategorySuffix.id == suffix_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    if body.category is not None:
        row.category = body.category
    if body.suffix is not None:
        row.suffix = body.suffix
    row.color = body.color  # always update; None clears it
    db.commit()
    db.refresh(row)
    return row


@router.delete("/category-suffixes/{suffix_id}")
def delete_category_suffix(
    suffix_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    row = db.query(CategorySuffix).filter(CategorySuffix.id == suffix_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(row)
    db.commit()
    return {"deleted": True}


# ── Analytics ──────────────────────────────────────────────────────────────────

@router.get("/analytics")
def get_analytics(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
):
    # Users by role
    role_rows = db.query(User.role, func.count(User.id)).group_by(User.role).all()
    role_counts = {r: 0 for r in ("owner", "employee", "admin")}
    for role, count in role_rows:
        if role in role_counts:
            role_counts[role] = count

    # Users by status (non-admin)
    status_rows = (
        db.query(User.status, func.count(User.id))
        .filter(User.role != "admin")
        .group_by(User.status)
        .all()
    )
    status_counts = {"active": 0, "pending": 0, "rejected": 0}
    for status, count in status_rows:
        if status in status_counts:
            status_counts[status] = count

    # Monthly registrations — last 6 months
    monthly_rows = (
        db.query(
            func.to_char(User.created_at, "YYYY-MM").label("month"),
            func.count(User.id).label("count"),
        )
        .group_by("month")
        .order_by("month")
        .all()
    )
    # Keep only last 6 months
    monthly = [{"month": row.month, "count": row.count} for row in monthly_rows if row.month]
    monthly = monthly[-6:] if len(monthly) > 6 else monthly

    return {
        "users_by_role": role_counts,
        "users_by_status": status_counts,
        "monthly_registrations": monthly,
    }
