"""/v1/store-website — « Ma boutique en ligne ».

| Caller | Dependency | Does |
|---|---|---|
| Owner / employee | `MemberDep` | sends the pharmacy's request, edits it while `soumise`, picks the featured categories |
| Support (and the admin) | `AdminDep` | the queue: takes a request, moves it forward, builds the store in the editor, uploads the logo |
| Anyone | none | `/public/preview/{id}` (safe subset for the preview page), `/public/{id}/summary`, `/products`, `/products/{pid}` (ONLY that request's pharmacy's shelf: `catalog_queries.py`), `/logo/{id}` |

The owner never sees the work in progress; the featured categories belong to the owner (own endpoint).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, File, Path as PathParam, Query, Response, UploadFile, status as http_status

from app.core.database import DbDep
from app.core.errors import ApiError, ErrorCode
from app.core.models import Pharmacy, Store, StoreCustomization, StoreWebsiteRequest
from app.core.permissions import AdminDep, MemberDep, OwnerDep
from app.core.security import CurrentUserDep
from app.notifications.service import notify, support_ids
from app.store_website.catalog_queries import store_of, store_product, store_products, store_summary
from app.store_website.schemas import (
    CustomizationOut,
    CustomizationPatch,
    PublicPreviewOut,
    SiteKeyIn,
    SiteKeyOut,
    StateTransition,
    StoreProductDetail,
    StoreProductsPage,
    StoreSummary,
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
    claimed_request_or_403,
    customization_of,
    customization_out,
    deep_merge,
    default_brand_colors,
    clean_domain,
    get_request_or_404,
    new_site_key,
    preview_out,
    notify_store_step,
    open_request_of,
    own_request_or_404,
    request_out,
    reset_customization,
    save_logo,
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
    body: WebsiteRequestCreate, pharmacy_id: OwnerDep, user: CurrentUserDep, db: DbDep
) -> WebsiteRequestOut:
    """A new request (one open per pharmacy: 409 with a clear code, not the unique index error). Its customization
    starts from the defaults, so the editor always has something to show."""
    if open_request_of(db, pharmacy_id) is not None:
        raise ApiError(409, ErrorCode.REQUEST_ACTIVE_EXISTS, "Une demande active existe déjà pour cette pharmacie.")
    req = StoreWebsiteRequest(
        id=uuid4(),
        pharmacy_id=pharmacy_id,
        owner_id=user.id,
        state="soumise",
        **body.model_dump(),
    )
    db.add(req)
    store_of(db, pharmacy_id).request_id = req.id
    pharmacy = db.get(Pharmacy, pharmacy_id)
    notify(
        db,
        support_ids(db),
        "storeRequest",
        {"pharmacy": pharmacy.name if pharmacy else "", "store": body.store_name},
        "boutiques",
    )
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
    request_id: RequestId, body: WebsiteRequestPatch, pharmacy_id: OwnerDep, db: DbDep
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


@router.post("/my-request/logo", response_model=CustomizationOut)
async def upload_my_logo(pharmacy_id: OwnerDep, db: DbDep, file: UploadFile = File(...)) -> CustomizationOut:
    """The owner sends the store's logo with the request (while « Envoyée »: then Support handles it)."""
    req = open_request_of(db, pharmacy_id)
    if req is None:
        raise ApiError(404, ErrorCode.REQUEST_NOT_FOUND, "Demande introuvable.")
    if req.state != "soumise":
        raise ApiError(409, ErrorCode.REQUEST_LOCKED, "La demande ne peut plus être modifiée à ce stade.")
    cust = customization_of(req)
    await save_logo(cust, req.id, file)
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
    notify_store_step(db, req)
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
    notify_store_step(db, req)
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
    notify_store_step(db, req)
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
    """Support replaces the store's logo (the person who took the request)."""
    cust = customization_of(claimed_request_or_403(db, request_id, user))
    await save_logo(cust, request_id, file)
    db.commit()
    db.refresh(cust)
    return customization_out(cust)


@router.patch("/requests/{request_id}/brief", response_model=WebsiteRequestOut)
def support_patch_request(
    request_id: RequestId, body: WebsiteRequestPatch, user: AdminDep, db: DbDep
) -> WebsiteRequestOut:
    """Support corrects what the owner sent (name, slogan, WhatsApp, colors, domain…), whatever the step. A new
    domain also moves the live site's allowed domain."""
    req = claimed_request_or_403(db, request_id, user)
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(req, field, value)
    store = store_of(db, req.pharmacy_id)
    if changes.get("custom_domain") and store.key_hash:
        store.domain = clean_domain(changes["custom_domain"])
    db.commit()
    db.refresh(req)
    return request_out(db, req)


@router.post("/requests/{request_id}/site-key", response_model=SiteKeyOut)
def create_site_key(request_id: RequestId, body: SiteKeyIn, user: AdminDep, db: DbDep) -> SiteKeyOut:
    """« Télécharger le site »: the domain where the site will live + a NEW secret key (the old one stops working).
    The key is shown once (it goes in the site's `.env`); only its hash is kept."""
    req = claimed_request_or_403(db, request_id, user)
    store = store_of(db, req.pharmacy_id)
    store.request_id = req.id
    key = new_site_key(store, clean_domain(body.domain))
    db.commit()
    return SiteKeyOut(key=key, domain=store.domain or "")


# ─── Public ─────────────────────────────────────────────────────────────────


@router.get("/public/preview/{request_id}", response_model=PublicPreviewOut)
def public_preview(request_id: RequestId, db: DbDep) -> PublicPreviewOut:
    """What the templates need, plus the pharmacy phone (WhatsApp buttons). No owner data. Unknown id = 404."""
    req = db.get(StoreWebsiteRequest, request_id)
    if req is None or req.customization is None:
        raise ApiError(404, ErrorCode.PREVIEW_NOT_FOUND, "Aperçu introuvable.")
    return preview_out(req)


def _preview_store(db: DbDep, request_id: UUID) -> Store:
    """The store of a request's pharmacy (unknown id = 404, like the preview)."""
    req = db.get(StoreWebsiteRequest, request_id)
    if req is None:
        raise ApiError(404, ErrorCode.PREVIEW_NOT_FOUND, "Aperçu introuvable.")
    return store_of(db, req.pharmacy_id)


@router.get("/public/{request_id}/summary", response_model=StoreSummary)
def public_summary(request_id: RequestId, db: DbDep) -> StoreSummary:
    """The store's home page data: ONLY this request's pharmacy (`catalog_queries`)."""
    return store_summary(db, _preview_store(db, request_id))


@router.get("/public/{request_id}/products", response_model=StoreProductsPage)
def public_products(
    request_id: RequestId,
    db: DbDep,
    category: Annotated[str | None, Query(max_length=200)] = None,
    search: Annotated[str | None, Query(max_length=200)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=60)] = 24,
) -> StoreProductsPage:
    """The catalogue page: in stock first; a category and / or a search narrow it."""
    return store_products(db, _preview_store(db, request_id), category=category, search=search, page=page, limit=limit)


@router.get("/public/{request_id}/products/{product_id}", response_model=StoreProductDetail)
def public_product(request_id: RequestId, product_id: Annotated[int, PathParam(ge=1)], db: DbDep) -> StoreProductDetail:
    """One product of this pharmacy (another pharmacy's = 404)."""
    product = store_product(db, _preview_store(db, request_id), product_id)
    if product is None:
        raise ApiError(404, ErrorCode.PRODUCT_NOT_FOUND, "Ce produit n'est pas dans votre pharmacie.")
    return product


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
