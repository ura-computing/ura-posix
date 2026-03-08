from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "owner"              # owner | employee
    pharmacy_name: Optional[str] = None   # for owners
    pharmacy_id: Optional[int] = None    # for employees


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
    status: str = "pending"
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


class PharmacyPublic(BaseModel):
    id: int
    name: str

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
    status: str = "pending"
    pharmacy_id: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class UserRoleUpdate(BaseModel):
    role: str  # admin | owner | employee


class UserPharmacyUpdate(BaseModel):
    pharmacy_id: Optional[int] = None


class UserRejectBody(BaseModel):
    reason: Optional[str] = None


# ── Catalog request schemas ────────────────────────────────────────────────────

class CatalogRequestCreate(BaseModel):
    product: str
    tva: Optional[str] = None
    pph: Optional[float] = None
    ppv: Optional[float] = None
    category: Optional[str] = None
    zone: Optional[str] = None
    barcode1: Optional[str] = None
    laboratoire: Optional[str] = None


class CatalogRequestOut(BaseModel):
    id: int
    requested_by: int
    pharmacy_id: Optional[int] = None
    status: str
    reject_reason: Optional[str] = None
    product: str
    tva: Optional[str] = None
    pph: Optional[float] = None
    ppv: Optional[float] = None
    category: Optional[str] = None
    zone: Optional[str] = None
    barcode1: Optional[str] = None
    laboratoire: Optional[str] = None
    created_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    requester_name: Optional[str] = None
    requester_email: Optional[str] = None
    pharmacy_name: Optional[str] = None

    model_config = {"from_attributes": True}


class CatalogRejectBody(BaseModel):
    reason: Optional[str] = None


# ── Medicament schemas (admin direct CRUD) ─────────────────────────────────────

class MedicamentCreate(BaseModel):
    pid: str
    product: str
    tva: Optional[str] = None
    pph: Optional[float] = None
    ppv: Optional[float] = None
    category: Optional[str] = None
    zone: Optional[str] = None
    barcode1: Optional[str] = None
    barcode2: Optional[str] = None
    laboratoire: Optional[str] = None


class MedicamentUpdate(BaseModel):
    product: Optional[str] = None
    tva: Optional[str] = None
    pph: Optional[float] = None
    ppv: Optional[float] = None
    category: Optional[str] = None
    zone: Optional[str] = None
    barcode1: Optional[str] = None
    barcode2: Optional[str] = None
    laboratoire: Optional[str] = None


class MedicamentOut(BaseModel):
    id: int
    pid: str
    product: str
    tva: Optional[str] = None
    pph: Optional[float] = None
    ppv: Optional[float] = None
    category: Optional[str] = None
    zone: Optional[str] = None
    barcode1: Optional[str] = None
    barcode2: Optional[str] = None
    laboratoire: Optional[str] = None

    model_config = {"from_attributes": True}
