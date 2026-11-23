"""« Ma boutique en ligne » — lookups, defaults and row → schema shapes shared by the router.

Lifecycle of a request (one open request per pharmacy):

    soumise ──claim──▶ prise_en_charge ──▶ en_cours ──▶ livree ──▶ cloturee
       ▲                    │
       └──────release───────┘
"""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.core.errors import ApiError, ErrorCode
from app.core.models import StoreCustomization, StoreWebsiteRequest, User
from app.store_website.schemas import ClaimedByOut, CustomizationOut, WebsiteRequestOut

DEFAULT_TEMPLATE = "lumiere"
DEFAULT_FONT_PAIRING = "moderne"
DEFAULT_SECTIONS: dict[str, dict] = {
    "hero": {"visible": True},
    "brands": {"visible": True},
    "catalogue": {"visible": True},
    "soldes": {"visible": True},
    "featured_categories": {"visible": True},
    "testimonials": {"visible": True},
    "contact": {"visible": True},
    "footer": {"visible": True},
}

# Allowed moves from each state. Releasing a claim goes through /release, not /state.
ALLOWED_STATE_TRANSITIONS: dict[str, frozenset[str]] = {
    "soumise": frozenset({"prise_en_charge"}),
    "prise_en_charge": frozenset({"en_cours", "soumise"}),
    "en_cours": frozenset({"livree"}),
    "livree": frozenset({"cloturee"}),
    "cloturee": frozenset(),
}

# JSON columns a PATCH merges into instead of replacing: {"brand_colors": {"primary": "#FF0000"}} keeps secondary.
JSON_MERGE_FIELDS = ("brand_colors", "sections")

LOGO_MAX_BYTES = 2 * 1024 * 1024
LOGO_TYPES = frozenset({"image/png", "image/jpeg", "image/svg+xml", "image/webp"})


def deep_merge(a: dict, b: dict) -> dict:
    """`b` over `a`, nested dicts merged: {"x": {"p": 1, "q": 2}} + {"x": {"p": 3}} → {"x": {"p": 3, "q": 2}}."""
    out = dict(a)
    for k, v in b.items():
        out[k] = deep_merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


def default_brand_colors(palette: list[str]) -> dict[str, str]:
    """The customization's first colors, from the palette the owner picked."""
    return {
        "primary": palette[0] if len(palette) > 0 else "#1FA97E",
        "secondary": palette[1] if len(palette) > 1 else "#F4C9D9",
        "accent": palette[2] if len(palette) > 2 else "#E9C887",
    }


def reset_customization(cust: StoreCustomization, palette: list[str]) -> None:
    """Back to the state of a new request (logo removed)."""
    cust.template = DEFAULT_TEMPLATE
    cust.sections = dict(DEFAULT_SECTIONS)
    cust.brand_colors = default_brand_colors(palette)
    cust.font_pairing = DEFAULT_FONT_PAIRING
    cust.logo_url = None
    cust.logo_data = None
    cust.logo_type = None
    cust.featured_category_ids = []


def get_request_or_404(db: Session, request_id: UUID) -> StoreWebsiteRequest:
    req = db.get(StoreWebsiteRequest, request_id)
    if req is None:
        raise ApiError(404, ErrorCode.REQUEST_NOT_FOUND, "Demande introuvable.")
    return req


def own_request_or_404(db: Session, request_id: UUID, pharmacy_id: int) -> StoreWebsiteRequest:
    """The request, only when it belongs to this pharmacy (another pharmacy's = 404, never 403)."""
    req = get_request_or_404(db, request_id)
    if req.pharmacy_id != pharmacy_id:
        raise ApiError(404, ErrorCode.REQUEST_NOT_FOUND, "Demande introuvable.")
    return req


def claimed_request_or_403(db: Session, request_id: UUID, user: User) -> StoreWebsiteRequest:
    """The request, only for the Support person who took it."""
    req = get_request_or_404(db, request_id)
    if req.claimed_by_id != user.id:
        raise ApiError(403, ErrorCode.NOT_ASSIGNED, "Cette demande est suivie par une autre personne du Support.")
    return req


def customization_of(req: StoreWebsiteRequest) -> StoreCustomization:
    if req.customization is None:
        raise ApiError(500, ErrorCode.CUSTOMIZATION_MISSING, "Personnalisation absente.")
    return req.customization


def open_request_of(db: Session, pharmacy_id: int) -> StoreWebsiteRequest | None:
    """The pharmacy's request not closed yet (at most one)."""
    return (
        db.query(StoreWebsiteRequest)
        .filter(StoreWebsiteRequest.pharmacy_id == pharmacy_id, StoreWebsiteRequest.state != "cloturee")
        .one_or_none()
    )


def request_out(db: Session, req: StoreWebsiteRequest) -> WebsiteRequestOut:
    claimed_by = None
    if req.claimed_by_id is not None:
        person = db.get(User, req.claimed_by_id)
        if person is not None:
            claimed_by = ClaimedByOut(id=person.id, name=person.name or person.email)
    return WebsiteRequestOut(
        id=req.id,
        pharmacy_id=req.pharmacy_id,
        owner_id=req.owner_id,
        store_name=req.store_name,
        slogan=req.slogan,
        brand_palette=list(req.brand_palette or []),
        phone=req.phone,
        custom_domain=req.custom_domain,
        urgency=req.urgency,
        vision=req.vision,
        state=req.state,
        claimed_by=claimed_by,
        claimed_at=req.claimed_at,
        created_at=req.created_at,
        updated_at=req.updated_at,
    )


def customization_out(cust: StoreCustomization) -> CustomizationOut:
    return CustomizationOut(
        template=cust.template,
        sections=dict(cust.sections or {}),
        brand_colors=dict(cust.brand_colors or {}),
        logo_url=cust.logo_url,
        font_pairing=cust.font_pairing,
        featured_category_ids=list(cust.featured_category_ids or []),
        updated_at=cust.updated_at,
    )
