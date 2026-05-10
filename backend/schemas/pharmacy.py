from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, field_validator
from utils.constants import Role, Status


class PharmacyCreate(BaseModel):
    name: str
    city: str  # required — used to derive the auto-generated pharmacy code
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class PharmacyUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class OwnerOut(BaseModel):
    id: int
    name: Optional[str] = None
    email: str
    phone: Optional[str] = None

    model_config = {"from_attributes": True}


class PharmacyOut(BaseModel):
    id: int
    name: str
    city: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    options: Dict[str, bool] = {}
    created_at: Optional[datetime] = None
    user_count: int = 0
    owners: List[OwnerOut] = []
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    owner_phone: Optional[str] = None
    owner_pharmacy_name: Optional[str] = None

    @field_validator("options", mode="before")
    @classmethod
    def coerce_options(cls, v: Any) -> Dict[str, bool]:
        return v if v is not None else {}

    model_config = {"from_attributes": True}


class PharmacyPublic(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


# ── Admin user management ──────────────────────────────────────────────────────

class UserAdminOut(BaseModel):
    id: int
    email: str
    name: Optional[str] = None
    phone: Optional[str] = None
    pharmacy_name: Optional[str] = None
    profile_complete: bool = False
    role: str = Role.OWNER
    status: str = Status.PENDING
    permissions: Dict[str, bool] = {}
    pharmacy_id: Optional[int] = None
    created_at: Optional[datetime] = None

    @field_validator("permissions", mode="before")
    @classmethod
    def coerce_permissions(cls, v: Any) -> Dict[str, bool]:
        return v if v is not None else {}

    model_config = {"from_attributes": True}


class EmployeePermissionsUpdate(BaseModel):
    permissions: Dict[str, bool]


class EmployeeInvite(BaseModel):
    """Owner-driven invitation: backend creates an ACTIVE employee
    (no password yet) and emails a /reset-password link."""
    email: str
    name: Optional[str] = None
    phone: Optional[str] = None
    permissions: Dict[str, bool] = {}


class UserInvite(BaseModel):
    """Admin-driven invitation. Can target any role + pharmacy."""
    email: str
    name: Optional[str] = None
    phone: Optional[str] = None
    role: str = Role.OWNER
    pharmacy_id: Optional[int] = None
    permissions: Dict[str, bool] = {}


class EmployeeStatusUpdate(BaseModel):
    status: Literal[Status.ACTIVE, Status.REJECTED]


class UserRoleUpdate(BaseModel):
    role: str  # admin | owner | employee


class UserPharmacyUpdate(BaseModel):
    pharmacy_id: Optional[int] = None


class UserRejectBody(BaseModel):
    reason: Optional[str] = None
