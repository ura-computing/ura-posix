"""Login, account and session shapes."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.core.utils import normalize_email
from app.identity.members.schemas import MemberStatus

# An email a person types: trimmed + lower case before the check, like the stored ones.
TypedEmail = Annotated[EmailStr, BeforeValidator(normalize_email)]


# ═══ Auth ════════════════════════════════════════════════════════════════════


class LoginRequest(BaseModel):
    email: TypedEmail
    password: str


class ForgotPasswordRequest(BaseModel):
    email: TypedEmail


class SignupIn(BaseModel):
    """« Créer un compte ». Owner: a new pharmacy (name + city, address optional) or an
    existing one (its code). Employee: always an existing one (its code)."""

    full_name: str = Field(min_length=1, max_length=200)
    email: TypedEmail
    phone: str = Field(min_length=1, max_length=40)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["owner", "employee"]
    pharmacy_code: str | None = Field(None, max_length=20)
    pharmacy_name: str | None = Field(None, max_length=200)
    pharmacy_city: str | None = Field(None, max_length=200)
    pharmacy_address: str | None = Field(None, max_length=300)

    @field_validator(
        "full_name", "phone", "pharmacy_code", "pharmacy_name", "pharmacy_city", "pharmacy_address", mode="before"
    )
    @classmethod
    def _trim(cls, v: object) -> object:
        """Spaces at both ends removed; an empty optional field = not given."""
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v

    @model_validator(mode="after")
    def _one_pharmacy(self) -> "SignupIn":
        if self.pharmacy_code:
            self.pharmacy_code = self.pharmacy_code.upper()  # « cas0001 » = « CAS0001 »
            self.pharmacy_name = self.pharmacy_city = self.pharmacy_address = None
        elif self.role != "owner" or not (self.pharmacy_name and self.pharmacy_city):
            raise ValueError("pharmacy_code, or pharmacy_name + pharmacy_city for a new pharmacy (owner)")
        return self


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
