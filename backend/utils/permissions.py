from fastapi import Depends, HTTPException
from models import User
from routers.auth import get_current_user


def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Accès administrateur requis")
    return current_user


def get_current_owner(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Accès propriétaire requis")
    if not current_user.pharmacy_id:
        raise HTTPException(status_code=403, detail="Aucune pharmacie associée à ce compte")
    return current_user


def require_permission(feature: str):
    """Dependency factory — raises 403 if the user's permission for `feature` is explicitly False."""
    def _check(current_user: User = Depends(get_current_user)) -> User:
        perms = current_user.permissions or {}
        if perms.get(feature) is False:
            raise HTTPException(status_code=403, detail=f"Permission refusée : {feature}")
        return current_user
    _check.__name__ = f"require_{feature}"
    return _check
