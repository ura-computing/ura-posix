import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from database import get_db
from models import User, Pharmacy
from schemas import (
    UserSignup, UserLogin, UserOut, Token, ProfileUpdate,
    ForgotPasswordPayload, ForgotPasswordWhatsAppPayload,
    ResetPasswordPayload, VerifyOtpPayload,
)

from utils.auth import verify_password, hash_password, create_access_token, decode_token
from utils.constants import FEATURE_FLAGS as ALL_FEATURES, Role, Status
from utils.email import send_reset_email
from utils.limiter import limiter
from utils.whatsapp import send_whatsapp_otp

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()


def _get_user_from_token(credentials: HTTPAuthorizationCredentials, db: Session) -> User:
    """Decode token and return user — does NOT check account status."""
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Session invalide ou expirée")
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    user = _get_user_from_token(credentials, db)
    if user.status != Status.ACTIVE:
        raise HTTPException(status_code=403, detail="account_pending")
    return user


def get_current_user_any_status(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """For endpoints accessible while account is pending (e.g. /auth/me)."""
    return _get_user_from_token(credentials, db)


@router.post("/signup", response_model=Token)
@limiter.limit("5/minute")
def signup(request: Request, body: UserSignup, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email déjà enregistré")

    role = body.role if body.role in (Role.OWNER, Role.EMPLOYEE) else Role.OWNER

    resolved_pharmacy_name = None
    resolved_pharmacy_id = None

    # Resolution priority: pharmacy_code > pharmacy_id (legacy) > new pharmacy from name+city (owner only).
    if body.pharmacy_code:
        from sqlalchemy import func as _sa_func
        code = body.pharmacy_code.strip().upper()
        pharmacy = (
            db.query(Pharmacy)
            .filter(_sa_func.upper(Pharmacy.code) == code)
            .first()
        )
        if not pharmacy:
            raise HTTPException(status_code=400, detail=f"Code de pharmacie '{body.pharmacy_code}' introuvable")
        resolved_pharmacy_name = pharmacy.name
        resolved_pharmacy_id = pharmacy.id
    elif body.pharmacy_id:
        pharmacy = db.query(Pharmacy).filter(Pharmacy.id == body.pharmacy_id).first()
        if not pharmacy:
            raise HTTPException(status_code=400, detail="Pharmacie introuvable")
        resolved_pharmacy_name = pharmacy.name
        resolved_pharmacy_id = pharmacy.id
    else:
        # No code / id → must be an OWNER creating a new pharmacy. Employees can't self-create.
        if role != Role.OWNER:
            raise HTTPException(status_code=400, detail="Code de pharmacie requis pour rejoindre une pharmacie existante")
        if not body.pharmacy_name:
            raise HTTPException(status_code=400, detail="Nom de pharmacie requis pour créer une nouvelle pharmacie")
        if not body.pharmacy_city:
            raise HTTPException(status_code=400, detail="Ville requise pour créer une nouvelle pharmacie")
        from utils.pharmacy_code import generate_pharmacy_code
        new_pharmacy = Pharmacy(
            name=body.pharmacy_name,
            city=body.pharmacy_city,
            code=generate_pharmacy_code(db, body.pharmacy_city),
        )
        db.add(new_pharmacy)
        db.flush()
        resolved_pharmacy_name = new_pharmacy.name
        resolved_pharmacy_id = new_pharmacy.id

    user = User(
        email=body.email,
        name=body.name,
        phone=body.phone,
        password_hash=hash_password(body.password),
        role=role,
        status=Status.PENDING,
        pharmacy_name=resolved_pharmacy_name,
        pharmacy_id=resolved_pharmacy_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_access_token({"sub": str(user.id)}), "user": user}


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
def login(request: Request, body: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    if user.status == Status.REJECTED:
        raise HTTPException(status_code=403, detail="Compte rejeté")
    return {"access_token": create_access_token({"sub": str(user.id)}), "user": user}


@router.get("/me", response_model=UserOut)
def get_me(
    current_user: User = Depends(get_current_user_any_status),
    db: Session = Depends(get_db),
):
    """Always accessible regardless of account status.
    For employees, computes effective permissions by intersecting with the owner's permissions."""
    if current_user.role == Role.EMPLOYEE and current_user.pharmacy_id:
        owner = (
            db.query(User)
            .filter(User.pharmacy_id == current_user.pharmacy_id, User.role == Role.OWNER)
            .first()
        )
        owner_perms = (owner.permissions or {}) if owner else {}
        emp_perms = current_user.permissions or {}
        effective = {
            f: emp_perms.get(f, True) and owner_perms.get(f, True)
            for f in ALL_FEATURES
        }
        response = UserOut.model_validate(current_user)
        response.permissions = effective
        return response
    return current_user


@router.put("/me", response_model=UserOut)
def update_me(
    body: ProfileUpdate,
    current_user: User = Depends(get_current_user_any_status),
    db: Session = Depends(get_db),
):
    if body.name is not None:
        current_user.name = body.name
    if body.phone is not None:
        current_user.phone = body.phone
    if body.email is not None and body.email != current_user.email:
        if db.query(User).filter(User.email == body.email, User.id != current_user.id).first():
            raise HTTPException(status_code=400, detail="Email déjà utilisé")
        current_user.email = body.email
    if body.pharmacy_name is not None:
        current_user.pharmacy_name = body.pharmacy_name
        if current_user.role == Role.OWNER and current_user.pharmacy:
            current_user.pharmacy.name = body.pharmacy_name
    if body.pharmacy_address is not None and current_user.role == Role.OWNER and current_user.pharmacy:
        current_user.pharmacy.address = body.pharmacy_address

    if current_user.name and current_user.phone:
        current_user.profile_complete = True

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/forgot-password", status_code=204)
@limiter.limit("3/minute")
async def forgot_password(request: Request, body: ForgotPasswordPayload, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        return  # silent — don't reveal whether the email exists
    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)
    db.commit()
    await send_reset_email(user.email, token)


@router.post("/reset-password", status_code=204)
@limiter.limit("5/minute")
def reset_password(request: Request, body: ResetPasswordPayload, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.reset_token == body.token).first()
    if not user or not user.reset_token_expires:
        raise HTTPException(status_code=400, detail="Lien invalide ou expiré")
    if user.reset_token_expires.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Lien expiré")
    user.password_hash = hash_password(body.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()


@router.post("/forgot-password-whatsapp", status_code=204)
async def forgot_password_whatsapp(body: ForgotPasswordWhatsAppPayload, db: Session = Depends(get_db)):
    """Send a 6-digit OTP via WhatsApp for password reset."""
    phone = body.phone.strip().replace(" ", "")
    user = db.query(User).filter(User.phone == phone).first()
    if not user:
        return  # silent — don't reveal whether the phone exists
    otp = f"{secrets.randbelow(900000) + 100000}"
    user.reset_token = otp
    user.reset_token_expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    db.commit()
    await send_whatsapp_otp(phone, otp)


@router.post("/verify-otp")
def verify_otp(body: VerifyOtpPayload, db: Session = Depends(get_db)):
    """Verify OTP and return a reset token for the standard reset-password flow."""
    phone = body.phone.strip().replace(" ", "")
    user = db.query(User).filter(User.phone == phone).first()
    if not user or not user.reset_token or user.reset_token != body.otp:
        raise HTTPException(status_code=400, detail="Code invalide")
    if not user.reset_token_expires or user.reset_token_expires.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Code expiré")
    # Generate a standard reset token so the user can reuse /auth/reset-password
    reset_token = secrets.token_urlsafe(32)
    user.reset_token = reset_token
    user.reset_token_expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    db.commit()
    return {"reset_token": reset_token}
