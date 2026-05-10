from typing import Any, Dict, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
from utils.constants import Role, Status


class UserSignup(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    role: str = Role.OWNER              # owner | employee
    pharmacy_name: Optional[str] = None   # for owners creating a new pharmacy
    pharmacy_city: Optional[str] = None   # required when owner creates a new pharmacy
    pharmacy_id: Optional[int] = None    # for employees, or owners joining existing


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
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
    pharmacy_address: Optional[str] = None

    @field_validator("permissions", mode="before")
    @classmethod
    def coerce_permissions(cls, v: Any) -> Dict[str, bool]:
        return v if v is not None else {}

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    pharmacy_name: Optional[str] = None
    pharmacy_address: Optional[str] = None


class ForgotPasswordPayload(BaseModel):
    email: EmailStr


class ResetPasswordPayload(BaseModel):
    token: str
    new_password: str = Field(min_length=6)


class ForgotPasswordWhatsAppPayload(BaseModel):
    phone: str


class VerifyOtpPayload(BaseModel):
    phone: str
    otp: str
