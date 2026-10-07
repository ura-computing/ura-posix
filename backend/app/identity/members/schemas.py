"""Pharmacy + member shapes. The admin pages (/admin/pharmacies) and the owner page
(/owner/employees) share them: a user has the same shape whoever looks at it.
Statuses: "active" | "inactive"."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, field_validator

from app.core.utils import normalize_email


# ═══ Admin: pharmacies + members ═════════════════════════════════════════════
# Shapes for the admin's permission-management pages (/admin/pharmacies).
#
# All endpoints sit behind admin_only. Members are users belonging to the
# pharmacy (role = "owner" or "employee"; admin is never a member). User
# statuses are "active" or "inactive" (per locked spec — no "pending" since
# there's no signup workflow).

MemberRole = Literal["owner", "employee"]
MemberStatus = Literal["active", "inactive"]


class MemberOut(BaseModel):
    """One user on a pharmacy's Membres table. `granted_permissions` is the
    raw UserPermission(enabled=True) set — NOT the effective intersection
    (which the frontend can compute by intersecting with pharmacy features)."""

    id: int
    full_name: str | None
    email: str
    role: MemberRole
    status: MemberStatus
    granted_permissions: list[str]
    model_config = ConfigDict(from_attributes=True)


# ── Pharmacy list / detail ────────────────────────────────────────────────────


class PharmacyListRow(BaseModel):
    """One row in Screen 1 (Pharmacies index). Superset of the picker-dropdown
    shape — extra fields (members_count, enabled_features, etc.) are ignored
    by the dropdown consumer."""

    id: int
    name: str
    code: str | None
    city: str | None
    members_count: int
    member_initials: list[str]
    enabled_features: list[str]
    archived_at: str | None  # ISO timestamp or null (excluded from default list, surfaced if ?include_archived=true)


class PharmacyDetail(BaseModel):
    """Full payload for Screen 2 (Pharmacy detail). One round-trip = info +
    features + members. Saves a second request on every page load."""

    id: int
    name: str
    code: str | None
    city: str | None
    address: str | None
    phone: str | None
    email: str | None
    archived_at: str | None
    enabled_features: list[str]
    members: list[MemberOut]
    # Union of every active owner's enabled permissions in this pharmacy.
    # Powers the second ceiling pill in the admin's permission dialog when
    # editing employees — so admin sees up-front whether their grant will
    # be effective after the 3-layer intersection at read time.
    owners_union_permissions: list[str]


class PharmacyIn(BaseModel):
    """Create or edit body. `name` + `city` are required; others optional.

    `city` is required because the backend derives the pharmacy `code` from
    it (3-letter prefix + zero-padded sequence — see generate_pharmacy_code
    in members.py). On CREATE the client-sent `code` is
    ignored; on EDIT it's allowed as a manual override (rare).

    Empty-string coercion: the frontend posts "" (not null) for cleared
    inputs. Coerce blanks to None on the other optional fields so the unique
    constraint on `code` treats them as distinct NULLs."""

    name: str = Field(..., min_length=1, max_length=200)
    city: str = Field(..., min_length=1, max_length=200)
    code: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None

    @field_validator("code", "address", "phone", "email", mode="before")
    @classmethod
    def empty_to_none(cls, v: object) -> object:
        if isinstance(v, str) and v.strip() == "":
            return None
        return v

    @field_validator("city", mode="before")
    @classmethod
    def city_not_blank(cls, v: object) -> object:
        if isinstance(v, str):
            stripped = v.strip()
            if stripped == "":
                raise ValueError("La ville est requise.")
            return stripped
        return v


# ── Bulk-set toggles ─────────────────────────────────────────────────────────


class FeaturesBulkSet(BaseModel):
    """Bulk-set the 10 PharmacyFeature rows. Keys not present in `features`
    are left untouched — send the full set to fully replace."""

    features: dict[str, bool]


class PermissionsBulkSet(BaseModel):
    """Bulk-set the 10 UserPermission rows for one user. Same shape + semantics
    as FeaturesBulkSet."""

    permissions: dict[str, bool]


# ── User CRUD (admin path) ────────────────────────────────────────────────────


class CreateUserIn(BaseModel):
    """Admin (or owner) creates an owner / employee for a pharmacy and types
    the password themselves (client decision 2026-09-29 — end users aren't
    tech-savvy, so the creator hands them a password they chose). Stored
    hashed only."""

    full_name: str | None = Field(None, max_length=200)
    # Trimmed + lower case, like every stored email: « Ali@Gmail.com » = « ali@gmail.com ».
    email: Annotated[str, BeforeValidator(normalize_email)] = Field(..., max_length=200)
    password: str = Field(..., min_length=8, max_length=128)
    role: MemberRole
    pharmacy_id: int


class CreateUserOut(BaseModel):
    """Create-user response."""

    member: MemberOut


class ResetPasswordIn(BaseModel):
    """'Réinitialiser le mot de passe' — the admin / owner types the new one.
    Same length rule as ChangePasswordRequest."""

    password: str = Field(..., min_length=8, max_length=128)


class ResetPasswordOut(BaseModel):
    user_id: int


class StatusPatchIn(BaseModel):
    """Toggle a user between active and inactive."""

    status: MemberStatus


# ── « Utilisateurs » tab (every account) ─────────────────────────────────────


class UserPharmacyRef(BaseModel):
    id: int
    name: str
    code: str | None
    archived_at: str | None


class AdminUserRow(BaseModel):
    """One row of the admin « Utilisateurs » tab — EVERY account, whatever its
    role or pharmacy. `role` / `status` are the raw stored strings: legacy rows
    may hold values outside MemberRole / MemberStatus and must still show."""

    id: int
    full_name: str | None
    email: str
    phone: str | None
    role: str
    status: str
    pharmacy: UserPharmacyRef | None
    last_login_at: datetime | None
    granted_permissions: list[str]


class AssignPharmacyIn(BaseModel):
    pharmacy_id: int


# ═══ Owner: my team ══════════════════════════════════════════════════════════
# Shapes for the owner's /owner/employees (Gérer mon équipe) page.
#
# Reuses the member / permission schemas from admin_pharmacies — the shape of
# a user is the same whether admin or owner looks at it. The owner endpoints
# add ONE extra response shape: the page's initial GET returns the employees
# list PLUS the contextual ceiling info (pharmacy features + owner's own
# permissions) in one round-trip, so the EmployeePermissionsDialog can render
# its 2-layer ceiling without a second fetch.


class OwnerEmployeesResponse(BaseModel):
    """One-shot payload for /owner/employees:
      - employees: members of the caller's pharmacy with role="employee"
      - pharmacy_features: the pharmacy's enabled features (ceiling layer 1)
      - my_permissions: the calling owner's own granted permissions (ceiling layer 2)
    Together the two ceiling lists let the frontend disable any employee
    permission toggle that EITHER layer doesn't allow."""

    employees: list[MemberOut]
    pharmacy_features: list[str]
    my_permissions: list[str]


# ── Sign-up requests (admin « Demandes » tab) ─────────────────────────────────


class SignupPharmacyRef(BaseModel):
    """The pharmacy a « join » request names, when its code exists."""

    id: int
    name: str
    code: str
    city: str | None


class SignupRequestRow(BaseModel):
    """One pending « Créer un compte ». `pharmacy_code` set = join; else `new_pharmacy_*` =
    a new pharmacy. `email_taken` / `code_unknown`: « Accepter » would be refused."""

    id: int
    created_at: datetime
    role: MemberRole
    full_name: str
    email: str
    phone: str
    pharmacy_code: str | None
    pharmacy: SignupPharmacyRef | None
    new_pharmacy_name: str | None
    new_pharmacy_city: str | None
    new_pharmacy_address: str | None
    email_taken: bool
    code_unknown: bool


class SignupAcceptOut(BaseModel):
    """« Accepter »: the account + its pharmacy (new or joined)."""

    user_id: int
    pharmacy_id: int
    pharmacy_code: str
