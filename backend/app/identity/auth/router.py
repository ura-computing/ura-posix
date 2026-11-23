"""Login / logout, my account, password flows, my sessions (other devices)."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Request, Response, status
from sqlalchemy.orm import Session as DbSession

from app.notifications.service import notify, staff_ids
from app.core.config import settings
from app.core.database import DbDep
from app.core.email_service import send_magic_link
from app.core.errors import ApiError, ErrorCode
from app.core.models import Session as UserSession, SignupRequest, User
from app.core.permissions import effective_permissions
from app.core.rate_limit import limiter
from app.identity.auth.schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LockOut,
    LockSettingsIn,
    LoginRequest,
    MeResponse,
    PharmacyOut,
    SessionOut,
    SetPasswordRequest,
    SignupIn,
    UnlockIn,
    UpdateProfileRequest,
    UserOut,
    ValidateTokenResponse,
)
from app.core.security import (
    create_access_token,
    CurrentSessionDep,
    CurrentUserDep,
    hash_password,
    SESSION_COOKIE_NAME,
    SESSION_EXPIRY_DAYS,
    SessionCookieDep,
    verify_password,
)
from app.core.utils import (
    generate_token,
    hash_token,
    parse_user_agent,
)


router = APIRouter(tags=["auth"])


# ═══ Auth ════════════════════════════════════════════════════════════════════

RESET_TOKEN_EXPIRY_MIN = 60  # decision #4
INVALID_TOKEN_DETAIL = "Lien invalide ou expiré"
BAD_CREDS_DETAIL = "Email ou mot de passe incorrect"


def _me_response(db: DbSession, user: User, session_row: UserSession | None = None) -> MeResponse:
    return MeResponse(
        user=UserOut.model_validate(user),
        pharmacy=PharmacyOut.model_validate(user.pharmacy) if user.pharmacy else None,
        permissions=effective_permissions(db, user),
        lock=LockOut(
            enabled=user.lock_enabled,
            seconds=user.lock_seconds,
            has_pin=user.lock_pin_hash is not None,
            locked=session_row is not None and session_row.locked_at is not None,
        ),
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
    hashed = hash_token(raw_token)
    user = db.query(User).filter(User.reset_token == hashed).first()
    if not user or not user.reset_token_expires:
        return None
    if user.reset_token_expires < datetime.now(timezone.utc):
        return None
    return user


def _open_session(db: DbSession, user: User, request: Request, response: Response) -> UserSession:
    """A new session for this device (login, after a password change): its row (committed, so its id is in the JWT)
    and both cookies."""
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
    return session_row


@router.post("/auth/login")
@limiter.limit("5/minute")
def login(body: LoginRequest, request: Request, response: Response, db: DbDep) -> MeResponse:
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise ApiError(status.HTTP_401_UNAUTHORIZED, ErrorCode.BAD_CREDENTIALS, BAD_CREDS_DETAIL)
    # `pending` = signed up, not accepted yet: logs in, sees an empty menu (no pharmacy).
    if user.status not in ("active", "pending"):
        raise ApiError(
            status.HTTP_401_UNAUTHORIZED,
            ErrorCode.ACCOUNT_DISABLED,
            "Votre compte a été désactivé. Contactez votre administrateur.",
        )

    user.last_login_at = datetime.now(timezone.utc)
    _open_session(db, user, request, response)  # this device shows up in /v1/sessions
    db.refresh(user)
    return _me_response(db, user)


@router.get("/auth/me")
def me(current: CurrentSessionDep, db: DbDep) -> MeResponse:
    """Also with the screen locked (`lock.locked`): the lock screen shows the user's name."""
    user, session_row = current
    return _me_response(db, user, session_row)


# ═══ Lock screen ═════════════════════════════════════════════════════════════
# After `lock_seconds` without a click or a key the page calls /auth/lock: every route of this session answers 423
# `screenLocked` until /auth/unlock gets the user's 6-digit code. 5 wrong codes in a row → this session ends.

PIN_TRIES = 5


@router.put("/auth/me/lock")
def save_lock(body: LockSettingsIn, current: CurrentSessionDep, db: DbDep) -> MeResponse:
    """On / off, the idle delay, a new code (typed twice on the page)."""
    user, session_row = current
    if session_row.locked_at is not None:
        raise ApiError(status.HTTP_423_LOCKED, ErrorCode.SCREEN_LOCKED, "Écran verrouillé : tapez votre code.")
    if body.pin is not None:
        user.lock_pin_hash = hash_password(body.pin)
        user.lock_failed = 0
    if body.enabled and user.lock_pin_hash is None:
        raise ApiError(status.HTTP_400_BAD_REQUEST, ErrorCode.PIN_REQUIRED, "Choisissez d'abord votre code.")
    user.lock_enabled = body.enabled
    user.lock_seconds = body.seconds
    db.commit()
    return _me_response(db, user, session_row)


@router.post("/auth/lock", status_code=204)
def lock_screen(current: CurrentSessionDep, db: DbDep) -> None:
    """The page was idle: this device's screen locks (nothing happens when the user has no lock screen)."""
    user, session_row = current
    if user.lock_enabled and user.lock_pin_hash and session_row.locked_at is None:
        session_row.locked_at = datetime.now(timezone.utc)
        db.commit()


@router.post("/auth/unlock")
@limiter.limit("20/minute")
def unlock_screen(request: Request, body: UnlockIn, current: CurrentSessionDep, db: DbDep) -> MeResponse:
    """The right code: back where the user was. Wrong: `pinWrong` with the tries left; the 5th ends this session
    (`pinTooMany`: the page logs out)."""
    user, session_row = current
    if user.lock_pin_hash and verify_password(body.pin, user.lock_pin_hash):
        session_row.locked_at = None
        user.lock_failed = 0
        db.commit()
        return _me_response(db, user, session_row)
    user.lock_failed += 1
    if user.lock_failed >= PIN_TRIES:
        user.lock_failed = 0
        db.delete(session_row)
        db.commit()
        # 403, not 401: the page logs out itself (a 401 would open « Session expirée » over the lock screen).
        raise ApiError(status.HTTP_403_FORBIDDEN, ErrorCode.PIN_TOO_MANY, "Trop de codes faux : reconnectez-vous.")
    db.commit()
    raise ApiError(
        status.HTTP_400_BAD_REQUEST, ErrorCode.PIN_WRONG, "Code incorrect.", left=str(PIN_TRIES - user.lock_failed)
    )


@router.patch("/auth/me")
def update_me(body: UpdateProfileRequest, user: CurrentUserDep, db: DbDep) -> MeResponse:
    user.name = body.name
    user.phone = body.phone
    db.commit()
    db.refresh(user)
    return _me_response(db, user)


@router.post("/auth/change-password", status_code=204)
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
        raise ApiError(status.HTTP_400_BAD_REQUEST, ErrorCode.WRONG_PASSWORD, "Mot de passe actuel incorrect")

    user.password_hash = hash_password(body.new_password)
    user.token_version += 1
    db.query(UserSession).filter(UserSession.user_id == user.id).delete()
    db.commit()
    db.refresh(user)

    # Re-issue session + cookies for the current device so this caller stays logged in.
    _open_session(db, user, request, response)


@router.post("/auth/logout", status_code=204)
def logout(response: Response, db: DbDep, session_token: SessionCookieDep = None) -> None:
    if session_token:
        db.query(UserSession).filter(UserSession.refresh_token_hash == hash_token(session_token)).delete()
        db.commit()
    _clear_cookies(response)


@router.post("/auth/forgot-password", status_code=200)
@limiter.limit("3/hour")
def forgot_password(body: ForgotPasswordRequest, request: Request, db: DbDep) -> dict:
    """Always returns 200 with a generic message. Don't leak whether the email exists.
    If the account is active, generates a new reset token (overwrites any prior one)
    and dispatches the magic-link email. SMTP failures are swallowed for the same
    enumeration reason — admin notices via logs."""
    user = db.query(User).filter(User.email == body.email).first()
    if user and user.status == "active":
        raw = generate_token()
        user.reset_token = hash_token(raw)
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


@router.post("/auth/signup", status_code=200)
@limiter.limit("5/hour")
def signup(body: SignupIn, request: Request, db: DbDep) -> dict:
    """« Créer un compte »: stored until the admin accepts or refuses it. An email without an
    account also gets a `pending` user: it logs in at once and sees an empty menu until
    « Accepter ». Same answer whatever was typed: it never says whether the email already has
    an account or the pharmacy code exists — the client keeps his pharmacies private."""
    password_hash = hash_password(body.password)
    pending_user = None
    if not db.query(User).filter(User.email == body.email).first():
        pending_user = User(
            email=body.email,
            name=body.full_name,
            phone=body.phone,
            password_hash=password_hash,
            role=body.role,
            status="pending",
        )
        db.add(pending_user)
        db.flush()
    db.add(
        SignupRequest(
            role=body.role,
            full_name=body.full_name,
            email=body.email,
            phone=body.phone,
            password_hash=password_hash,
            pharmacy_code=body.pharmacy_code,
            pharmacy_name=body.pharmacy_name,
            pharmacy_city=body.pharmacy_city,
            pharmacy_address=body.pharmacy_address,
            status="pending",
            user_id=pending_user.id if pending_user else None,
        )
    )
    notify(db, staff_ids(db), "signupRequest", {"name": body.full_name}, "/admin/pharmacies?tab=demandes")
    db.commit()
    return {"detail": "Demande envoyée"}


@router.get("/auth/validate-token")
def validate_token(token: str, db: DbDep) -> ValidateTokenResponse:
    user = _lookup_valid_reset(db, token)
    if not user:
        raise ApiError(status.HTTP_400_BAD_REQUEST, ErrorCode.INVALID_TOKEN, INVALID_TOKEN_DETAIL)
    return ValidateTokenResponse(
        is_setup=user.password_hash is None,
        full_name=user.name or user.email,
    )


@router.post("/auth/set-password", status_code=204)
def set_password(body: SetPasswordRequest, db: DbDep) -> None:
    user = _lookup_valid_reset(db, body.token)
    if not user:
        raise ApiError(status.HTTP_400_BAD_REQUEST, ErrorCode.INVALID_TOKEN, INVALID_TOKEN_DETAIL)
    user.password_hash = hash_password(body.password)
    user.reset_token = None
    user.reset_token_expires = None
    user.token_version += 1  # kills any pre-existing sessions defensively (decision #105)
    # Wipe zombie session rows whose JWTs were just invalidated above.
    db.query(UserSession).filter(UserSession.user_id == user.id).delete()
    db.commit()


# ═══ Sessions ════════════════════════════════════════════════════════════════


def _to_out(s: UserSession, current_hash: str | None) -> SessionOut:
    return SessionOut(
        id=str(s.id),
        device_label=s.device_label or "Inconnu",
        ip=s.ip or "—",
        last_active_at=s.last_used_at,
        is_current=(s.refresh_token_hash == current_hash) if current_hash else False,
    )


@router.get("/sessions")
def list_my_sessions(
    user: CurrentUserDep,
    db: DbDep,
    session_token: SessionCookieDep = None,
) -> list[SessionOut]:
    current_hash = hash_token(session_token) if session_token else None
    rows = db.query(UserSession).filter(UserSession.user_id == user.id).order_by(UserSession.last_used_at.desc()).all()
    return [_to_out(s, current_hash) for s in rows]


@router.delete("/sessions/{session_id}", status_code=204)
def kill_session(
    session_id: int,
    user: CurrentUserDep,
    db: DbDep,
) -> None:
    """Kill a specific session belonging to the caller. Use POST /auth/logout to
    end the CURRENT session — this endpoint is for killing other devices."""
    deleted = db.query(UserSession).filter(UserSession.id == session_id, UserSession.user_id == user.id).delete()
    if not deleted:
        raise ApiError(status.HTTP_404_NOT_FOUND, ErrorCode.SESSION_NOT_FOUND, "Session introuvable")
    db.commit()


@router.post("/sessions/revoke-others", status_code=204)
def revoke_other_sessions(
    user: CurrentUserDep,
    db: DbDep,
    session_token: SessionCookieDep = None,
) -> None:
    """Delete every session of the caller EXCEPT the one matching session_token cookie."""
    q = db.query(UserSession).filter(UserSession.user_id == user.id)
    if session_token:
        q = q.filter(UserSession.refresh_token_hash != hash_token(session_token))
    q.delete()
    db.commit()
