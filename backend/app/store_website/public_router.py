"""/v1/store-public — what a downloaded store site reads, live (the owner's and Support's changes show at once).

Every call: `Authorization: Bearer <key>` (the site's `.env`) AND sent from the store's domain (`Origin`). The key
gives ONE store, so ONLY its pharmacy's data. A deleted store or a new key = the old site gets 401.
CORS for these paths: `app/store_website/site_cors.py`."""

from __future__ import annotations

from typing import Annotated
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, Header, Path, Query

from app.core.database import DbDep
from app.core.errors import ApiError, ErrorCode
from app.core.models import Store, StoreWebsiteRequest
from app.store_website.catalog_queries import store_product, store_products, store_summary
from app.store_website.schemas import PublicPreviewOut, StoreProductDetail, StoreProductsPage, StoreSummary
from app.store_website.service import key_hash, preview_out

router = APIRouter(prefix="/store-public", tags=["store-public"])


def _site_store(
    db: DbDep,
    authorization: Annotated[str | None, Header()] = None,
    origin: Annotated[str | None, Header()] = None,
) -> Store:
    """The store of the key, only from its domain (« www. » too)."""
    key = (authorization or "").removeprefix("Bearer ").strip()
    store = db.query(Store).filter(Store.key_hash == key_hash(key)).first() if key else None
    if store is None:
        raise ApiError(401, ErrorCode.SITE_KEY_INVALID, "Clé du site invalide.")
    host = (urlparse(origin).netloc if origin else "").lower().removeprefix("www.")
    if not store.domain or host != store.domain:
        raise ApiError(403, ErrorCode.SITE_ORIGIN_REFUSED, "Ce site n'est pas autorisé.")
    return store


SiteStore = Annotated[Store, Depends(_site_store)]


@router.get("/customization", response_model=PublicPreviewOut)
def site_customization(store: SiteStore, db: DbDep) -> PublicPreviewOut:
    """The model, colors, logo, sections, name, WhatsApp number (Support's editor + the owner's request)."""
    req = db.get(StoreWebsiteRequest, store.request_id) if store.request_id else None
    if req is None or req.customization is None:
        raise ApiError(404, ErrorCode.PREVIEW_NOT_FOUND, "Aperçu introuvable.")
    return preview_out(req)


@router.get("/summary", response_model=StoreSummary)
def site_summary(store: SiteStore, db: DbDep) -> StoreSummary:
    return store_summary(db, store)


@router.get("/products", response_model=StoreProductsPage)
def site_products(
    store: SiteStore,
    db: DbDep,
    category: Annotated[str | None, Query(max_length=200)] = None,
    search: Annotated[str | None, Query(max_length=200)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=60)] = 24,
) -> StoreProductsPage:
    return store_products(db, store, category=category, search=search, page=page, limit=limit)


@router.get("/products/{product_id}", response_model=StoreProductDetail)
def site_product(store: SiteStore, db: DbDep, product_id: Annotated[int, Path(ge=1)]) -> StoreProductDetail:
    product = store_product(db, store, product_id)
    if product is None:
        raise ApiError(404, ErrorCode.PRODUCT_NOT_FOUND, "Ce produit n'est pas dans votre pharmacie.")
    return product
