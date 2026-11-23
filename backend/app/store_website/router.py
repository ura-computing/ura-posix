"""/v1/store-website — « Ma boutique en ligne ».

| Caller | Dependency | Does |
|---|---|---|
| Owner / employee | `MemberDep` | sends the pharmacy's request, edits it while `soumise`, picks the featured categories |
| Support (staff) | `AdminDep` | the queue: takes a request, moves it forward, builds the store in the editor, uploads the logo |
| Anyone | none | `/public/preview/{id}` (safe subset for the preview page), `/logo/{id}` (the logo file) |

The owner never sees the work in progress; the featured categories belong to the owner (own endpoint).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, File, Path as PathParam, Response, UploadFile, status as http_status

from app.core.database import DbDep
from app.core.errors import ApiError, ErrorCode
from app.core.models import StoreCustomization, StoreWebsiteRequest
from app.core.permissions import AdminDep, MemberDep
from app.core.security import CurrentUserDep
from app.store_website.schemas import (
    CustomizationOut,
    CustomizationPatch,
    FeaturedCategoriesIn,
    PublicPreviewOut,
    StateTransition,
    WebsiteRequestCreate,
    WebsiteRequestOut,
    WebsiteRequestPatch,
    WebsiteRequestWithCustomizationOut,
)
from app.store_website.service import (
    ALLOWED_STATE_TRANSITIONS,
    DEFAULT_FONT_PAIRING,
    DEFAULT_SECTIONS,
    DEFAULT_TEMPLATE,
    JSON_MERGE_FIELDS,
    LOGO_MAX_BYTES,
    LOGO_TYPES,
    claimed_request_or_403,
    customization_of,
    customization_out,
    deep_merge,
    default_brand_colors,
    get_request_or_404,
    open_request_of,
    own_request_or_404,
    request_out,
    reset_customization,
)

router = APIRouter(prefix="/store-website", tags=["store-website"])

RequestId = Annotated[UUID, PathParam()]


# ─── Owner ──────────────────────────────────────────────────────────────────


@router.get("/my-request", response_model=WebsiteRequestOut | None)
def get_my_request(pharmacy_id: MemberDep, db: DbDep) -> WebsiteRequestOut | None:
    """The pharmacy's open request, or null."""
    req = open_request_of(db, pharmacy_id)
    return request_out(db, req) if req else None


@router.post("/requests", response_model=WebsiteRequestOut, status_code=http_status.HTTP_201_CREATED)
def create_request(
    body: WebsiteRequestCreate, pharmacy_id: MemberDep, user: CurrentUserDep, db: DbDep
) -> WebsiteRequestOut:
    """A new request (one open per pharmacy: 409 with a clear code, not the unique index error). Its customization
    starts from the defaults, so the editor always has something to show."""
    if open_request_of(db, pharmacy_id) is not None:
        raise ApiError(409, ErrorCode.REQUEST_ACTIVE_EXISTS, "Une demande active existe déjà pour cette pharmacie.")
    req = StoreWebsiteRequest(
        id=uuid4(), pharmacy_id=pharmacy_id, owner_id=user.id, state="soumise", **body.model_dump()
    )
    db.add(req)
    db.flush()
    db.add(
        StoreCustomization(
            request_id=req.id,
            template=DEFAULT_TEMPLATE,
            sections=DEFAULT_SECTIONS,
            brand_colors=default_brand_colors(body.brand_palette),
            font_pairing=DEFAULT_FONT_PAIRING,
            featured_category_ids=[],
        )
    )
    db.commit()
    db.refresh(req)
    return request_out(db, req)


@router.patch("/requests/{request_id}", response_model=WebsiteRequestOut)
def patch_request(
    request_id: RequestId, body: WebsiteRequestPatch, pharmacy_id: MemberDep, db: DbDep
) -> WebsiteRequestOut:
    """The owner edits the request while `soumise` (afterwards Support is working on it)."""
    req = own_request_or_404(db, request_id, pharmacy_id)
    if req.state != "soumise":
        raise ApiError(409, ErrorCode.REQUEST_LOCKED, "La demande ne peut plus être modifiée à ce stade.")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(req, field, value)
    db.commit()
    db.refresh(req)
    return request_out(db, req)


@router.patch("/requests/{request_id}/featured-categories", response_model=CustomizationOut)
def patch_featured_categories(
    request_id: RequestId, body: FeaturedCategoriesIn, pharmacy_id: MemberDep, db: DbDep
) -> CustomizationOut:
    """The categories shown first on the store's home page (the owner's choice)."""
    cust = customization_of(own_request_or_404(db, request_id, pharmacy_id))
    cust.featured_category_ids = body.featured_category_ids
    db.commit()
    db.refresh(cust)
    return customization_out(cust)


# ─── Support ────────────────────────────────────────────────────────────────


@router.get("/requests", response_model=list[WebsiteRequestOut])
def list_requests(user: AdminDep, db: DbDep) -> list[WebsiteRequestOut]:
    """Every open request, newest first; the page splits « À traiter » / mine / others."""
    rows = (
        db.query(StoreWebsiteRequest)
        .filter(StoreWebsiteRequest.state != "cloturee")
        .order_by(StoreWebsiteRequest.created_at.desc())
        .all()
    )
    return [request_out(db, r) for r in rows]


@router.get("/requests/{request_id}", response_model=WebsiteRequestWithCustomizationOut)
def get_request_full(request_id: RequestId, user: AdminDep, db: DbDep) -> WebsiteRequestWithCustomizationOut:
    """The request + its customization (the owner uses /my-request)."""
    req = get_request_or_404(db, request_id)
    cust = customization_of(req)
    return WebsiteRequestWithCustomizationOut(
        **request_out(db, req).model_dump(), customization=customization_out(cust)
    )


@router.post("/requests/{request_id}/claim", response_model=WebsiteRequestOut)
def claim_request(request_id: RequestId, user: AdminDep, db: DbDep) -> WebsiteRequestOut:
    """« Prendre en charge »: 409 when another person took it first."""
    req = get_request_or_404(db, request_id)
    if req.claimed_by_id is not None and req.claimed_by_id != user.id:
        raise ApiError(409, ErrorCode.REQUEST_CLAIMED, "Une autre personne du Support a déjà pris cette demande.")
    req.claimed_by_id = user.id
    req.claimed_at = datetime.now(tz=timezone.utc)
    if req.state == "soumise":
        req.state = "prise_en_charge"
    db.commit()
    db.refresh(req)
    return request_out(db, req)


@router.post("/requests/{request_id}/release", response_model=WebsiteRequestOut)
def release_request(request_id: RequestId, user: AdminDep, db: DbDep) -> WebsiteRequestOut:
    """« Libérer »: back in the shared queue."""
    req = claimed_request_or_403(db, request_id, user)
    req.claimed_by_id = None
    req.claimed_at = None
    if req.state == "prise_en_charge":
        req.state = "soumise"
    db.commit()
    db.refresh(req)
    return request_out(db, req)


@router.patch("/requests/{request_id}/state", response_model=WebsiteRequestOut)
def transition_state(request_id: RequestId, body: StateTransition, user: AdminDep, db: DbDep) -> WebsiteRequestOut:
    """Next step of the lifecycle (`ALLOWED_STATE_TRANSITIONS`), only by the person who took it."""
    req = claimed_request_or_403(db, request_id, user)
    if body.state not in ALLOWED_STATE_TRANSITIONS.get(req.state, frozenset()):
        raise ApiError(
            409,
            ErrorCode.TRANSITION_NOT_ALLOWED,
            f"Transition {req.state} → {body.state} non autorisée.",
            from_state=req.state,
            to_state=body.state,
        )
    req.state = body.state
    db.commit()
    db.refresh(req)
    return request_out(db, req)


@router.patch("/requests/{request_id}/customization", response_model=CustomizationOut)
def patch_customization(request_id: RequestId, body: CustomizationPatch, user: AdminDep, db: DbDep) -> CustomizationOut:
    """Editor changes (`brand_colors` / `sections` merged). `logo_url: null` removes the logo."""
    cust = customization_of(claimed_request_or_403(db, request_id, user))
    for field, value in body.model_dump(exclude_unset=True).items():
        if field in JSON_MERGE_FIELDS and isinstance(value, dict):
            setattr(cust, field, deep_merge(getattr(cust, field) or {}, value))
        elif field == "logo_url":
            if value is None:
                cust.logo_url = cust.logo_data = cust.logo_type = None
        else:
            setattr(cust, field, value)
    db.commit()
    db.refresh(cust)
    return customization_out(cust)


@router.post("/requests/{request_id}/customization/reset", response_model=CustomizationOut)
def reset_customization_route(request_id: RequestId, user: AdminDep, db: DbDep) -> CustomizationOut:
    """« Réinitialiser »: back to a new request's customization."""
    req = claimed_request_or_403(db, request_id, user)
    cust = customization_of(req)
    reset_customization(cust, list(req.brand_palette or []))
    db.commit()
    db.refresh(cust)
    return customization_out(cust)


@router.post("/requests/{request_id}/logo", response_model=CustomizationOut)
async def upload_logo(
    request_id: RequestId, user: AdminDep, db: DbDep, file: UploadFile = File(...)
) -> CustomizationOut:
    """The store's logo: PNG / JPG / SVG / WebP, 2 MB max, kept in the database (served by /logo/{id})."""
    cust = customization_of(claimed_request_or_403(db, request_id, user))
    if file.content_type not in LOGO_TYPES:
        raise ApiError(422, ErrorCode.LOGO_FORMAT, "Format non pris en charge. Utilisez PNG, JPG, SVG ou WebP.")
    contents = await file.read()
    if len(contents) > LOGO_MAX_BYTES:
        raise ApiError(413, ErrorCode.LOGO_TOO_LARGE, "Le logo dépasse 2 Mo.")
    cust.logo_data = contents
    cust.logo_type = file.content_type
    # New `v` at each upload: browsers drop the old cached image.
    cust.logo_url = f"/store-website/logo/{request_id}?v={uuid4().hex[:8]}"
    db.commit()
    db.refresh(cust)
    return customization_out(cust)


# ─── Public ─────────────────────────────────────────────────────────────────


@router.get("/public/preview/{request_id}", response_model=PublicPreviewOut)
def public_preview(request_id: RequestId, db: DbDep) -> PublicPreviewOut:
    """What the templates need, plus the pharmacy phone (WhatsApp buttons). No owner data. Unknown id = 404."""
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


@router.get("/logo/{request_id}", response_class=Response)
def get_logo(request_id: RequestId, db: DbDep) -> Response:
    """The logo file. An SVG opened alone runs no script (CSP), the type is never guessed (nosniff)."""
    cust = db.get(StoreCustomization, request_id)
    if cust is None or cust.logo_data is None:
        raise ApiError(404, ErrorCode.PREVIEW_NOT_FOUND, "Aperçu introuvable.")
    return Response(
        content=cust.logo_data,
        media_type=cust.logo_type or "application/octet-stream",
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
            "X-Content-Type-Options": "nosniff",
        },
    )
