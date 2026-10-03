"""Login, account and session shapes."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.identity.members.schemas import MemberStatus


# ═══ Auth ════════════════════════════════════════════════════════════════════


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ValidateTokenResponse(BaseModel):
    is_setup: bool  # true when password_hash is null (first-time setup)
    full_name: str  # user's display name to greet them on the set-password page


class SetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8)


class UpdateProfileRequest(BaseModel):
    name: str = Field(min_length=1)
    phone: str = Field(min_length=1)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8)


class PharmacyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    code: str | None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    name: str | None
    phone: str | None
    role: Literal["admin", "owner", "employee", "developer"]
    status: MemberStatus
    pharmacy_id: int | None
    last_login_at: datetime | None


class MeResponse(BaseModel):
    user: UserOut
    pharmacy: PharmacyOut | None
    permissions: list[str]


# ═══ Sessions ════════════════════════════════════════════════════════════════


class SessionOut(BaseModel):
    id: str  # stringified for stable frontend cache keys
    device_label: str
    ip: str
    last_active_at: datetime  # maps from sessions.last_used_at
    is_current: bool
