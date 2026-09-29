"""Shared pharmacy-member (owner / employee) helpers — used by both
routers/admin_pharmacies.py and routers/owner_employees.py.

The routers keep the AUTH + SCOPE checks (require_admin, require_pharmacy_owner,
"employee belongs to caller's pharmacy"); everything below assumes the caller
is already allowed to act on `target`.

Passwords are typed by the admin / owner (create + reset); only the hash is
stored.
"""
from __future__ import annotations

from sqlalchemy.orm import Session

from models import ALLOWED_FEATURES, User, UserPermission
from schemas.admin_pharmacies import MemberOut
from security import hash_password


def member_to_out(u: User, granted: list[str]) -> MemberOut:
    return MemberOut(
        id=u.id,
        full_name=u.name,
        email=u.email,
        role=u.role,  # type: ignore[arg-type]  # validated by Literal
        status=u.status if u.status in ("active", "inactive") else "active",  # type: ignore[arg-type]
        granted_permissions=granted,
    )


def granted_permissions_map(db: Session, user_ids: list[int]) -> dict[int, list[str]]:
    """Returns {user_id: sorted enabled-permission-strings}. One query for N
    users — avoids N+1 when building a members list."""
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


def member_out(db: Session, u: User) -> MemberOut:
    """MemberOut for one user with their current granted permissions."""
    return member_to_out(u, granted_permissions_map(db, [u.id]).get(u.id, []))


def apply_permissions_bulk(db: Session, user_id: int, permissions: dict[str, bool]) -> None:
    """Upsert one UserPermission row per key in `permissions`. Unknown keys are
    silently ignored (we trust the frontend to only send ALLOWED_FEATURES)."""
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


def create_member(
    db: Session, *, email: str, name: str | None, password: str, role: str, pharmacy_id: int,
) -> User:
    """Create an active owner/employee with EVERY permission granted (client
    decision 2026-09-28 — effective access is still capped by the pharmacy /
    owner ceiling at read time). Caller checks email uniqueness first."""
    user = User(
        email=email,
        name=name,
        password_hash=hash_password(password),
        role=role,
        status="active",
        pharmacy_id=pharmacy_id,
    )
    db.add(user)
    db.flush()
    apply_permissions_bulk(db, user.id, {f: True for f in ALLOWED_FEATURES})
    db.commit()
    db.refresh(user)
    return user


def set_member_status(db: Session, target: User, status: str) -> None:
    """Toggle active <-> inactive. Going inactive also bumps token_version so
    existing sessions die immediately."""
    if target.status != status:
        target.status = status
        if status == "inactive":
            target.token_version += 1
        db.commit()


def reset_member_password(db: Session, target: User, password: str) -> None:
    """Set the password typed by the admin / owner + bump token_version so
    live sessions die."""
    target.password_hash = hash_password(password)
    target.token_version += 1
    db.commit()
