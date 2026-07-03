"""Pydantic shapes for the "Ma boutique en ligne" endpoints.

Mirrors `frontend/src/types/storeWebsite.ts`. Owner-authored fields live on
`WebsiteRequest*`; developer-authored styling on `Customization*`.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ─── shared literals ────────────────────────────────────────────────────────

RequestStateLiteral = Literal["soumise", "prise_en_charge", "en_cours", "livree", "cloturee"]
UrgencyLiteral      = Literal["asap", "ce_mois", "flexible"]
TemplateLiteral     = Literal["classique", "moderne", "lumiere", "apotheose", "elegance"]
FontPairingLiteral  = Literal["classique", "moderne", "editorial"]


# ─── owner-side ─────────────────────────────────────────────────────────────

class WebsiteRequestCreate(BaseModel):
    """POST /v1/store-website/requests — owner creates a new request."""
    store_name:    str            = Field(..., min_length=1, max_length=120)
    slogan:        str | None     = Field(None, max_length=280)
    brand_palette: list[str]      = Field(..., min_length=2, max_length=3)
    phone:         str            = Field(..., min_length=6, max_length=32)
    custom_domain: str | None     = Field(None, max_length=255)
    urgency:       UrgencyLiteral
    vision:        str | None     = Field(None, max_length=2000)


class WebsiteRequestPatch(BaseModel):
    """PATCH /v1/store-website/requests/{id} — owner edits while state=soumise."""
    store_name:    str | None     = Field(None, min_length=1, max_length=120)
    slogan:        str | None     = Field(None, max_length=280)
    brand_palette: list[str] | None = Field(None, min_length=2, max_length=3)
    phone:         str | None     = Field(None, min_length=6, max_length=32)
    custom_domain: str | None     = Field(None, max_length=255)
    urgency:       UrgencyLiteral | None = None
    vision:        str | None     = Field(None, max_length=2000)


# ─── developer-side ─────────────────────────────────────────────────────────

class CustomizationPatch(BaseModel):
    """PATCH /v1/store-website/requests/{id}/customization — upsert."""
    template:              TemplateLiteral | None                 = None
    sections:              dict[str, Any] | None                  = None
    brand_colors:          dict[str, str] | None                  = None
    logo_url:              str | None                             = None
    font_pairing:          FontPairingLiteral | None              = None
    featured_category_ids: list[str] | None                       = None


class StateTransition(BaseModel):
    """PATCH /v1/store-website/requests/{id}/state — dev advances lifecycle."""
    state: RequestStateLiteral


# ─── output shapes ──────────────────────────────────────────────────────────

class CustomizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    template:              str
    sections:              dict[str, Any]
    brand_colors:          dict[str, str]
    logo_url:              str | None
    font_pairing:          str
    featured_category_ids: list[str]
    updated_at:            datetime


class ClaimedByOut(BaseModel):
    """Minimal shape shown to the OTHER developer for 'En cours par d'autres'."""
    id:   int
    name: str


class WebsiteRequestOut(BaseModel):
    """Base request shape returned to the owner + to the dev in the queue.
    Excludes the customization (fetched separately for the dev's editor)."""
    model_config = ConfigDict(from_attributes=True)

    id:            UUID
    pharmacy_id:   int
    owner_id:      int
    store_name:    str
    slogan:        str | None
    brand_palette: list[str]
    phone:         str
    custom_domain: str | None
    urgency:       str
    vision:        str | None
    state:         str
    claimed_by:    ClaimedByOut | None = None
    claimed_at:    datetime | None
    created_at:    datetime
    updated_at:    datetime


class WebsiteRequestWithCustomizationOut(WebsiteRequestOut):
    """GET /v1/store-website/requests/{id} — dev editor needs the full picture."""
    customization: CustomizationOut


class PublicPreviewOut(BaseModel):
    """GET /v1/store-website/public/preview/{id} — unauthenticated preview
    surface. NO owner personal data (no name, no email, no vision). Only
    what the templates need to render."""
    template:              str
    sections:              dict[str, Any]
    brand_colors:          dict[str, str]
    logo_url:              str | None
    font_pairing:          str
    featured_category_ids: list[str]
    store_name:            str
    pharmacy_phone:        str


# ─── Admin — developer directory ────────────────────────────────────────────

class DeveloperAccountOut(BaseModel):
    """GET /v1/store-website/admin/developers — one row per APCM developer."""
    id:              str
    name:            str
    email:           str
    status:          Literal["actif", "en_attente", "desactive"]
    active_requests: int
    last_active_at:  datetime | None
