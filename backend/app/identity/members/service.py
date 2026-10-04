"""Shared pharmacy-member (owner / employee) helpers — used by both
members/admin_router.py and members/owner_router.py — plus the
pharmacy code generator (also used by seed.py).

The routers keep the AUTH + SCOPE checks (permissions.py dependencies,
"employee belongs to caller's pharmacy"); everything below assumes the caller
is already allowed to act on `target`.

Passwords are typed by the admin / owner (create + reset); only the hash is
stored.
"""

from __future__ import annotations

import unicodedata

from fastapi import status
from sqlalchemy import Integer, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ApiError, ErrorCode
from app.core.models import ALLOWED_FEATURES, Pharmacy, PharmacyFeature, User, UserPermission
from app.identity.members.schemas import MemberOut
from app.core.security import hash_password


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
    existing = {p.permission: p for p in db.query(UserPermission).filter(UserPermission.user_id == user_id).all()}
    for key, enabled in permissions.items():
        if key not in ALLOWED_FEATURES:
            continue
        if key in existing:
            existing[key].enabled = bool(enabled)
        else:
            db.add(UserPermission(user_id=user_id, permission=key, enabled=bool(enabled)))


def create_member(
    db: Session,
    *,
    email: str,
    name: str | None,
    password: str | None = None,
    password_hash: str | None = None,
    phone: str | None = None,
    role: str,
    pharmacy_id: int,
) -> User:
    """Create an active owner/employee with EVERY permission granted (client
    decision 2026-09-28 — effective access is still capped by the pharmacy /
    owner ceiling at read time). Caller checks email uniqueness first.
    `password` = typed by the admin / owner; `password_hash` = already hashed
    (sign-up: the pharmacist typed it, only its hash was kept)."""
    user = User(
        email=email,
        name=name,
        phone=phone,
        password_hash=password_hash or hash_password(password or ""),
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


def generate_pharmacy_code(db: Session, city: str) -> str:
    """Build a deterministic pharmacy code from the city name.

    Algorithm:
      1. NFD-normalize + strip combining marks + uppercase + alpha-only.
      2. Take the first 3 chars (right-pad with 'X' if shorter).
      3. Find the highest existing sequence for this prefix and add 1.
      4. Format as `{PREFIX}{N:04d}` — e.g. Bouskoura → BOU0001 → BOU0002 …

    A concurrent create with the same prefix can race on the unique index;
    `add_pharmacy` wraps this in a retry loop to handle that.
    """
    norm = "".join(c for c in unicodedata.normalize("NFD", city) if not unicodedata.combining(c)).upper()
    prefix = "".join(c for c in norm if c.isalpha())[:3].ljust(3, "X")

    max_seq = (
        db.query(func.max(func.cast(func.substr(Pharmacy.code, 4), Integer)))
        .filter(Pharmacy.code.like(f"{prefix}%"))
        .scalar()
        or 0
    )
    return f"{prefix}{max_seq + 1:04d}"


def add_pharmacy(
    db: Session,
    *,
    name: str,
    city: str,
    address: str | None = None,
    phone: str | None = None,
    email: str | None = None,
) -> Pharmacy:
    """New pharmacy with its code from the city (Casablanca → CAS0001) and EVERY
    feature on (client decision 2026-09-28). Flushed, not committed: the caller
    commits with whatever goes with it (admin « Nouvelle pharmacie », an accepted
    sign-up). A few retries cover two pharmacies of the same city at once."""
    for _ in range(5):
        pharm = Pharmacy(
            name=name,
            code=generate_pharmacy_code(db, city),
            city=city,
            address=address,
            phone=phone,
            email=email,
        )
        db.add(pharm)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            continue
        for feature in ALLOWED_FEATURES:
            db.add(PharmacyFeature(pharmacy_id=pharm.id, feature=feature, enabled=True))
        db.flush()
        return pharm
    raise ApiError(
        status.HTTP_503_SERVICE_UNAVAILABLE,
        ErrorCode.PHARMACY_CODE_FAILED,
        "Impossible de générer un code unique pour cette ville. Réessayez.",
    )
