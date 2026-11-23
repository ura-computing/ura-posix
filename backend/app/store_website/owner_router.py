"""/v1/store-website/my-store — the owner's online-store settings, at any time (the site live too): which products
show, promo prices, packs, which categories show. Owner only; ONLY their pharmacy's store (`catalog_queries`)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path, Query

from app.core.database import DbDep
from app.core.errors import ApiError, ErrorCode
from app.core.models import StorePack, StorePackItem, StoreProduct
from app.core.permissions import OwnerDep
from app.store_website.catalog_queries import (
    OWNER_VIEWS,
    on_shelf,
    owner_categories,
    owner_products,
    packs_of,
    store_of,
)
from app.store_website.schemas import (
    CategoryChoice,
    OwnerProductPatch,
    OwnerProductsPage,
    PackIn,
    ShownCategoriesIn,
    StorePackOut,
)

router = APIRouter(prefix="/store-website/my-store", tags=["store-website"])

PackId = Annotated[int, Path(ge=1)]


@router.get("/products", response_model=OwnerProductsPage)
def list_products(
    pharmacy_id: OwnerDep,
    db: DbDep,
    view: Annotated[str, Query(pattern="^(" + "|".join(OWNER_VIEWS) + ")$")] = "all",
    category: Annotated[str | None, Query(max_length=200)] = None,
    search: Annotated[str | None, Query(max_length=200)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
) -> OwnerProductsPage:
    """« Produits »: every product of the shelf, shown or hidden, with its promo."""
    store = store_of(db, pharmacy_id)
    db.commit()
    return owner_products(db, store, view=view, category=category, search=search, page=page, limit=limit)


@router.patch("/products/{product_id}", status_code=204)
def set_product(
    product_id: Annotated[int, Path(ge=1)], body: OwnerProductPatch, pharmacy_id: OwnerDep, db: DbDep
) -> None:
    """Show / hide a product, set or remove its promo price."""
    store = store_of(db, pharmacy_id)
    if product_id not in on_shelf(db, store, [product_id]):
        raise ApiError(404, ErrorCode.PRODUCT_NOT_FOUND, "Ce produit n'est pas dans votre pharmacie.")
    row = db.query(StoreProduct).filter_by(store_id=store.id, medicament_id=product_id).first()
    if row is None:
        row = StoreProduct(store_id=store.id, medicament_id=product_id, hidden=False)
        db.add(row)
    if "hidden" in body.model_fields_set and body.hidden is not None:
        row.hidden = body.hidden
    if "promo_price" in body.model_fields_set:
        row.promo_price = body.promo_price
    db.commit()


@router.get("/categories", response_model=list[CategoryChoice])
def list_categories(pharmacy_id: OwnerDep, db: DbDep) -> list[CategoryChoice]:
    """« Catégories »: every category of the shelf, shown on the site or not."""
    store = store_of(db, pharmacy_id)
    db.commit()
    return owner_categories(db, store)


@router.put("/categories", response_model=list[CategoryChoice])
def set_categories(body: ShownCategoriesIn, pharmacy_id: OwnerDep, db: DbDep) -> list[CategoryChoice]:
    """The categories the site shows (null = all)."""
    store = store_of(db, pharmacy_id)
    store.shown_categories = body.shown
    db.commit()
    return owner_categories(db, store)


@router.get("/packs", response_model=list[StorePackOut])
def list_packs(pharmacy_id: OwnerDep, db: DbDep) -> list[StorePackOut]:
    store = store_of(db, pharmacy_id)
    db.commit()
    return packs_of(db, store, public=False)


def _save_pack(db: DbDep, pack: StorePack, body: PackIn, store) -> None:
    ids = [i.product_id for i in body.items]
    if set(ids) - on_shelf(db, store, ids):
        raise ApiError(404, ErrorCode.PRODUCT_NOT_FOUND, "Ce produit n'est pas dans votre pharmacie.")
    pack.name, pack.price, pack.hidden = body.name.strip(), body.price, body.hidden
    pack.items = [StorePackItem(medicament_id=i.product_id, quantity=i.quantity) for i in body.items]


@router.post("/packs", response_model=list[StorePackOut], status_code=201)
def create_pack(body: PackIn, pharmacy_id: OwnerDep, db: DbDep) -> list[StorePackOut]:
    """« Créer un pack »: several products at one price."""
    store = store_of(db, pharmacy_id)
    pack = StorePack(store_id=store.id)
    _save_pack(db, pack, body, store)
    db.add(pack)
    db.commit()
    return packs_of(db, store, public=False)


@router.put("/packs/{pack_id}", response_model=list[StorePackOut])
def update_pack(pack_id: PackId, body: PackIn, pharmacy_id: OwnerDep, db: DbDep) -> list[StorePackOut]:
    store = store_of(db, pharmacy_id)
    pack = db.query(StorePack).filter_by(id=pack_id, store_id=store.id).first()
    if pack is None:
        raise ApiError(404, ErrorCode.PACK_NOT_FOUND, "Pack introuvable.")
    _save_pack(db, pack, body, store)
    db.commit()
    return packs_of(db, store, public=False)


@router.delete("/packs/{pack_id}", status_code=204)
def delete_pack(pack_id: PackId, pharmacy_id: OwnerDep, db: DbDep) -> None:
    store = store_of(db, pharmacy_id)
    db.query(StorePack).filter_by(id=pack_id, store_id=store.id).delete()
    db.commit()
