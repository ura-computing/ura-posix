"""Owner-side /owner/employees endpoints — backs the "Gérer mon équipe" page.

Every endpoint is gated by `require_pharmacy_owner(user, db)` (existing
helper): rejects admins, rejects non-owners, returns the caller's pharmacy_id.
The pharmacy is implicit; URLs don't take a pharmacy_id.

Owner manages EMPLOYEES only (per locked decision). Co-owners are off-limits
to peers — admin handles owner lifecycle via /admin/pharmacies/{id}.

Permission model (3-layer): employee's effective access =
    pharmacy_features ∩ owner.user_permissions ∩ employee.user_permissions
This router doesn't enforce the ceiling on the PUT — the frontend disables
locked toggles; the intersection at read time (permissions.py) is the truth.
"""
from __future__ import annotations

import secrets
from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, status as http_status

from database import DbDep
from models import (
    ALLOWED_FEATURES,
    PharmacyFeature,
    User,
    UserPermission,
)
from permissions import require_pharmacy_owner
from schemas.admin_pharmacies import (
    CreateUserIn,
    CreateUserOut,
    MemberOut,
    PermissionsBulkSet,
    ResetPasswordOut,
    StatusPatchIn,
)
from schemas.owner_employees import OwnerEmployeesResponse
from security import CurrentUserDep, hash_password


router = APIRouter(tags=["owner-employees"])


# ── Helpers (kept local; admin's equivalents are private to admin_pharmacies.py) ─

def _member_to_out(u: User, granted: list[str]) -> MemberOut:
    return MemberOut(
        id=u.id,
        full_name=u.name,
        email=u.email,
        role=u.role,  # type: ignore[arg-type]
        status=u.status if u.status in ("active", "inactive") else "active",  # type: ignore[arg-type]
        granted_permissions=granted,
    )


def _granted_for(db, user_ids: list[int]) -> dict[int, list[str]]:
    """{user_id: sorted enabled-permission-strings}. One query for N users."""
    if not user_ids:
        return {}
    rows = (
        db.query(UserPermission.user_id, UserPermission.permission)
        .filter(UserPermission.user_id.in_(user_ids), UserPermission.enabled.is_(True))
        .all()
    )
    out: dict[int, set[str]] = {uid: set() for uid in user_ids}
    for uid, perm in rows:
        out.setdefault(uid, set()).add(perm)
    return {uid: sorted(perms) for uid, perms in out.items()}


def _pharm_features(db, pharmacy_id: int) -> list[str]:
    rows = (
        db.query(PharmacyFeature.feature)
        .filter(PharmacyFeature.pharmacy_id == pharmacy_id, PharmacyFeature.enabled.is_(True))
        .all()
    )
    return sorted({r[0] for r in rows})


def _get_employee_or_404(db, pharmacy_id: int, employee_id: int) -> User:
    """Fetch the target employee, enforcing: must belong to caller's pharmacy
    AND must have role=employee. 404 hides existence on mismatch — admin's
    audit log is the source of truth, owners don't need a 403 leaking other-
    pharmacy employee ids."""
    emp = (
        db.query(User)
        .filter(
            User.id == employee_id,
            User.pharmacy_id == pharmacy_id,
            User.role == "employee",
        )
        .first()
    )
    if not emp:
        raise HTTPException(status_code=404, detail="Employé introuvable.")
    return emp


def _apply_permissions_bulk(db, user_id: int, permissions: dict[str, bool]) -> None:
    """Upsert UserPermission rows for the given user. Unknown feature keys
    silently ignored (frontend should only send ALLOWED_FEATURES)."""
    existing = {
        p.permission: p for p in db.query(UserPermission)
        .filter(UserPermission.user_id == user_id).all()
    }
    for key, enabled in permissions.items():
        if key not in ALLOWED_FEATURES:
            continue
        if key in existing:
            existing[key].enabled = bool(enabled)
        else:
            db.add(UserPermission(user_id=user_id, permission=key, enabled=bool(enabled)))


# ── List ─────────────────────────────────────────────────────────────────────

@router.get("/owner/employees", response_model=OwnerEmployeesResponse)
def list_employees(user: CurrentUserDep, db: DbDep) -> OwnerEmployeesResponse:
    """One-shot fetch for the page: employees + pharmacy features + caller's
    own permissions. The two ceiling lists drive the 2-layer ceiling display
    in EmployeePermissionsDialog without a second round-trip."""
    pharmacy_id = require_pharmacy_owner(user, db)

    employees = (
        db.query(User)
        .filter(User.pharmacy_id == pharmacy_id, User.role == "employee")
        .order_by(User.id.asc())
        .all()
    )
    granted = _granted_for(db, [e.id for e in employees])

    my_grants = _granted_for(db, [user.id]).get(user.id, [])

    return OwnerEmployeesResponse(
        employees=[_member_to_out(e, granted.get(e.id, [])) for e in employees],
        pharmacy_features=_pharm_features(db, pharmacy_id),
        my_permissions=my_grants,
    )


# ── Create / update / lifecycle ──────────────────────────────────────────────

@router.post("/owner/employees", response_model=CreateUserOut)
def create_employee(body: CreateUserIn, user: CurrentUserDep, db: DbDep) -> CreateUserOut:
    """Create an employee account for the caller's pharmacy. Role is HARDCODED
    to 'employee' server-side — a malicious body with role='owner' is
    overridden silently. Pharmacy is implicit; body.pharmacy_id is ignored.

    Generates a random temp password, returns the cleartext ONCE in the
    response for the frontend's credentials-reveal + mailto flow."""
    pharmacy_id = require_pharmacy_owner(user, db)
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail="Un utilisateur avec cet email existe déjà.",
        )

    temp_password = secrets.token_urlsafe(8)
    new_emp = User(
        email=body.email,
        name=body.full_name,
        password_hash=hash_password(temp_password),
        role="employee",                            # hardcoded — owner can't create co-owners
        status="active",
        pharmacy_id=pharmacy_id,
    )
    db.add(new_emp)
    db.commit()
    db.refresh(new_emp)
    return CreateUserOut(
        member=_member_to_out(new_emp, []),
        temp_password=temp_password,
    )


@router.put("/owner/employees/{employee_id}/permissions", response_model=MemberOut)
def set_employee_permissions(
    body: PermissionsBulkSet,
    user: CurrentUserDep,
    db:   DbDep,
    employee_id: Annotated[int, Path(ge=1)],
) -> MemberOut:
    """Bulk-set the target employee's 9 UserPermission rows. The frontend
    disables locked toggles client-side; we persist whatever the owner sends.
    Effective access is computed read-time as the intersection."""
    pharmacy_id = require_pharmacy_owner(user, db)
    emp = _get_employee_or_404(db, pharmacy_id, employee_id)
    _apply_permissions_bulk(db, emp.id, body.permissions)
    db.commit()
    granted = _granted_for(db, [emp.id]).get(emp.id, [])
    return _member_to_out(emp, granted)


@router.patch("/owner/employees/{employee_id}/status", response_model=MemberOut)
def set_employee_status(
    body: StatusPatchIn,
    user: CurrentUserDep,
    db:   DbDep,
    employee_id: Annotated[int, Path(ge=1)],
) -> MemberOut:
    """Toggle active ↔ inactive. Bumps token_version on inactive so any live
    session of the employee dies immediately."""
    pharmacy_id = require_pharmacy_owner(user, db)
    emp = _get_employee_or_404(db, pharmacy_id, employee_id)
    if emp.status != body.status:
        emp.status = body.status
        if body.status == "inactive":
            emp.token_version += 1
        db.commit()
    granted = _granted_for(db, [emp.id]).get(emp.id, [])
    return _member_to_out(emp, granted)


@router.post("/owner/employees/{employee_id}/reset-password", response_model=ResetPasswordOut)
def reset_employee_password(
    user: CurrentUserDep,
    db:   DbDep,
    employee_id: Annotated[int, Path(ge=1)],
) -> ResetPasswordOut:
    """Regenerate a temp password + bump token_version so live sessions die."""
    pharmacy_id = require_pharmacy_owner(user, db)
    emp = _get_employee_or_404(db, pharmacy_id, employee_id)
    temp_password = secrets.token_urlsafe(8)
    emp.password_hash = hash_password(temp_password)
    emp.token_version += 1
    db.commit()
    return ResetPasswordOut(user_id=emp.id, temp_password=temp_password)


@router.delete("/owner/employees/{employee_id}")
def delete_employee(
    user: CurrentUserDep,
    db:   DbDep,
    employee_id: Annotated[int, Path(ge=1)],
) -> dict:
    """Hard-delete an employee. Cascades drop their UserPermission rows
    (FK ondelete=CASCADE). For 'soft remove' use PATCH /status instead."""
    pharmacy_id = require_pharmacy_owner(user, db)
    emp = _get_employee_or_404(db, pharmacy_id, employee_id)
    db.delete(emp)
    db.commit()
    return {"deleted": True, "user_id": employee_id}
