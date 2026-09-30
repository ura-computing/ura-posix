"""/v1/store-website — Ma boutique en ligne.

Endpoints are split by intended caller:

- Owner endpoints (`MemberDep`): create + read + edit their
  active request while it's still `soumise`.
- Developer endpoints (`DeveloperDep`): browse the queue, claim,
  advance state, edit the customization, upload a logo.
- Public endpoint (`/public/preview/{id}`): unauthenticated, safe subset
  of the customization + pharmacy phone, for the /preview page rendering.

The Owner never sees the dev's WIP customization; the "featured
categories" list belongs to the owner via a dedicated endpoint (moved
out of the dev editor per user-locked decision 2026-06-27).
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, File, Path as PathParam, UploadFile, status as http_status

from database import DbDep
from errors import ApiError, ErrorCode
from models import StoreCustomization, StoreWebsiteRequest, User
from permissions import AdminDep, DeveloperDep, MemberDep
from schemas.store_website import (
    ClaimedByOut,
    CustomizationOut,
    CustomizationPatch,
    DeveloperAccountOut,
    PublicPreviewOut,
    StateTransition,
    WebsiteRequestCreate,
    WebsiteRequestOut,
    WebsiteRequestPatch,
    WebsiteRequestWithCustomizationOut,
)
from security import CurrentUserDep


router = APIRouter(prefix="/store-website", tags=["store-website"])


# ─── Constants ──────────────────────────────────────────────────────────────

UPLOAD_ROOT = Path(__file__).resolve().parent.parent / "uploads" / "store-logos"
LOGO_MAX_BYTES = 2 * 1024 * 1024  # 2 MB
LOGO_ALLOWED_TYPES = frozenset({"image/png", "image/jpeg", "image/svg+xml", "image/webp"})

DEFAULT_SECTIONS: dict[str, dict] = {
    "hero":                 {"visible": True},
    "brands":               {"visible": True},
    "catalogue":            {"visible": True},
    "soldes":               {"visible": True},
    "featured_categories":  {"visible": True},
    "testimonials":         {"visible": True},
    "contact":              {"visible": True},
    "footer":               {"visible": True},
}

# Which transitions are allowed for a given source state. Developers advance
# forward through the lifecycle; releasing a claim goes through the dedicated
# /release endpoint, not the state one.
ALLOWED_STATE_TRANSITIONS: dict[str, frozenset[str]] = {
    "soumise":         frozenset({"prise_en_charge"}),
    "prise_en_charge": frozenset({"en_cours", "soumise"}),   # can revert if released
    "en_cours":        frozenset({"livree"}),
    "livree":          frozenset({"cloturee"}),
    "cloturee":        frozenset(),
}

# Customization fields stored as dict-shaped JSON columns. PATCH merges into
# the existing value instead of replacing so a client sending
# {"brand_colors": {"primary": "#FF0000"}} doesn't wipe secondary + accent.
_JSON_MERGE_FIELDS = ("brand_colors", "sections")


# ─── Helpers ────────────────────────────────────────────────────────────────

def _deep_merge(a: dict, b: dict) -> dict:
    """Return a new dict where keys in `b` override `a`. Nested dicts are
    merged recursively; any non-dict value on `b` replaces `a`'s value
    outright."""
    out = dict(a)
    for k, v in b.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out

def _out(req: StoreWebsiteRequest, db: DbDep) -> WebsiteRequestOut:
    """Build the owner-facing / dev-queue row shape from a model row."""
    claimed_by = None
    if req.claimed_by_id is not None:
        dev = db.get(User, req.claimed_by_id)
        if dev is not None:
            claimed_by = ClaimedByOut(id=dev.id, name=dev.name or dev.email)
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


def _customization_out(cust: StoreCustomization) -> CustomizationOut:
    return CustomizationOut(
        template=cust.template,
        sections=dict(cust.sections or {}),
        brand_colors=dict(cust.brand_colors or {}),
        logo_url=cust.logo_url,
        font_pairing=cust.font_pairing,
        featured_category_ids=list(cust.featured_category_ids or []),
        updated_at=cust.updated_at,
    )


def _default_brand_colors(palette: list[str]) -> dict[str, str]:
    """Bootstrap the customization's brand_colors from the request's palette."""
    return {
        "primary":   palette[0] if len(palette) > 0 else "#1FA97E",
        "secondary": palette[1] if len(palette) > 1 else "#F4C9D9",
        "accent":    palette[2] if len(palette) > 2 else "#E9C887",
    }


def _get_request_or_404(db: DbDep, request_id: UUID) -> StoreWebsiteRequest:
    req = db.get(StoreWebsiteRequest, request_id)
    if req is None:
        raise ApiError(404, ErrorCode.REQUEST_NOT_FOUND, "Demande introuvable.")
    return req


def _get_active_request_for_pharmacy(db: DbDep, pharmacy_id: int) -> StoreWebsiteRequest | None:
    return (
        db.query(StoreWebsiteRequest)
        .filter(StoreWebsiteRequest.pharmacy_id == pharmacy_id, StoreWebsiteRequest.state != "cloturee")
        .one_or_none()
    )


# ─── Owner endpoints ────────────────────────────────────────────────────────

@router.get("/my-request", response_model=WebsiteRequestOut | None)
def get_my_request(pharmacy_id: MemberDep, db: DbDep) -> WebsiteRequestOut | None:
    """Owner's currently active (non-cloturee) request, or null."""
    req = _get_active_request_for_pharmacy(db, pharmacy_id)
    return _out(req, db) if req else None


@router.post("/requests", response_model=WebsiteRequestOut, status_code=http_status.HTTP_201_CREATED)
def create_request(body: WebsiteRequestCreate, pharmacy_id: MemberDep, user: CurrentUserDep, db: DbDep) -> WebsiteRequestOut:
    """Owner creates a new landing-page request.

    Enforces one-active-per-pharmacy: if an existing request is still open
    (not cloturee), we 409 instead of relying on the DB unique index alone
    so the frontend gets a friendly error string.
    """
    if _get_active_request_for_pharmacy(db, pharmacy_id) is not None:
        raise ApiError(409, ErrorCode.REQUEST_ACTIVE_EXISTS, "Une demande active existe déjà pour cette pharmacie.")

    req = StoreWebsiteRequest(
        id=uuid4(),
        pharmacy_id=pharmacy_id,
        owner_id=user.id,
        store_name=body.store_name,
        slogan=body.slogan,
        brand_palette=body.brand_palette,
        phone=body.phone,
        custom_domain=body.custom_domain,
        urgency=body.urgency,
        vision=body.vision,
        state="soumise",
    )
    db.add(req)
    db.flush()

    # Bootstrap the customization row with sensible defaults so the dev's
    # editor has something to render on first open (no null-handling).
    db.add(StoreCustomization(
        request_id=req.id,
        template="lumiere",
        sections=DEFAULT_SECTIONS,
        brand_colors=_default_brand_colors(body.brand_palette),
        font_pairing="moderne",
        featured_category_ids=[],
    ))

    db.commit()
    db.refresh(req)
    return _out(req, db)


@router.patch("/requests/{request_id}", response_model=WebsiteRequestOut)
def patch_request(
    request_id: Annotated[UUID, PathParam()],
    body: WebsiteRequestPatch,
    pharmacy_id: MemberDep,
    db: DbDep,
) -> WebsiteRequestOut:
    """Owner edits their brief while it's still `soumise`. Any other state
    is locked (a developer is already working on it)."""
    req = _get_request_or_404(db, request_id)
    if req.pharmacy_id != pharmacy_id:
        raise ApiError(404, ErrorCode.REQUEST_NOT_FOUND, "Demande introuvable.")
    if req.state != "soumise":
        raise ApiError(409, ErrorCode.REQUEST_LOCKED, "La demande ne peut plus être modifiée à ce stade.")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(req, field, value)
    db.commit()
    db.refresh(req)
    return _out(req, db)


@router.patch("/requests/{request_id}/featured-categories", response_model=CustomizationOut)
def patch_featured_categories(
    request_id: Annotated[UUID, PathParam()],
    body: dict,
    pharmacy_id: MemberDep,
    db: DbDep,
) -> CustomizationOut:
    """Owner picks which storefront categories get the "Vedette" slot on
    the templates' home page. Moved out of the developer editor
    (user-locked decision 2026-06-27)."""
    req = _get_request_or_404(db, request_id)
    if req.pharmacy_id != pharmacy_id:
        raise ApiError(404, ErrorCode.REQUEST_NOT_FOUND, "Demande introuvable.")

    ids = body.get("featured_category_ids")
    if not isinstance(ids, list) or not all(isinstance(i, str) for i in ids):
        raise ApiError(422, ErrorCode.FEATURED_IDS_INVALID, "featured_category_ids doit être une liste de chaînes.")

    cust = req.customization
    if cust is None:
        raise ApiError(500, ErrorCode.CUSTOMIZATION_MISSING, "Personnalisation absente.")
    cust.featured_category_ids = ids
    db.commit()
    db.refresh(cust)
    return _customization_out(cust)


# ─── Developer endpoints ────────────────────────────────────────────────────

@router.get("/requests", response_model=list[WebsiteRequestOut])
def list_requests(user: DeveloperDep, db: DbDep) -> list[WebsiteRequestOut]:
    """Every non-cloturee request, all queues in one list. Frontend splits
    into À traiter / mine / others."""
    rows = (
        db.query(StoreWebsiteRequest)
        .filter(StoreWebsiteRequest.state != "cloturee")
        .order_by(StoreWebsiteRequest.created_at.desc())
        .all()
    )
    return [_out(r, db) for r in rows]


@router.get("/requests/{request_id}", response_model=WebsiteRequestWithCustomizationOut)
def get_request_full(
    request_id: Annotated[UUID, PathParam()],
    user: DeveloperDep,
    db: DbDep,
) -> WebsiteRequestWithCustomizationOut:
    """Full brief + customization. Dev-only (the owner uses /my-request)."""
    req = _get_request_or_404(db, request_id)
    if req.customization is None:
        raise ApiError(500, ErrorCode.CUSTOMIZATION_MISSING, "Personnalisation absente.")
    base = _out(req, db)
    return WebsiteRequestWithCustomizationOut(
        **base.model_dump(),
        customization=_customization_out(req.customization),
    )


@router.post("/requests/{request_id}/claim", response_model=WebsiteRequestOut)
def claim_request(
    request_id: Annotated[UUID, PathParam()],
    user: DeveloperDep,
    db: DbDep,
) -> WebsiteRequestOut:
    """Dev takes ownership of a pending request. 409 if someone else got
    there first."""
    req = _get_request_or_404(db, request_id)
    if req.claimed_by_id is not None and req.claimed_by_id != user.id:
        raise ApiError(409, ErrorCode.REQUEST_CLAIMED, "Demande déjà réclamée par un autre développeur.")

    req.claimed_by_id = user.id
    req.claimed_at    = datetime.now(tz=timezone.utc)
    if req.state == "soumise":
        req.state = "prise_en_charge"
    db.commit()
    db.refresh(req)
    return _out(req, db)


@router.post("/requests/{request_id}/release", response_model=WebsiteRequestOut)
def release_request(
    request_id: Annotated[UUID, PathParam()],
    user: DeveloperDep,
    db: DbDep,
) -> WebsiteRequestOut:
    """Dev unclaims — puts the request back in the shared queue."""
    req = _get_request_or_404(db, request_id)
    if req.claimed_by_id != user.id:
        raise ApiError(403, ErrorCode.NOT_ASSIGNED_DEVELOPER, "Vous n'êtes pas le développeur assigné à cette demande.")
    req.claimed_by_id = None
    req.claimed_at    = None
    if req.state == "prise_en_charge":
        req.state = "soumise"
    db.commit()
    db.refresh(req)
    return _out(req, db)


@router.patch("/requests/{request_id}/state", response_model=WebsiteRequestOut)
def transition_state(
    request_id: Annotated[UUID, PathParam()],
    body: StateTransition,
    user: DeveloperDep,
    db: DbDep,
) -> WebsiteRequestOut:
    """Dev advances the lifecycle. Only the claimer can move it forward."""
    req = _get_request_or_404(db, request_id)
    if req.claimed_by_id != user.id:
        raise ApiError(403, ErrorCode.NOT_ASSIGNED_DEVELOPER, "Vous n'êtes pas le développeur assigné à cette demande.")
    allowed = ALLOWED_STATE_TRANSITIONS.get(req.state, frozenset())
    if body.state not in allowed:
        raise ApiError(
            409, ErrorCode.TRANSITION_NOT_ALLOWED,
            f"Transition {req.state} → {body.state} non autorisée.",
            from_state=req.state, to_state=body.state,
        )
    req.state = body.state
    db.commit()
    db.refresh(req)
    return _out(req, db)


@router.patch("/requests/{request_id}/customization", response_model=CustomizationOut)
def patch_customization(
    request_id: Annotated[UUID, PathParam()],
    body: CustomizationPatch,
    user: DeveloperDep,
    db: DbDep,
) -> CustomizationOut:
    """Upsert the styling state. Requires the caller be the claimer."""
    req = _get_request_or_404(db, request_id)
    if req.claimed_by_id != user.id:
        raise ApiError(403, ErrorCode.NOT_ASSIGNED_DEVELOPER, "Vous n'êtes pas le développeur assigné à cette demande.")
    cust = req.customization
    if cust is None:
        raise ApiError(500, ErrorCode.CUSTOMIZATION_MISSING, "Personnalisation absente.")

    for field, value in body.model_dump(exclude_unset=True).items():
        if field in _JSON_MERGE_FIELDS and isinstance(value, dict):
            current = getattr(cust, field) or {}
            setattr(cust, field, _deep_merge(current, value))
        else:
            setattr(cust, field, value)
    db.commit()
    db.refresh(cust)
    return _customization_out(cust)


@router.post("/requests/{request_id}/customization/reset", response_model=CustomizationOut)
def reset_customization(
    request_id: Annotated[UUID, PathParam()],
    user: DeveloperDep,
    db: DbDep,
) -> CustomizationOut:
    """Restore the customization to its initial defaults — same shape as when
    the request was first created. Requires the caller be the claimer."""
    req = _get_request_or_404(db, request_id)
    if req.claimed_by_id != user.id:
        raise ApiError(403, ErrorCode.NOT_ASSIGNED_DEVELOPER, "Vous n'êtes pas le développeur assigné à cette demande.")
    cust = req.customization
    if cust is None:
        raise ApiError(500, ErrorCode.CUSTOMIZATION_MISSING, "Personnalisation absente.")

    cust.template              = "lumiere"
    cust.sections              = dict(DEFAULT_SECTIONS)
    cust.brand_colors          = _default_brand_colors(list(req.brand_palette or []))
    cust.font_pairing          = "moderne"
    cust.logo_url              = None
    cust.featured_category_ids = []
    db.commit()
    db.refresh(cust)
    return _customization_out(cust)


@router.post("/requests/{request_id}/logo", response_model=CustomizationOut)
async def upload_logo(
    request_id: Annotated[UUID, PathParam()],
    user: DeveloperDep,
    db: DbDep,
    file: UploadFile = File(...),
) -> CustomizationOut:
    """Multipart logo upload. PNG/SVG/JPG/WEBP only, ≤2 MB. Stored under
    backend/uploads/store-logos/<request_id>/<uuid>.<ext>."""
    req = _get_request_or_404(db, request_id)
    if req.claimed_by_id != user.id:
        raise ApiError(403, ErrorCode.NOT_ASSIGNED_DEVELOPER, "Vous n'êtes pas le développeur assigné à cette demande.")

    if file.content_type not in LOGO_ALLOWED_TYPES:
        raise ApiError(422, ErrorCode.LOGO_FORMAT, "Format non pris en charge. Utilisez PNG, JPG, SVG ou WebP.")

    contents = await file.read()
    if len(contents) > LOGO_MAX_BYTES:
        raise ApiError(413, ErrorCode.LOGO_TOO_LARGE, "Le logo dépasse 2 Mo.")

    ext = {"image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg", "image/webp": "webp"}[file.content_type]
    subdir = UPLOAD_ROOT / str(request_id)
    subdir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}.{ext}"
    (subdir / filename).write_bytes(contents)

    cust = req.customization
    if cust is None:
        raise ApiError(500, ErrorCode.CUSTOMIZATION_MISSING, "Personnalisation absente.")
    cust.logo_url = f"/uploads/store-logos/{request_id}/{filename}"
    db.commit()
    db.refresh(cust)
    return _customization_out(cust)


# ─── Public endpoint ────────────────────────────────────────────────────────

@router.get("/public/preview/{request_id}", response_model=PublicPreviewOut)
def public_preview(request_id: Annotated[UUID, PathParam()], db: DbDep) -> PublicPreviewOut:
    """Unauthenticated preview surface. Safe subset of the customization
    plus the pharmacy phone (needed for WhatsApp CTAs on templates). NO
    owner personal data. 404 masks bogus UUIDs so we don't leak validity."""
    req = db.get(StoreWebsiteRequest, request_id)
    if req is None or req.customization is None:
        raise ApiError(404, ErrorCode.PREVIEW_NOT_FOUND, "Aperçu introuvable.")
    cust = req.customization
    return PublicPreviewOut(
        template=cust.template,
        sections=dict(cust.sections or {}),
        brand_colors=dict(cust.brand_colors or {}),
        logo_url=cust.logo_url,
        font_pairing=cust.font_pairing,
        featured_category_ids=list(cust.featured_category_ids or []),
        store_name=req.store_name,
        pharmacy_phone=req.phone,
    )


# ─── Admin endpoint — developer directory ──────────────────────────────────

@router.get("/admin/developers", response_model=list[DeveloperAccountOut])
def list_developers(user: AdminDep, db: DbDep) -> list[DeveloperAccountOut]:
    """One row per APCM developer user (role = 'developer'). Includes a
    per-dev count of active (non-closed) requests they're currently
    claiming."""
    from models import User
    from sqlalchemy import func as sqlfunc

    # Left-join to the active-request count so a dev with 0 claims still shows up.
    claim_counts_subq = (
        db.query(
            StoreWebsiteRequest.claimed_by_id,
            sqlfunc.count(StoreWebsiteRequest.id).label("cnt"),
        )
        .filter(StoreWebsiteRequest.state != "cloturee")
        .group_by(StoreWebsiteRequest.claimed_by_id)
        .subquery()
    )
    rows = (
        db.query(User, claim_counts_subq.c.cnt)
        .outerjoin(claim_counts_subq, User.id == claim_counts_subq.c.claimed_by_id)
        .filter(User.role == "developer")
        .order_by(User.name.asc(), User.id.asc())
        .all()
    )
    status_map: dict[str, str] = {"active": "actif", "pending": "en_attente", "revoked": "desactive"}
    return [
        DeveloperAccountOut(
            id=str(u.id),
            name=u.name or u.email,
            email=u.email,
            status=status_map.get(u.status, "desactive"),   # type: ignore[arg-type]
            active_requests=int(cnt or 0),
            last_active_at=None,   # last-active-at not tracked yet
        )
        for u, cnt in rows
    ]
