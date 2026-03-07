from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    image_url: Optional[str] = None
    phone: Optional[str] = None
    pharmacy_name: Optional[str] = None
    profile_complete: bool = False
    role: str = "owner"
    pharmacy_id: Optional[int] = None

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    pharmacy_name: Optional[str] = None
    image_url: Optional[str] = None


# ── Pharmacy schemas ───────────────────────────────────────────────────────────

class PharmacyCreate(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class PharmacyUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class PharmacyOut(BaseModel):
    id: int
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    created_at: Optional[datetime] = None
    user_count: int = 0

    model_config = {"from_attributes": True}


# ── Admin user management schemas ─────────────────────────────────────────────

class UserAdminOut(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    image_url: Optional[str] = None
    phone: Optional[str] = None
    pharmacy_name: Optional[str] = None
    profile_complete: bool = False
    role: str = "owner"
    pharmacy_id: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserRoleUpdate(BaseModel):
    role: str  # admin | owner | employee


class UserPharmacyUpdate(BaseModel):
    pharmacy_id: Optional[int] = None
