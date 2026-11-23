"""A pharmacy's online store data: ONLY that pharmacy's shelf (its last stock import), as a customer may see it, with
the owner's choices (`stores` + `store_products` + `store_packs`).

A showcase, not a shop: no cart, no payment; « Commander » opens WhatsApp. Every product type shows (medicines too).

| Field | From |
|---|---|
| name, laboratoire, PPV | the owner's « Modifier » (`pharmacy_product_edits`), else the catalogue |
| promo price | the owner's (`store_products.promo_price`) |
| category | the shop's (`product_infos`: « Soins visage »), else Sobrus' without its margin: « Parapharmacie (33.330%) » → « Parapharmacie » |
| photo, description | `product_infos` (same PID, else a same barcode) |
| in stock | `current_stock > 0` |

The public site never sees: hidden products, categories the owner turned off, hidden packs; nor PPH, margins,
quantities, suppliers. The owner's page (`owner_*` below) sees every product of the shelf with its settings.
"""

from __future__ import annotations

from sqlalchemy import Select, and_, case, func, select
from sqlalchemy.orm import Session

from app.core.models import (
    Medicament,
    Pharmacy,
    PharmacyProductEdit,
    PharmacyStock,
    ProductInfo,
    Store,
    StorePack,
    StoreProduct as StoreProductRow,
)
from app.core.search import product_search_clauses, tokenize_search
from app.ledger.schemas import paginate
from app.products.product_queries import _info_of_product
from app.store_website.schemas import (
    CategoryChoice,
    OwnerProduct,
    OwnerProductsPage,
    PackItemOut,
    StorePackOut,
    StoreProduct,
    StoreProductDetail,
    StoreProductsPage,
    StoreSummary,
)

FEATURED = 12
BRANDS = 10
RELATED = 4
PROMOS = 12

e = PharmacyProductEdit
sp = StoreProductRow
NAME = func.coalesce(e.product, Medicament.product)
LAB = func.coalesce(e.laboratoire, Medicament.laboratoire)
PPV = func.coalesce(e.ppv, Medicament.ppv)
SOBRUS_CATEGORY = func.nullif(
    func.trim(func.regexp_replace(func.coalesce(e.category, Medicament.category), r"\s*\(.*\)\s*$", "")), ""
)
CATEGORY = func.coalesce(_info_of_product(ProductInfo.category).scalar_subquery(), SOBRUS_CATEGORY)
PHOTO = _info_of_product(ProductInfo.images[0].as_string()).scalar_subquery()
IN_STOCK = PharmacyStock.current_stock > 0
HIDDEN = func.coalesce(sp.hidden, False)

ROW = (Medicament.id, NAME, LAB, CATEGORY, PPV, sp.promo_price, IN_STOCK, PHOTO)


def store_of(db: Session, pharmacy_id: int) -> Store:
    """The pharmacy's store (made on first use: one per pharmacy). The caller commits."""
    store = db.query(Store).filter_by(pharmacy_id=pharmacy_id).first()
    if store is None:
        store = Store(pharmacy_id=pharmacy_id)
        db.add(store)
        db.flush()
    return store


def _shelf(store: Store, *columns, public: bool = True) -> Select:
    """`columns` for each product of the pharmacy's stock (+ its edits, + the owner's store choice). `public`: only
    what the site may show (not hidden, in a shown category)."""
    q = (
        select(*columns)
        .select_from(PharmacyStock)
        .join(Medicament, Medicament.id == PharmacyStock.medicament_id)
        .outerjoin(e, and_(e.pharmacy_id == store.pharmacy_id, e.medicament_id == Medicament.id))
        .outerjoin(sp, and_(sp.store_id == store.id, sp.medicament_id == Medicament.id))
        .where(PharmacyStock.pharmacy_id == store.pharmacy_id)
    )
    if public:
        q = q.where(HIDDEN.is_(False))
        if store.shown_categories is not None:
            q = q.where(CATEGORY.in_(store.shown_categories))
    return q


def _product(row) -> StoreProduct:
    med_id, name, lab, category, ppv, promo, in_stock, photo = row[:8]
    return StoreProduct(
        id=med_id,
        name=name,
        laboratoire=lab,
        category=category,
        ppv=ppv,
        promo_price=promo,
        in_stock=bool(in_stock),
        photo=photo,
    )


def _filtered(q: Select, *, category: str | None, search: str | None) -> Select:
    if category:
        q = q.where(CATEGORY == category)
    tokens = tokenize_search(search or "")
    if tokens:
        q = q.where(*product_search_clauses(tokens, [LAB]))
    return q


def _page(db: Session, q: Select, page: int, limit: int):
    total = db.execute(select(func.count()).select_from(q.subquery())).scalar() or 0
    rows = db.execute(q.order_by(IN_STOCK.desc(), NAME).offset((page - 1) * limit).limit(limit)).all()
    return rows, paginate(total, page, limit)


def packs_of(db: Session, store: Store, *, public: bool = True) -> list[StorePackOut]:
    """The owner's packs, newest first, with their products (public: not hidden)."""
    q = db.query(StorePack).filter(StorePack.store_id == store.id).order_by(StorePack.created_at.desc())
    if public:
        q = q.filter(StorePack.hidden.is_(False))
    packs = q.all()
    ids = {i.medicament_id for p in packs for i in p.items}
    products = (
        {r[0]: _product(r) for r in db.execute(_shelf(store, *ROW, public=False).where(Medicament.id.in_(ids))).all()}
        if ids
        else {}
    )
    out = []
    for pack in packs:
        items = [
            PackItemOut(product=products[i.medicament_id], quantity=i.quantity)
            for i in pack.items
            if i.medicament_id in products
        ]
        prices = [it.product.ppv * it.quantity for it in items if it.product.ppv is not None]
        out.append(
            StorePackOut(
                id=pack.id,
                name=pack.name,
                price=pack.price,
                hidden=pack.hidden,
                ppv_total=round(sum(prices), 2) if len(prices) == len(items) and items else None,
                items=items,
            )
        )
    return out


# ─── The public site ────────────────────────────────────────────────────────


def store_summary(db: Session, store: Store) -> StoreSummary:
    """The home page: the pharmacy, its shown categories (by count), its main brands, products to feature (in stock,
    with a photo first), the owner's promos and packs."""
    pharmacy = db.get(Pharmacy, store.pharmacy_id)
    cat = CATEGORY.label("cat")
    cats = db.execute(_shelf(store, cat, func.count().label("n")).group_by(cat).order_by(func.count().desc())).all()
    brands = db.execute(
        _shelf(store, LAB.label("lab"), func.count().label("n"))
        .where(LAB.isnot(None), LAB != "")
        .group_by(LAB)
        .order_by(func.count().desc())
        .limit(BRANDS)
    ).all()
    featured = db.execute(
        _shelf(store, *ROW)
        .where(IN_STOCK, PPV.isnot(None))
        .order_by(case((PHOTO.isnot(None), 0), else_=1), NAME)
        .limit(FEATURED)
    ).all()
    promos = db.execute(_shelf(store, *ROW).where(sp.promo_price.isnot(None)).order_by(NAME).limit(PROMOS)).all()
    return StoreSummary(
        pharmacy_name=pharmacy.name if pharmacy else "",
        city=pharmacy.city if pharmacy else None,
        address=pharmacy.address if pharmacy else None,
        categories=[{"name": c, "count": n} for c, n in cats if c],
        brands=[b for b, _ in brands],
        featured=[_product(r) for r in featured],
        promos=[_product(r) for r in promos],
        packs=packs_of(db, store),
    )


def store_products(
    db: Session, store: Store, *, category: str | None, search: str | None, page: int, limit: int
) -> StoreProductsPage:
    """The catalogue page: in stock first, then by name; a category and / or a search narrow it."""
    rows, pagination = _page(db, _filtered(_shelf(store, *ROW), category=category, search=search), page, limit)
    return StoreProductsPage(items=[_product(r) for r in rows], pagination=pagination)


def store_product(db: Session, store: Store, med_id: int) -> StoreProductDetail | None:
    """One product the site shows (hidden / another pharmacy's = None) + its description + others of its category."""
    description = _info_of_product(ProductInfo.description).scalar_subquery()
    row = db.execute(_shelf(store, *ROW, description).where(Medicament.id == med_id)).first()
    if row is None:
        return None
    product = _product(row)
    related = (
        db.execute(
            _shelf(store, *ROW)
            .where(CATEGORY == product.category, Medicament.id != med_id, IN_STOCK)
            .order_by(NAME)
            .limit(RELATED)
        ).all()
        if product.category
        else []
    )
    return StoreProductDetail(**product.model_dump(), description=row[-1], related=[_product(r) for r in related])


# ─── The owner's page ───────────────────────────────────────────────────────

OWNER_VIEWS = ("all", "shown", "hidden", "promo")


def owner_products(
    db: Session, store: Store, *, view: str, category: str | None, search: str | None, page: int, limit: int
) -> OwnerProductsPage:
    """Every product of the shelf with its setting. `view`: all · shown · hidden · promo."""
    base = _filtered(_shelf(store, *ROW, HIDDEN, public=False), category=category, search=search)
    q = base
    if view == "shown":
        q = q.where(HIDDEN.is_(False))
    elif view == "hidden":
        q = q.where(HIDDEN.is_(True))
    elif view == "promo":
        q = q.where(sp.promo_price.isnot(None))
    rows, pagination = _page(db, q, page, limit)
    counts = db.execute(
        select(
            func.count(),
            func.count().filter(HIDDEN.is_(True)),
            func.count().filter(sp.promo_price.isnot(None)),
        )
        .select_from(PharmacyStock)
        .join(Medicament, Medicament.id == PharmacyStock.medicament_id)
        .outerjoin(sp, and_(sp.store_id == store.id, sp.medicament_id == Medicament.id))
        .where(PharmacyStock.pharmacy_id == store.pharmacy_id)
    ).one()
    return OwnerProductsPage(
        items=[OwnerProduct(**_product(r).model_dump(), hidden=bool(r[-1])) for r in rows],
        pagination=pagination,
        counts={"all": counts[0], "hidden": counts[1], "promo": counts[2]},
    )


def owner_categories(db: Session, store: Store) -> list[CategoryChoice]:
    """Every category of the shelf, most products first, with « shown on the site » or not."""
    cat = CATEGORY.label("cat")
    rows = db.execute(
        _shelf(store, cat, func.count().label("n"), public=False).group_by(cat).order_by(func.count().desc())
    ).all()
    shown = store.shown_categories
    return [CategoryChoice(name=c, count=n, shown=shown is None or c in shown) for c, n in rows if c]


def on_shelf(db: Session, store: Store, med_ids: list[int]) -> set[int]:
    """Which of these products are on the pharmacy's shelf (the others: refused)."""
    if not med_ids:
        return set()
    return {
        i
        for (i,) in db.execute(
            select(PharmacyStock.medicament_id).where(
                PharmacyStock.pharmacy_id == store.pharmacy_id, PharmacyStock.medicament_id.in_(med_ids)
            )
        ).all()
    }
