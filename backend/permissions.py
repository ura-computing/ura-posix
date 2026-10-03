"""Shared permission helpers. Resolves the effective feature set for a user and
exposes the FastAPI dependencies routers declare (no guard code in handler bodies):

    pharmacy_id: Annotated[int, member("ventes")]   # owner / employee + feature(s)
    pharmacy_id: MemberDep                           # owner / employee, no feature
    pharmacy_id: OwnerDep                            # owner only
    user: AdminDep / DeveloperDep                    # role-only, gives the user
    APIRouter(dependencies=[admin_only])             # a whole admin router

Three-layer permission model:
  - admin:    bypasses everything (gets every feature in ALLOWED_FEATURES)
  - owner:    pharmacy_features ∩ user_permissions
  - employee: pharmacy_features ∩ user_permissions ∩ (union of active owners'
              user_permissions in the same pharmacy). I.e. the owner ceiling —
              an employee can only get a feature if AT LEAST ONE owner has it.
              "Union of owners" because a pharmacy can have multiple owners
              (per locked spec); an employee inheriting from "any owner has it"
              matches the typical UX where the owner who hired you grants access.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import Depends, status
from sqlalchemy.orm import Session

from database import DbDep
from errors import ApiError, ErrorCode
from models import ALLOWED_FEATURES, PharmacyFeature, User, UserPermission
from security import CurrentUserDep


def _user_enabled_perms(db: Session, user_ids: list[int]) -> set[str]:
    """Set of permission strings any of the given users has enabled. Used both
    for the single-user lookup and the owner-union lookup."""
    if not user_ids:
        return set()
    rows = (
        db.query(UserPermission.permission)
        .filter(UserPermission.user_id.in_(user_ids), UserPermission.enabled.is_(True))
        .all()
    )
    return {r[0] for r in rows}


def effective_permissions(db: Session, user: User) -> list[str]:
    """Returns the sorted list of feature strings this user can access."""
    if user.role == "admin":
        return list(ALLOWED_FEATURES)
    if not user.pharmacy_id:
        return []

    pharm_set = {
        f.feature
        for f in db.query(PharmacyFeature)
        .filter(PharmacyFeature.pharmacy_id == user.pharmacy_id, PharmacyFeature.enabled.is_(True))
        .all()
    }
    user_set = _user_enabled_perms(db, [user.id])

    if user.role == "owner":
        return sorted(pharm_set & user_set)

    # Employee: also intersect with the union of active owners' permissions.
    owner_ids = [
        u.id
        for u in db.query(User.id)
        .filter(
            User.pharmacy_id == user.pharmacy_id,
            User.role == "owner",
            User.status == "active",
        )
        .all()
    ]
    if not owner_ids:
        # An orphan employee (no active owner) sees nothing — defensive default
        # that surfaces the misconfig instead of silently granting pharm ∩ user.
        return []
    owner_ceiling = _user_enabled_perms(db, owner_ids)
    return sorted(pharm_set & user_set & owner_ceiling)


def require_feature(feature: str, user: User, db: Session) -> None:
    """Raise 403 if the user doesn't have `feature` in their effective permission set."""
    if feature not in effective_permissions(db, user):
        raise ApiError(
            status.HTTP_403_FORBIDDEN,
            ErrorCode.FEATURE_DISABLED,
            f"Accès refusé : la fonctionnalité « {feature} » n'est pas activée pour votre compte.",
            feature=feature,
        )


def require_admin(user: User) -> None:
    """Raise 403 for non-admin callers. Use on endpoints that manage system-wide state."""
    if user.role != "admin":
        raise ApiError(
            status.HTTP_403_FORBIDDEN,
            ErrorCode.ADMIN_ONLY,
            "Réservé aux administrateurs.",
        )


def require_developer(user: User) -> None:
    """Raise 403 unless the caller is an APCM developer. Backs the
    /v1/store-website developer-side endpoints (list requests, claim,
    edit customization, mark delivered)."""
    if user.role != "developer":
        raise ApiError(
            status.HTTP_403_FORBIDDEN,
            ErrorCode.DEVELOPER_ONLY,
            "Réservé aux développeurs.",
        )


def require_pharmacy_owner(user: User, db: Session, *, feature: str | None = None) -> int:
    """For pharmacy-scoped non-admin endpoints. Returns the user's pharmacy_id.

    - Rejects admins (they use /v1/admin/... mirror routes — deferred).
    - Rejects roles that don't belong to a pharmacy (e.g. developer).
    - Rejects users without a pharmacy.
    - Optionally enforces a feature gate ("import", "achats", "ventes", …).
    """
    if user.role == "admin":
        raise ApiError(
            status.HTTP_403_FORBIDDEN,
            ErrorCode.ADMIN_USE_ADMIN_ROUTES,
            "Les admins utilisent /v1/admin/... (à venir).",
        )
    if user.role not in ("owner", "employee"):
        raise ApiError(
            status.HTTP_403_FORBIDDEN,
            ErrorCode.FORBIDDEN,
            "Ce compte n'a pas accès à cette ressource.",
        )
    if user.pharmacy_id is None:
        raise ApiError(400, ErrorCode.NO_PHARMACY, "Aucune pharmacie associée à ce compte.")
    if feature is not None:
        require_feature(feature, user, db)
    return user.pharmacy_id


# ─── FastAPI dependencies ───────────────────────────────────────────────────


def member(*features: str) -> Any:
    """`pharmacy_id: Annotated[int, member("import", "achats")]` → owner or
    employee of a pharmacy holding every listed feature; gives the pharmacy id."""

    def dep(user: CurrentUserDep, db: DbDep) -> int:
        pharmacy_id = require_pharmacy_owner(user, db)
        for feature in features:
            require_feature(feature, user, db)
        return pharmacy_id

    return Depends(dep)


def _owner(user: CurrentUserDep, db: DbDep) -> int:
    pharmacy_id = require_pharmacy_owner(user, db)
    if user.role != "owner":
        raise ApiError(status.HTTP_403_FORBIDDEN, ErrorCode.OWNER_ONLY, "Réservé aux propriétaires.")
    return pharmacy_id


def _admin(user: CurrentUserDep) -> User:
    require_admin(user)
    return user


def _developer(user: CurrentUserDep) -> User:
    require_developer(user)
    return user


MemberDep = Annotated[int, member()]
OwnerDep = Annotated[int, Depends(_owner)]
AdminDep = Annotated[User, Depends(_admin)]
DeveloperDep = Annotated[User, Depends(_developer)]
admin_only = Depends(_admin)
