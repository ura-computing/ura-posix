"""Pydantic shapes for the "Ma boutique en ligne" endpoints.

Mirrors `frontend/src/types/storeWebsite.ts`. Owner-authored fields live on
`WebsiteRequest*`; Support-authored styling on `Customization*`.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.ledger.schemas import Pagination


# ─── shared literals ────────────────────────────────────────────────────────

RequestStateLiteral = Literal["soumise", "prise_en_charge", "en_cours", "livree", "cloturee"]
UrgencyLiteral = Literal["asap", "ce_mois", "flexible"]
TemplateLiteral = Literal["classique", "moderne", "lumiere", "apotheose", "elegance"]
FontPairingLiteral = Literal["classique", "moderne", "editorial"]


# ─── owner-side ─────────────────────────────────────────────────────────────


class WebsiteRequestCreate(BaseModel):
    """POST /v1/store-website/requests — owner creates a new request."""

    store_name: str = Field(..., min_length=1, max_length=120)
    slogan: str | None = Field(None, max_length=280)
    brand_palette: list[str] = Field(..., min_length=2, max_length=3)
    phone: str = Field(..., min_length=6, max_length=32)
    custom_domain: str | None = Field(None, max_length=255)
    urgency: UrgencyLiteral
    vision: str | None = Field(None, max_length=2000)


class WebsiteRequestPatch(BaseModel):
    """PATCH /v1/store-website/requests/{id} — owner edits while state=soumise."""

    store_name: str | None = Field(None, min_length=1, max_length=120)
    slogan: str | None = Field(None, max_length=280)
    brand_palette: list[str] | None = Field(None, min_length=2, max_length=3)
    phone: str | None = Field(None, min_length=6, max_length=32)
    custom_domain: str | None = Field(None, max_length=255)
    urgency: UrgencyLiteral | None = None
    vision: str | None = Field(None, max_length=2000)


class FeaturedCategoriesIn(BaseModel):
    """PATCH /v1/store-website/requests/{id}/featured-categories — the owner's pick, e.g. ["beaute", "bebe"]."""

    featured_category_ids: list[str] = Field(..., max_length=50)


# ─── Support-side ──────────────────────────────────────────────────────────


class CustomizationPatch(BaseModel):
    """PATCH /v1/store-website/requests/{id}/customization — upsert."""

    template: TemplateLiteral | None = None
    sections: dict[str, Any] | None = None
    brand_colors: dict[str, str] | None = None
    logo_url: str | None = None
    font_pairing: FontPairingLiteral | None = None
    featured_category_ids: list[str] | None = None


class StateTransition(BaseModel):
    """PATCH /v1/store-website/requests/{id}/state — dev advances lifecycle."""

    state: RequestStateLiteral


# ─── output shapes ──────────────────────────────────────────────────────────


class CustomizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    template: str
    sections: dict[str, Any]
    brand_colors: dict[str, str]
    logo_url: str | None
    font_pairing: str
    featured_category_ids: list[str]
    updated_at: datetime


class ClaimedByOut(BaseModel):
    """Minimal shape shown to the OTHER developer for 'En cours par d'autres'."""

    id: int
    name: str


class WebsiteRequestOut(BaseModel):
    """Base request shape returned to the owner + to Support in the queue.
    Excludes the customization (fetched separately for the editor). `pharmacy_*` / `owner_name`: who Support
    calls, e.g. « Pharmacie Demo · CAS0001 », « Karim Bennani »."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    pharmacy_id: int
    pharmacy_name: str
    pharmacy_code: str | None
    owner_id: int
    owner_name: str
    logo_url: str | None = None  # the store's logo (GET /store-website/logo/{id}?v=…)
    template: str = "lumiere"  # the model Support picked (the owner's « Voir ma boutique »)
    store_name: str
    slogan: str | None
    brand_palette: list[str]
    phone: str
    custom_domain: str | None
    urgency: str
    vision: str | None
    state: str
    claimed_by: ClaimedByOut | None = None
    claimed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class WebsiteRequestWithCustomizationOut(WebsiteRequestOut):
    """GET /v1/store-website/requests/{id} — dev editor needs the full picture."""

    customization: CustomizationOut


class PublicPreviewOut(BaseModel):
    """GET /v1/store-website/public/preview/{id} — unauthenticated preview
    surface. NO owner personal data (no name, no email, no vision). Only
    what the templates need to render."""

    template: str
    sections: dict[str, Any]
    brand_colors: dict[str, str]
    logo_url: str | None
    font_pairing: str
    featured_category_ids: list[str]
    store_name: str
    pharmacy_phone: str


# ─── The store's data (public: preview now, the downloaded store later) ───────


class StoreProduct(BaseModel):
    """One product of the pharmacy's shelf, as a customer may see it (never PPH, margin, quantity, supplier)."""

    id: int
    name: str
    laboratoire: str | None
    category: str | None  # « Soins visage », « Parapharmacie »
    ppv: float | None  # MAD
    promo_price: float | None = None  # the owner's promo (MAD): shown instead of the PPV, the PPV struck out
    in_stock: bool
    photo: str | None


class StoreCategory(BaseModel):
    name: str
    count: int


class PackItemOut(BaseModel):
    product: StoreProduct
    quantity: int


class StorePackOut(BaseModel):
    """« Pack bébé » — 199 MAD instead of 245 MAD (`ppv_total`: the products at their PPV)."""

    id: int
    name: str
    price: float
    hidden: bool
    ppv_total: float | None
    items: list[PackItemOut]


class StoreSummary(BaseModel):
    """The store's home page data."""

    pharmacy_name: str
    city: str | None
    address: str | None
    categories: list[StoreCategory]  # the shown ones, most products first
    brands: list[str]  # laboratoires with the most products
    featured: list[StoreProduct]  # in stock, with a photo first
    promos: list[StoreProduct]  # the owner's promo prices
    packs: list[StorePackOut]  # the owner's packs (not hidden)


class StoreProductsPage(BaseModel):
    items: list[StoreProduct]
    pagination: Pagination


class StoreProductDetail(StoreProduct):
    description: str | None
    related: list[StoreProduct]  # same category, in stock


# ─── The owner's store settings (any time, the site live too) ─────────────────


class OwnerProduct(StoreProduct):
    hidden: bool  # not on the site


class OwnerProductsPage(BaseModel):
    items: list[OwnerProduct]
    pagination: Pagination
    counts: dict[str, int]  # {"all": 5963, "hidden": 12, "promo": 4}


class OwnerProductPatch(BaseModel):
    """`{"hidden": true}` hides it; `{"promo_price": 149}` sets a promo; `{"promo_price": null}` removes it."""

    hidden: bool | None = None
    promo_price: float | None = Field(None, gt=0, le=1_000_000)


class CategoryChoice(BaseModel):
    name: str
    count: int
    shown: bool


class ShownCategoriesIn(BaseModel):
    """null = every category shows (the default)."""

    shown: list[str] | None


class PackItemIn(BaseModel):
    product_id: int
    quantity: int = Field(1, ge=1, le=99)


class PackIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    price: float = Field(..., gt=0, le=1_000_000)
    hidden: bool = False
    items: list[PackItemIn] = Field(..., min_length=1, max_length=20)


class SiteKeyIn(BaseModel):
    """The domain where the site will live, e.g. « pharmacie-exemple.ma »."""

    domain: str = Field(..., min_length=3, max_length=255)


class SiteKeyOut(BaseModel):
    key: str  # shown once: it goes in the site's `.env`
    domain: str
