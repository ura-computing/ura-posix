"""Admin permission-management endpoints — backs the /admin/pharmacies pages.

Every endpoint requires admin role. Three-layer permission model (per locked
spec): admin manages OWNER permissions; employee permissions stay with the
owner (via /owner/employees, separate router — not in this push).

Pharmacy soft-delete: `DELETE` sets `archived_at`; list excludes archived
by default. Re-create with the same code/email is allowed because the
archived row is hidden from listings + the unique constraint applies only
to ACTIVE rows by convention (we don't clear the archived row's code, so a
unique-violation surfaces if admin tries to reuse — they can rename the
archived row first or restore it instead).

Random passwords: `secrets.token_urlsafe(8)` (~11 chars). Returned ONCE in
the create-user / reset-password response; never stored cleartext.
"""
from __future__ import annotations

import secrets
import unicodedata
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query, status
from sqlalchemy import Integer, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import DbDep
from models import (
    ALLOWED_FEATURES,
    Pharmacy,
    PharmacyFeature,
    User,
    UserPermission,
)
from permissions import require_admin
from schemas.admin_pharmacies import (
    CreateUserIn,
    CreateUserOut,
    FeaturesBulkSet,
    MemberOut,
    PermissionsBulkSet,
    PharmacyDetail,
    PharmacyIn,
    PharmacyListRow,
    ResetPasswordOut,
    StatusPatchIn,
)
from security import CurrentUserDep, hash_password


router = APIRouter(tags=["admin-pharmacies"])


# ── Defaults applied to a newly-created pharmacy ─────────────────────────────
# Per locked spec: the 4 most-used features are on by default; admin can
# toggle the 5 advanced ones later via Screen 2.
DEFAULT_ENABLED_FEATURES = ("rapports", "achats", "ventes", "stock")


# ── Helpers ──────────────────────────────────────────────────────────────────

def _member_to_out(u: User, granted: list[str]) -> MemberOut:
    return MemberOut(
        id=u.id,
        full_name=u.name,
        email=u.email,
        role=u.role,  # type: ignore[arg-type]  # validated by Literal
        status=u.status if u.status in ("active", "inactive") else "active",  # type: ignore[arg-type]
        granted_permissions=granted,
    )


def _enabled_features(db, pharmacy_id: int) -> list[str]:
    rows = (
        db.query(PharmacyFeature.feature)
        .filter(PharmacyFeature.pharmacy_id == pharmacy_id, PharmacyFeature.enabled.is_(True))
        .all()
    )
    return sorted({r[0] for r in rows})


def _granted_permissions_map(db, user_ids: list[int]) -> dict[int, list[str]]:
    """Returns {user_id: sorted enabled-permission-strings}. One query for N
    users — avoids N+1 when building a Membres list."""
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


def _initials(name: str | None, email: str) -> str:
    """Two-letter initials for the avatar stack. Falls back to email when no
    name is set."""
    src = (name or email.split("@", 1)[0]).strip()
    parts = src.split()
    if len(parts) >= 2:
        return (parts[0][:1] + parts[1][:1]).upper()
    return src[:2].upper()


def _get_pharmacy_or_404(db, pharmacy_id: int) -> Pharmacy:
    pharm = db.query(Pharmacy).filter(Pharmacy.id == pharmacy_id).first()
    if not pharm:
        raise HTTPException(status_code=404, detail="Pharmacie introuvable.")
    return pharm


def _apply_features_bulk(db, pharmacy_id: int, features: dict[str, bool]) -> None:
    """Upsert one PharmacyFeature row per key in `features`. Unknown keys are
    silently ignored (we trust the frontend to only send ALLOWED_FEATURES)."""
    existing = {
        f.feature: f for f in db.query(PharmacyFeature)
        .filter(PharmacyFeature.pharmacy_id == pharmacy_id).all()
    }
    for key, enabled in features.items():
        if key not in ALLOWED_FEATURES:
            continue
        if key in existing:
            existing[key].enabled = bool(enabled)
        else:
            db.add(PharmacyFeature(pharmacy_id=pharmacy_id, feature=key, enabled=bool(enabled)))


def _apply_permissions_bulk(db, user_id: int, permissions: dict[str, bool]) -> None:
    """Same shape as _apply_features_bulk but for UserPermission rows."""
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


# ── List + Detail ────────────────────────────────────────────────────────────

@router.get("/admin/pharmacies", response_model=list[PharmacyListRow])
def list_pharmacies(
    user: CurrentUserDep,
    db:   DbDep,
    include_archived: Annotated[bool, Query()] = False,
) -> list[PharmacyListRow]:
    """All pharmacies + members count + enabled-features summary. Archived
    rows are excluded by default."""
    require_admin(user)
    q = db.query(Pharmacy)
    if not include_archived:
        q = q.filter(Pharmacy.archived_at.is_(None))
    pharmacies = q.order_by(Pharmacy.name).all()
    if not pharmacies:
        return []

    pharm_ids = [p.id for p in pharmacies]

    # Members per pharmacy (single query, group by pharmacy)
    member_counts: dict[int, int] = dict(
        db.query(User.pharmacy_id, func.count(User.id))
        .filter(User.pharmacy_id.in_(pharm_ids))
        .group_by(User.pharmacy_id)
        .all()
    )

    # First few members per pharmacy for the avatar-stack initials
    initials_map: dict[int, list[str]] = {pid: [] for pid in pharm_ids}
    members_for_initials = (
        db.query(User.pharmacy_id, User.name, User.email, User.role)
        .filter(User.pharmacy_id.in_(pharm_ids))
        .order_by(User.role.desc(), User.id.asc())  # owners first (role "owner" > "employee" alpha)
        .all()
    )
    for pid, name, email, _role in members_for_initials:
        if len(initials_map.get(pid, [])) < 4:
            initials_map.setdefault(pid, []).append(_initials(name, email))

    # Enabled features per pharmacy
    feat_rows = (
        db.query(PharmacyFeature.pharmacy_id, PharmacyFeature.feature)
        .filter(PharmacyFeature.pharmacy_id.in_(pharm_ids), PharmacyFeature.enabled.is_(True))
        .all()
    )
    features_map: dict[int, set[str]] = {pid: set() for pid in pharm_ids}
    for pid, feat in feat_rows:
        features_map.setdefault(pid, set()).add(feat)

    return [
        PharmacyListRow(
            id=p.id,
            name=p.name,
            code=p.code,
            city=p.city,
            members_count=member_counts.get(p.id, 0),
            member_initials=initials_map.get(p.id, []),
            enabled_features=sorted(features_map.get(p.id, set())),
            archived_at=p.archived_at.isoformat() if p.archived_at else None,
        )
        for p in pharmacies
    ]


@router.get("/admin/pharmacies/{pharmacy_id}", response_model=PharmacyDetail)
def get_pharmacy(
    user: CurrentUserDep,
    db:   DbDep,
    pharmacy_id: Annotated[int, Path(ge=1)],
) -> PharmacyDetail:
    """Full pharmacy payload — info + enabled features + every member with
    their granted permissions."""
    require_admin(user)
    pharm = _get_pharmacy_or_404(db, pharmacy_id)

    members = (
        db.query(User)
        .filter(User.pharmacy_id == pharmacy_id, User.role.in_(("owner", "employee")))
        .order_by(User.role.desc(), User.id.asc())
        .all()
    )
    granted = _granted_permissions_map(db, [m.id for m in members])

    # Union of active owners' enabled permissions — same definition the
    # backend uses in effective_permissions for the employee ceiling.
    # Powers the second ceiling pill in the admin's permission dialog for
    # employees, so admin sees what would actually be effective.
    owners_union: set[str] = set()
    for m in members:
        if m.role == "owner" and m.status == "active":
            owners_union.update(granted.get(m.id, []))

    return PharmacyDetail(
        id=pharm.id,
        name=pharm.name,
        code=pharm.code,
        city=pharm.city,
        address=pharm.address,
        phone=pharm.phone,
        email=pharm.email,
        archived_at=pharm.archived_at.isoformat() if pharm.archived_at else None,
        enabled_features=_enabled_features(db, pharm.id),
        members=[_member_to_out(m, granted.get(m.id, [])) for m in members],
        owners_union_permissions=sorted(owners_union),
    )


# ── Create / update / soft-delete ────────────────────────────────────────────

def _generate_pharmacy_code(db: Session, city: str) -> str:
    """Build a deterministic pharmacy code from the city name.

    Algorithm:
      1. NFD-normalize + strip combining marks + uppercase + alpha-only.
      2. Take the first 3 chars (right-pad with 'X' if shorter).
      3. Find the highest existing sequence for this prefix and add 1.
      4. Format as `{PREFIX}{N:04d}` — e.g. Bouskoura → BOU0001 → BOU0002 …

    A concurrent create with the same prefix can race on the unique index;
    `create_pharmacy` wraps this in a retry loop to handle that.
    """
    norm = "".join(
        c for c in unicodedata.normalize("NFD", city)
        if not unicodedata.combining(c)
    ).upper()
    prefix = "".join(c for c in norm if c.isalpha())[:3].ljust(3, "X")

    max_seq = db.query(
        func.max(func.cast(func.substr(Pharmacy.code, 4), Integer))
    ).filter(Pharmacy.code.like(f"{prefix}%")).scalar() or 0
    return f"{prefix}{max_seq + 1:04d}"


@router.post("/admin/pharmacies", response_model=PharmacyDetail)
def create_pharmacy(body: PharmacyIn, user: CurrentUserDep, db: DbDep) -> PharmacyDetail:
    """Create + auto-enable DEFAULT_ENABLED_FEATURES. The pharmacy `code` is
    auto-generated from `city` (e.g. Bouskoura → BOU0001); any client-sent
    `body.code` is ignored on create. A small retry loop handles the rare
    concurrent-insert race against the unique-on-code index."""
    require_admin(user)

    pharm: Pharmacy | None = None
    for _ in range(5):
        code = _generate_pharmacy_code(db, body.city)
        pharm = Pharmacy(
            name=body.name, code=code, city=body.city,
            address=body.address, phone=body.phone, email=body.email,
        )
        db.add(pharm)
        try:
            db.flush()
            break
        except IntegrityError:
            db.rollback()
            pharm = None
            continue
    if pharm is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Impossible de générer un code unique pour cette ville. Réessayez.",
        )

    for feat in DEFAULT_ENABLED_FEATURES:
        db.add(PharmacyFeature(pharmacy_id=pharm.id, feature=feat, enabled=True))
    db.commit()
    return get_pharmacy(user, db, pharm.id)


@router.patch("/admin/pharmacies/{pharmacy_id}", response_model=PharmacyDetail)
def update_pharmacy(
    body: PharmacyIn,
    user: CurrentUserDep,
    db:   DbDep,
    pharmacy_id: Annotated[int, Path(ge=1)],
) -> PharmacyDetail:
    """Edit pharmacy info — name/code/city/address/phone/email."""
    require_admin(user)
    pharm = _get_pharmacy_or_404(db, pharmacy_id)
    pharm.name    = body.name
    pharm.code    = body.code
    pharm.city    = body.city
    pharm.address = body.address
    pharm.phone   = body.phone
    pharm.email   = body.email
    db.commit()
    return get_pharmacy(user, db, pharm.id)


@router.delete("/admin/pharmacies/{pharmacy_id}")
def archive_pharmacy(
    user: CurrentUserDep,
    db:   DbDep,
    pharmacy_id: Annotated[int, Path(ge=1)],
) -> dict:
    """Soft-delete: set archived_at. Reversible via PATCH (clear archived_at
    out-of-band for now; restore endpoint can land later if needed)."""
    require_admin(user)
    pharm = _get_pharmacy_or_404(db, pharmacy_id)
    if pharm.archived_at is None:
        pharm.archived_at = datetime.now(timezone.utc)
        db.commit()
    return {"archived": True, "pharmacy_id": pharm.id}


# ── Bulk-set toggles ─────────────────────────────────────────────────────────

@router.put("/admin/pharmacies/{pharmacy_id}/features", response_model=PharmacyDetail)
def set_pharmacy_features(
    body: FeaturesBulkSet,
    user: CurrentUserDep,
    db:   DbDep,
    pharmacy_id: Annotated[int, Path(ge=1)],
) -> PharmacyDetail:
    """Single bulk write of the 9 PharmacyFeature toggles. Frontend builds
    the full dict (saves 9 separate round-trips) and POSTs it on the
    'Enregistrer' click in Screen 2 Section A."""
    require_admin(user)
    _get_pharmacy_or_404(db, pharmacy_id)
    _apply_features_bulk(db, pharmacy_id, body.features)
    db.commit()
    return get_pharmacy(user, db, pharmacy_id)


@router.put("/admin/users/{user_id}/permissions", response_model=MemberOut)
def set_user_permissions(
    body: PermissionsBulkSet,
    user: CurrentUserDep,
    db:   DbDep,
    user_id: Annotated[int, Path(ge=1)],
) -> MemberOut:
    """Admin sets one user's 9 permissions in bulk — owners OR employees.
    The 3-layer intersection at read time still applies, so an admin-granted
    employee permission only becomes effective when the pharmacy AND at least
    one active owner also have it (see effective_permissions in
    backend/permissions.py)."""
    require_admin(user)
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    if target.role == "admin":
        raise HTTPException(
            status_code=400,
            detail="Les administrateurs n'ont pas de permissions configurables.",
        )
    _apply_permissions_bulk(db, target.id, body.permissions)
    db.commit()
    granted = _granted_permissions_map(db, [target.id]).get(target.id, [])
    return _member_to_out(target, granted)


# ── Member CRUD ──────────────────────────────────────────────────────────────

@router.post("/admin/pharmacies/{pharmacy_id}/users", response_model=CreateUserOut)
def create_user(
    body: CreateUserIn,
    user: CurrentUserDep,
    db:   DbDep,
    pharmacy_id: Annotated[int, Path(ge=1)],
) -> CreateUserOut:
    """Admin creates an owner or employee account directly. Generates a
    random temp password, returns it ONCE in the response so the admin can
    email it (the frontend uses a mailto: link). Email must be unique app-wide."""
    require_admin(user)
    _get_pharmacy_or_404(db, pharmacy_id)
    if body.pharmacy_id != pharmacy_id:
        raise HTTPException(status_code=400, detail="Incohérence: pharmacy_id du body et de l'URL.")
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Un utilisateur avec cet email existe déjà.")

    temp_password = secrets.token_urlsafe(8)
    new_user = User(
        email=body.email,
        name=body.full_name,
        password_hash=hash_password(temp_password),
        role=body.role,
        status="active",
        pharmacy_id=pharmacy_id,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return CreateUserOut(
        member=_member_to_out(new_user, []),
        temp_password=temp_password,
    )


@router.post("/admin/users/{user_id}/reset-password", response_model=ResetPasswordOut)
def reset_user_password(
    user: CurrentUserDep,
    db:   DbDep,
    user_id: Annotated[int, Path(ge=1)],
) -> ResetPasswordOut:
    """Regenerate a temp password. Invalidates active sessions via
    token_version bump so the user must log in with the new password."""
    require_admin(user)
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    temp_password = secrets.token_urlsafe(8)
    target.password_hash = hash_password(temp_password)
    target.token_version += 1
    db.commit()
    return ResetPasswordOut(user_id=target.id, temp_password=temp_password)


@router.patch("/admin/users/{user_id}/status", response_model=MemberOut)
def set_user_status(
    body: StatusPatchIn,
    user: CurrentUserDep,
    db:   DbDep,
    user_id: Annotated[int, Path(ge=1)],
) -> MemberOut:
    """Toggle active <-> inactive. Going inactive also bumps token_version
    so existing sessions die immediately."""
    require_admin(user)
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    if target.role == "admin":
        raise HTTPException(status_code=400, detail="Impossible de modifier le statut d'un administrateur.")
    if target.status != body.status:
        target.status = body.status
        if body.status == "inactive":
            target.token_version += 1
        db.commit()
    granted = _granted_permissions_map(db, [target.id]).get(target.id, [])
    return _member_to_out(target, granted)


@router.delete("/admin/users/{user_id}")
def delete_user(
    user: CurrentUserDep,
    db:   DbDep,
    user_id: Annotated[int, Path(ge=1)],
) -> dict:
    """Hard-delete a non-admin user. Cascades drop UserPermission rows (FK
    ondelete=CASCADE). For 'soft remove access' use PATCH /status instead."""
    require_admin(user)
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    if target.role == "admin":
        raise HTTPException(status_code=400, detail="Impossible de supprimer un administrateur.")
    db.delete(target)
    db.commit()
    return {"deleted": True, "user_id": user_id}
