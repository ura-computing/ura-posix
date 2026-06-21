"""Shared permission helpers. Resolves the effective feature set for a user and
exposes a `require(feature)` dependency factory routers can use to gate endpoints.

Admins implicitly have every feature in ALLOWED_FEATURES. Non-admins get the
intersection of their pharmacy's enabled features and their own per-user
permission rows.
"""
from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models import ALLOWED_FEATURES, PharmacyFeature, User, UserPermission


def effective_permissions(db: Session, user: User) -> list[str]:
    """Returns the sorted list of feature strings this user can access."""
    if user.role == "admin":
        return list(ALLOWED_FEATURES)
    if not user.pharmacy_id:
        return []
    pharm_set = {
        f.feature for f in db.query(PharmacyFeature)
        .filter(PharmacyFeature.pharmacy_id == user.pharmacy_id, PharmacyFeature.enabled.is_(True)).all()
    }
    user_set = {
        p.permission for p in db.query(UserPermission)
        .filter(UserPermission.user_id == user.id, UserPermission.enabled.is_(True)).all()
    }
    return sorted(pharm_set & user_set)


def require_feature(feature: str, user: User, db: Session) -> None:
    """Raise 403 if the user doesn't have `feature` in their effective permission set."""
    if feature not in effective_permissions(db, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Accès refusé : la fonctionnalité « {feature} » n'est pas activée pour votre compte.",
        )


def require_admin(user: User) -> None:
    """Raise 403 for non-admin callers. Use on endpoints that manage system-wide state."""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Réservé aux administrateurs.",
        )


def require_pharmacy_owner(user: User, db: Session, *, feature: str | None = None) -> int:
    """For pharmacy-scoped non-admin endpoints. Returns the user's pharmacy_id.

    - Rejects admins (they use /v1/admin/... mirror routes — deferred).
    - Rejects users without a pharmacy.
    - Optionally enforces a feature gate ("import", "achats", "ventes", …).
    """
    if user.role == "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Les admins utilisent /v1/admin/... (à venir).",
        )
    if user.pharmacy_id is None:
        raise HTTPException(status_code=400, detail="Aucune pharmacie associée à ce compte.")
    if feature is not None:
        require_feature(feature, user, db)
    return user.pharmacy_id