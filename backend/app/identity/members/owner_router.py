"""Owner-side /owner/employees endpoints — backs the "Gérer mon équipe" page.

Every endpoint takes `pharmacy_id: OwnerDep` (permissions.py): owners only —
employees and admins get 403 — and gives the caller's pharmacy_id.
The pharmacy is implicit; URLs don't take a pharmacy_id.

Owner manages EMPLOYEES only (per locked decision). Co-owners are off-limits
to peers — admin handles owner lifecycle via /admin/pharmacies/{id}.

Permission model (3-layer): employee's effective access =
    pharmacy_features ∩ owner.user_permissions ∩ employee.user_permissions
This router doesn't enforce the ceiling on the PUT — the frontend disables
locked toggles; the intersection at read time (permissions.py) is the truth.

Member lifecycle + shared helpers live in members.py (also used by
members/admin_router.py); this router only does the owner auth + scope checks.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path, status as http_status

from app.core.database import DbDep
from app.core.errors import ApiError, ErrorCode
from app.identity.members.service import (
    apply_permissions_bulk,
    create_member,
    granted_permissions_map,
    member_out,
    member_to_out,
    reset_member_password,
    reset_member_pin,
    set_member_status,
)
from app.core.models import PharmacyFeature, User
from app.core.permissions import OwnerDep
from app.identity.members.schemas import (
    CreateUserIn,
    CreateUserOut,
    MemberOut,
    PermissionsBulkSet,
    ResetPasswordIn,
    ResetPinIn,
    ResetPasswordOut,
    StatusPatchIn,
)
from app.identity.members.schemas import OwnerEmployeesResponse
from app.core.security import CurrentUserDep


router = APIRouter(tags=["owner-employees"])


# ── Helpers ──────────────────────────────────────────────────────────────────


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
        raise ApiError(404, ErrorCode.EMPLOYEE_NOT_FOUND, "Employé introuvable.")
    return emp


# ── List ─────────────────────────────────────────────────────────────────────


@router.get("/owner/employees", response_model=OwnerEmployeesResponse)
def list_employees(pharmacy_id: OwnerDep, user: CurrentUserDep, db: DbDep) -> OwnerEmployeesResponse:
    """One-shot fetch for the page: employees + pharmacy features + caller's
    own permissions. The two ceiling lists drive the 2-layer ceiling display
    in EmployeePermissionsDialog without a second round-trip."""

    employees = (
        db.query(User).filter(User.pharmacy_id == pharmacy_id, User.role == "employee").order_by(User.id.asc()).all()
    )
    granted = granted_permissions_map(db, [e.id for e in employees])

    my_grants = granted_permissions_map(db, [user.id]).get(user.id, [])

    return OwnerEmployeesResponse(
        employees=[member_to_out(e, granted.get(e.id, [])) for e in employees],
        pharmacy_features=_pharm_features(db, pharmacy_id),
        my_permissions=my_grants,
    )


# ── Create / update / lifecycle ──────────────────────────────────────────────


@router.post("/owner/employees", response_model=CreateUserOut)
def create_employee(body: CreateUserIn, pharmacy_id: OwnerDep, db: DbDep) -> CreateUserOut:
    """Create an employee account for the caller's pharmacy. Role is HARDCODED
    to 'employee' server-side — a malicious body with role='owner' is
    overridden silently. Pharmacy is implicit; body.pharmacy_id is ignored.

    Every permission is granted by default (effective access is still capped
    by the pharmacy + owner ceiling at read time). The owner types the
    password (body.password)."""
    if db.query(User).filter(User.email == body.email).first():
        raise ApiError(
            http_status.HTTP_409_CONFLICT,
            ErrorCode.EMAIL_TAKEN,
            "Un utilisateur avec cet email existe déjà.",
        )

    new_emp = create_member(
        db,
        email=body.email,
        name=body.full_name,
        password=body.password,
        role="employee",  # hardcoded — owner can't create co-owners
        pharmacy_id=pharmacy_id,
    )
    return CreateUserOut(member=member_out(db, new_emp))


@router.put("/owner/employees/{employee_id}/permissions", response_model=MemberOut)
def set_employee_permissions(
    body: PermissionsBulkSet,
    pharmacy_id: OwnerDep,
    db: DbDep,
    employee_id: Annotated[int, Path(ge=1)],
) -> MemberOut:
    """Bulk-set the target employee's 9 UserPermission rows. The frontend
    disables locked toggles client-side; we persist whatever the owner sends.
    Effective access is computed read-time as the intersection."""
    emp = _get_employee_or_404(db, pharmacy_id, employee_id)
    apply_permissions_bulk(db, emp.id, body.permissions)
    db.commit()
    return member_out(db, emp)


@router.patch("/owner/employees/{employee_id}/status", response_model=MemberOut)
def set_employee_status(
    body: StatusPatchIn,
    pharmacy_id: OwnerDep,
    db: DbDep,
    employee_id: Annotated[int, Path(ge=1)],
) -> MemberOut:
    """Toggle active ↔ inactive. Bumps token_version on inactive so any live
    session of the employee dies immediately."""
    emp = _get_employee_or_404(db, pharmacy_id, employee_id)
    set_member_status(db, emp, body.status)
    return member_out(db, emp)


@router.post("/owner/employees/{employee_id}/reset-password", response_model=ResetPasswordOut)
def reset_employee_password(
    body: ResetPasswordIn,
    pharmacy_id: OwnerDep,
    db: DbDep,
    employee_id: Annotated[int, Path(ge=1)],
) -> ResetPasswordOut:
    """Set the password the owner typed + bump token_version so live sessions die."""
    emp = _get_employee_or_404(db, pharmacy_id, employee_id)
    reset_member_password(db, emp, body.password)
    return ResetPasswordOut(user_id=emp.id)


@router.post("/owner/employees/{employee_id}/reset-pin", response_model=ResetPasswordOut)
def reset_employee_pin(
    body: ResetPinIn, pharmacy_id: OwnerDep, db: DbDep, employee_id: Annotated[int, Path(ge=1)]
) -> ResetPasswordOut:
    """Set the lock-screen code the owner typed."""
    emp = _get_employee_or_404(db, pharmacy_id, employee_id)
    reset_member_pin(db, emp, body.pin)
    return ResetPasswordOut(user_id=emp.id)


@router.delete("/owner/employees/{employee_id}", status_code=204)
def delete_employee(
    pharmacy_id: OwnerDep,
    db: DbDep,
    employee_id: Annotated[int, Path(ge=1)],
) -> None:
    """Hard-delete an employee. Cascades drop their UserPermission rows
    (FK ondelete=CASCADE). For 'soft remove' use PATCH /status instead."""
    emp = _get_employee_or_404(db, pharmacy_id, employee_id)
    db.delete(emp)
    db.commit()
