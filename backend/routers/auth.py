from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request, Response, status
from sqlalchemy.orm import Session as DbSession

from config import settings
from database import DbDep
from models import Session as UserSession, User
from permissions import effective_permissions
from schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    MeResponse,
    PharmacyOut,
    SetPasswordRequest,
    UpdateProfileRequest,
    UserOut,
    ValidateTokenResponse,
)
from security import (
    CurrentUserDep,
    SESSION_COOKIE_NAME,
    SESSION_EXPIRY_DAYS,
    SessionCookieDep,
    create_access_token,
    hash_password,
    verify_password,
)
from utils import generate_reset_token, generate_token, hash_reset_token, hash_token, parse_user_agent
from email_service import send_magic_link
from rate_limit import limiter


router = APIRouter()

RESET_TOKEN_EXPIRY_MIN = 60     # decision #4
INVALID_TOKEN_DETAIL = "Lien invalide ou expiré"
BAD_CREDS_DETAIL = "Email ou mot de passe incorrect"


def _me_response(db: DbSession, user: User) -> MeResponse:
    return MeResponse(
        user=UserOut.model_validate(user),
        pharmacy=PharmacyOut.model_validate(user.pharmacy) if user.pharmacy else None,
        permissions=effective_permissions(db, user),
    )


def _set_access_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=token,
        max_age=settings.JWT_ACCESS_EXPIRY_MIN * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
    )


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_EXPIRY_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="lax",
    )


def _clear_cookies(response: Response) -> None:
    for key in ("access_token", SESSION_COOKIE_NAME):
        response.delete_cookie(key=key, httponly=True, secure=settings.COOKIE_SECURE, samesite="lax")


def _lookup_valid_reset(db: DbSession, raw_token: str) -> User | None:
    """Returns the user whose reset_token hash matches, only if not expired."""
    if not raw_token:
        return None
    hashed = hash_reset_token(raw_token)
    user = db.query(User).filter(User.reset_token == hashed).first()
    if not user or not user.reset_token_expires:
        return None
    if user.reset_token_expires < datetime.now(timezone.utc):
        return None
    return user


@router.post("/login")
@limiter.limit("5/minute")
def login(body: LoginRequest, request: Request, response: Response, db: DbDep) -> MeResponse:
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=BAD_CREDS_DETAIL)
    if user.status != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Votre compte a été désactivé. Contactez votre administrateur.")

    now = datetime.now(timezone.utc)
    user.last_login_at = now

    # Create a session row so this device shows up in /v1/sessions.
    raw_session_token = generate_token()
    session_row = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_token(raw_session_token),
        device_label=parse_user_agent(request.headers.get("user-agent")),
        ip=request.client.host if request.client else None,
        created_at=now,
        last_used_at=now,
        expires_at=now + timedelta(days=SESSION_EXPIRY_DAYS),
    )
    db.add(session_row)
    db.commit()      # commit so session_row.id is populated before signing the JWT
    db.refresh(user)

    _set_access_cookie(response, create_access_token(user.id, user.token_version, session_row.id))
    _set_session_cookie(response, raw_session_token)
    return _me_response(db, user)


@router.get("/me")
def me(user: CurrentUserDep, db: DbDep) -> MeResponse:
    return _me_response(db, user)


@router.patch("/me")
def update_me(body: UpdateProfileRequest, user: CurrentUserDep, db: DbDep) -> MeResponse:
    user.name = body.name
    user.phone = body.phone
    db.commit()
    db.refresh(user)
    return _me_response(db, user)


@router.post("/change-password", status_code=204)
def change_password(
    body: ChangePasswordRequest,
    user: CurrentUserDep,
    request: Request,
    response: Response,
    db: DbDep,
) -> None:
    """Verifies current password, sets the new one, AND invalidates every existing
    session for this user (bumps token_version + wipes session rows). Then re-issues
    cookies for THIS device so the caller stays logged in. Other devices must log in
    again — protects against a compromised JWT outliving the password it was issued
    against."""
    if not user.password_hash or not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mot de passe actuel incorrect")

    user.password_hash = hash_password(body.new_password)
    user.token_version += 1
    db.query(UserSession).filter(UserSession.user_id == user.id).delete()
    db.commit()
    db.refresh(user)

    # Re-issue session + cookies for the current device so this caller stays logged in.
    now = datetime.now(timezone.utc)
    raw_session_token = generate_token()
    session_row = UserSession(
        user_id=user.id,
        refresh_token_hash=hash_token(raw_session_token),
        device_label=parse_user_agent(request.headers.get("user-agent")),
        ip=request.client.host if request.client else None,
        created_at=now,
        last_used_at=now,
        expires_at=now + timedelta(days=SESSION_EXPIRY_DAYS),
    )
    db.add(session_row)
    db.commit()
    _set_access_cookie(response, create_access_token(user.id, user.token_version, session_row.id))
    _set_session_cookie(response, raw_session_token)


@router.post("/logout", status_code=204)
def logout(response: Response, db: DbDep, session_token: SessionCookieDep = None) -> None:
    if session_token:
        db.query(UserSession).filter(UserSession.refresh_token_hash == hash_token(session_token)).delete()
        db.commit()
    _clear_cookies(response)


@router.post("/forgot-password", status_code=200)
@limiter.limit("3/hour")
def forgot_password(body: ForgotPasswordRequest, request: Request, db: DbDep) -> dict:
    """Always returns 200 with a generic message. Don't leak whether the email exists.
    If the account is active, generates a new reset token (overwrites any prior one)
    and dispatches the magic-link email. SMTP failures are swallowed for the same
    enumeration reason — admin notices via logs."""
    user = db.query(User).filter(User.email == body.email).first()
    if user and user.status == "active":
        raw = generate_reset_token()
        user.reset_token = hash_reset_token(raw)
        user.reset_token_expires = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRY_MIN)
        db.commit()
        magic_link = f"{settings.FRONTEND_URL}/auth/set-password?token={raw}"
        is_setup = user.password_hash is None
        # email_service.send_magic_link prints to stdout ONLY when MAIL_USERNAME
        # is empty (no SMTP configured). In prod with SMTP set, nothing leaks to
        # logs — the link only travels through email.
        send_magic_link(
            to=user.email,
            name=user.name or user.email,
            magic_link=magic_link,
            is_setup=is_setup,
        )
    return {"detail": "Si votre compte existe, un email a été envoyé"}


@router.get("/validate-token")
def validate_token(token: str, db: DbDep) -> ValidateTokenResponse:
    user = _lookup_valid_reset(db, token)
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=INVALID_TOKEN_DETAIL)
    return ValidateTokenResponse(
        is_setup=user.password_hash is None,
        full_name=user.name or user.email,
    )


@router.post("/set-password", status_code=204)
def set_password(body: SetPasswordRequest, db: DbDep) -> None:
    user = _lookup_valid_reset(db, body.token)
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=INVALID_TOKEN_DETAIL)
    user.password_hash = hash_password(body.password)
    user.reset_token = None
    user.reset_token_expires = None
    user.token_version += 1     # kills any pre-existing sessions defensively (decision #105)
    # Wipe zombie session rows whose JWTs were just invalidated above.
    db.query(UserSession).filter(UserSession.user_id == user.id).delete()
    db.commit()