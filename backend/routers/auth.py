from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from database import get_db
from models import User, Pharmacy
from schemas import UserRegister, UserLogin, UserOut, Token, ProfileUpdate

ALL_FEATURES = ["rapports", "import", "achat", "ventes", "stock"]
from utils.auth import verify_password, hash_password, create_access_token, decode_token

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer()


def _get_user_from_token(credentials: HTTPAuthorizationCredentials, db: Session) -> User:
    """Decode token and return user — does NOT check account status."""
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    user = _get_user_from_token(credentials, db)
    if user.status != "active":
        raise HTTPException(status_code=403, detail="account_pending")
    return user


def get_current_user_any_status(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    """For endpoints accessible while account is pending (e.g. /auth/me)."""
    return _get_user_from_token(credentials, db)


@router.post("/register", response_model=Token)
def register(body: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    role = body.role if body.role in ("owner", "employee") else "owner"

    # For employees, resolve pharmacy_name from pharmacy_id
    employee_pharmacy_name = None
    if role == "employee" and body.pharmacy_id:
        pharmacy = db.query(Pharmacy).filter(Pharmacy.id == body.pharmacy_id).first()
        if not pharmacy:
            raise HTTPException(status_code=400, detail="Pharmacy not found")
        employee_pharmacy_name = pharmacy.name

    user = User(
        email=body.email,
        name=body.name,
        phone=body.phone,
        password_hash=hash_password(body.password),
        role=role,
        status="pending",
        pharmacy_name=body.pharmacy_name if role == "owner" else employee_pharmacy_name,
        pharmacy_id=body.pharmacy_id if role == "employee" else None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_access_token({"sub": str(user.id)}), "user": user}


@router.post("/login", response_model=Token)
def login(body: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"access_token": create_access_token({"sub": str(user.id)}), "user": user}


@router.get("/me", response_model=UserOut)
def get_me(
    current_user: User = Depends(get_current_user_any_status),
    db: Session = Depends(get_db),
):
    """Always accessible regardless of account status.
    For employees, computes effective permissions by intersecting with the owner's permissions."""
    if current_user.role == "employee" and current_user.pharmacy_id:
        owner = (
            db.query(User)
            .filter(User.pharmacy_id == current_user.pharmacy_id, User.role == "owner")
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
    if body.image_url is not None:
        current_user.image_url = body.image_url
    if body.email is not None and body.email != current_user.email:
        if db.query(User).filter(User.email == body.email, User.id != current_user.id).first():
            raise HTTPException(status_code=400, detail="Email déjà utilisé")
        current_user.email = body.email
    if body.pharmacy_name is not None:
        current_user.pharmacy_name = body.pharmacy_name
        if current_user.role == "owner" and current_user.pharmacy:
            current_user.pharmacy.name = body.pharmacy_name
    if body.pharmacy_address is not None and current_user.role == "owner" and current_user.pharmacy:
        current_user.pharmacy.address = body.pharmacy_address

    if current_user.name and current_user.phone:
        current_user.profile_complete = True

    db.commit()
    db.refresh(current_user)
    return current_user
