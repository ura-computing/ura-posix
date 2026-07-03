"""Shapes for the admin's permission-management pages (/admin/pharmacies).

All endpoints sit behind require_admin. Members are users belonging to the
pharmacy (role = "owner" or "employee"; admin is never a member). User
statuses are "active" or "inactive" (per locked spec — no "pending" since
there's no signup workflow)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ── Member-level ──────────────────────────────────────────────────────────────

MemberRole   = Literal["owner", "employee"]
MemberStatus = Literal["active", "inactive"]


class MemberOut(BaseModel):
    """One user on a pharmacy's Membres table. `granted_permissions` is the
    raw UserPermission(enabled=True) set — NOT the effective intersection
    (which the frontend can compute by intersecting with pharmacy features)."""
    id:                  int
    full_name:           str | None
    email:               str
    role:                MemberRole
    status:              MemberStatus
    granted_permissions: list[str]
    model_config = ConfigDict(from_attributes=True)


# ── Pharmacy list / detail ────────────────────────────────────────────────────

class PharmacyListRow(BaseModel):
    """One row in Screen 1 (Pharmacies index). Superset of the picker-dropdown
    shape — extra fields (members_count, enabled_features, etc.) are ignored
    by the dropdown consumer."""
    id:                int
    name:              str
    code:              str | None
    city:              str | None
    members_count:     int
    member_initials:   list[str]
    enabled_features:  list[str]
    archived_at:       str | None      # ISO timestamp or null (excluded from default list, surfaced if ?include_archived=true)


class PharmacyDetail(BaseModel):
    """Full payload for Screen 2 (Pharmacy detail). One round-trip = info +
    features + members. Saves a second request on every page load."""
    id:                       int
    name:                     str
    code:                     str | None
    city:                     str | None
    address:                  str | None
    phone:                    str | None
    email:                    str | None
    archived_at:              str | None
    enabled_features:         list[str]
    members:                  list[MemberOut]
    # Union of every active owner's enabled permissions in this pharmacy.
    # Powers the second ceiling pill in the admin's permission dialog when
    # editing employees — so admin sees up-front whether their grant will
    # be effective after the 3-layer intersection at read time.
    owners_union_permissions: list[str]


class PharmacyIn(BaseModel):
    """Create or edit body. `name` + `city` are required; others optional.

    `city` is required because the backend derives the pharmacy `code` from
    it (3-letter prefix + zero-padded sequence — see _generate_pharmacy_code
    in routers/admin_pharmacies.py). On CREATE the client-sent `code` is
    ignored; on EDIT it's allowed as a manual override (rare).

    Empty-string coercion: the frontend posts "" (not null) for cleared
    inputs. Coerce blanks to None on the other optional fields so the unique
    constraint on `code` treats them as distinct NULLs."""
    name:    str           = Field(..., min_length=1, max_length=200)
    city:    str           = Field(..., min_length=1, max_length=200)
    code:    str | None    = None
    address: str | None    = None
    phone:   str | None    = None
    email:   str | None    = None

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
    """Bulk-set the 9 PharmacyFeature rows. Keys not present in `features`
    are left untouched — send the full set to fully replace."""
    features: dict[str, bool]


class PermissionsBulkSet(BaseModel):
    """Bulk-set the 9 UserPermission rows for one user. Same shape + semantics
    as FeaturesBulkSet."""
    permissions: dict[str, bool]


# ── User CRUD (admin path) ────────────────────────────────────────────────────

class CreateUserIn(BaseModel):
    """Admin creates an owner or employee for a specific pharmacy. The backend
    generates a random temp password, hashes it for storage, and returns the
    plaintext ONCE in the response so the admin can mail it to the user."""
    full_name:   str | None    = Field(None, max_length=200)
    email:       str           = Field(..., max_length=200)
    role:        MemberRole
    pharmacy_id: int


class CreateUserOut(BaseModel):
    """Create-user response. `temp_password` is the cleartext temp password
    the admin needs to send to the user — they should change it on first
    login. Never persisted in cleartext server-side."""
    member:        MemberOut
    temp_password: str


class ResetPasswordOut(BaseModel):
    """Same shape as the create-user response but for the 'Réinitialiser le
    mot de passe' action."""
    user_id:       int
    temp_password: str


class StatusPatchIn(BaseModel):
    """Toggle a user between active and inactive."""
    status: MemberStatus
