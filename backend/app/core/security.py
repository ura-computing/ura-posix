from datetime import datetime, timedelta, timezone
from typing import Annotated

import bcrypt
from fastapi import Cookie, Depends, status
from jose import JWTError, jwt

from app.core.config import settings
from app.core.database import DbDep
from app.core.errors import ApiError, ErrorCode
from app.core.models import Session as UserSession, User


JWT_ALGORITHM = "HS256"

# Session cookie lives for 30 days; access_token JWT lives for ~1h.
SESSION_COOKIE_NAME = "session_token"
SESSION_EXPIRY_DAYS = 30

AccessCookieDep = Annotated[str | None, Cookie(alias="access_token")]
SessionCookieDep = Annotated[str | None, Cookie(alias=SESSION_COOKIE_NAME)]


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def create_access_token(user_id: int, token_version: int, session_id: int) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_ACCESS_EXPIRY_MIN)
    payload = {"sub": str(user_id), "tv": token_version, "sid": session_id, "exp": expires}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(db: DbDep, access_token: AccessCookieDep = None) -> User:
    creds_exc = ApiError(
        status.HTTP_401_UNAUTHORIZED,
        ErrorCode.SESSION_EXPIRED,
        "Session expirée, veuillez vous reconnecter",
    )
    if not access_token:
        raise creds_exc
    try:
        payload = jwt.decode(access_token, settings.JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        raise creds_exc

    user = db.get(User, int(payload["sub"]))
    if not user or user.status != "active" or user.token_version != payload.get("tv"):
        raise creds_exc

    # Bind JWT to session row: if the session was killed (DELETE /sessions/{id}
    # or POST /sessions/revoke-others), this device loses access on the next
    # request rather than coasting until JWT expiry.
    sid = payload.get("sid")
    if sid is None:
        raise creds_exc
    session_row = db.get(UserSession, int(sid))
    if not session_row or session_row.user_id != user.id:
        raise creds_exc

    # "Dernière activité" on /me → Sessions. At most one write per device per minute.
    now = datetime.now(timezone.utc)
    if now - session_row.last_used_at > timedelta(minutes=1):
        session_row.last_used_at = now
        db.commit()

    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]
