"""« Produits » SQL. The pharmacy's products = every product in its last stock import,
sold or bought by it (any date). Exclusions do not apply here (Comptabilité only).

Photos + description: the `product_infos` row with the same PID, else with a same barcode
(matched when shown, so a product imported later finds its photos too).

« Vendus 12 mois », stock and average PU use the Stock page's rules, so both pages
always show the same numbers (`stock_queries`)."""

from __future__ import annotations

from sqlalchemy import and_, case, func, literal, or_, select, union, union_all
from sqlalchemy.orm import Session

from app.analytics.query_parts import PRICED_PURCHASE, avg_pu_expr, avg_pu_subquery, category_filter, pharma_expr
from app.analytics.stock_queries import (
    _stock_max_for,
    _stock_min_for,
    _stock_status_from_coverage,
    _vente_units_subq,
    stock_abcd_window,
)
from app.core.models import Achat, Medicament, PharmacyStock, ProductInfo, Vente
from app.core.search import product_search_clauses, tokenize_search
from app.core.utils import today as pharmacy_today
from app.ledger.schemas import paginate


def _linked_ids(pharmacy_id: int):
    """Subquery: one row per product in the pharmacy's stock, sales or purchases."""
    return union(
        select(PharmacyStock.medicament_id).where(PharmacyStock.pharmacy_id == pharmacy_id),
        select(Vente.medicament_id).where(Vente.pharmacy_id == pharmacy_id, Vente.medicament_id.isnot(None)),
        select(Achat.medicament_id).where(Achat.pharmacy_id == pharmacy_id, Achat.medicament_id.isnot(None)),
    ).subquery()


def _info_of_product(*columns):
    """Correlated SELECT of `columns` from the outer Medicament's `product_infos` row:
    same PID first, then a same barcode (either column), then the file's priority."""
    codes = [Medicament.barcode1, Medicament.barcode2]
    return (
        select(*columns)
        .where(or_(ProductInfo.pid == Medicament.pid, ProductInfo.barcode1.in_(codes), ProductInfo.barcode2.in_(codes)))
        .order_by(case((ProductInfo.pid == Medicament.pid, 0), else_=1), ProductInfo.id)
        .limit(1)
        .correlate(Medicament)
    )


def _photos(db: Session, ids: list[int]) -> dict[int, str | None]:
    """First photo URL per product id: only for the rows shown (one match per row)."""
    if not ids:
        return {}
    photo = _info_of_product(ProductInfo.images[0].as_string()).scalar_subquery()
    return dict(db.query(Medicament.id, photo).filter(Medicament.id.in_(ids)).all())


def list_products(
    db: Session,
    pharmacy_id: int,
    *,
    search: str | None,
    category_type: str,
    sort_by: str | None,
    sort_order: str,
    page: int,
    limit: int,
    export: bool,
) -> dict:
    sales_from, sales_to = (d.isoformat() for d in stock_abcd_window(pharmacy_today()))
    linked = _linked_ids(pharmacy_id)
    sold = _vente_units_subq(pharmacy_id, sales_from, sales_to, db)
    stock = (
        select(PharmacyStock.medicament_id, PharmacyStock.current_stock)
        .where(PharmacyStock.pharmacy_id == pharmacy_id)
        .subquery()
    )
    avg_pu = avg_pu_subquery(db, Achat.pharmacy_id == pharmacy_id, Achat.medicament_id.isnot(None))

    units = func.coalesce(sold.c.units, 0)
    marge = case(
        (and_(Medicament.ppv > 0, avg_pu.c.avg_pu.isnot(None)), (1.0 - avg_pu.c.avg_pu / Medicament.ppv) * 100.0)
    )
    q = (
        db.query(
            Medicament.id,
            Medicament.pid,
            Medicament.product,
            Medicament.laboratoire,
            Medicament.category,
            pharma_expr().label("is_pharma"),
            stock.c.current_stock,
            units.label("units_sold_12m"),
            Medicament.ppv,
            avg_pu.c.avg_pu,
            marge.label("marge_pct"),
        )
        .join(linked, linked.c.medicament_id == Medicament.id)
        .outerjoin(sold, sold.c.medicament_id == Medicament.id)
        .outerjoin(stock, stock.c.medicament_id == Medicament.id)
        .outerjoin(avg_pu, avg_pu.c.medicament_id == Medicament.id)
    )
    for clause in product_search_clauses(tokenize_search(search), [Medicament.laboratoire]):
        q = q.filter(clause)
    q = q.filter(*category_filter(category_type))
    total = q.count()

    # Whitelist (no SQL from the query string). Empty values last, then by name.
    columns = {
        "product": Medicament.product,
        "laboratoire": Medicament.laboratoire,
        "category": Medicament.category,
        "current_stock": stock.c.current_stock,
        "units_sold_12m": units,
        "ppv": Medicament.ppv,
        "marge_pct": marge,
    }
    column = columns.get(sort_by or "", Medicament.product)
    ordered = column.desc() if sort_order == "desc" else column.asc()
    q = q.order_by(ordered.nullslast(), Medicament.product, Medicament.id)
    rows = q.all() if export else q.offset((page - 1) * limit).limit(limit).all()
    photos = {} if export else _photos(db, [r.id for r in rows])  # the Excel file has no photo

    return {
        "data": [
            {
                "id": r.id,
                "pid": r.pid,
                "product": r.product,
                "laboratoire": r.laboratoire,
                "category": r.category,
                "category_type": "pharmacie" if r.is_pharma else "parapharmacie",
                "current_stock": r.current_stock,
                "units_sold_12m": int(r.units_sold_12m or 0),
                "ppv": round(float(r.ppv), 2) if r.ppv is not None else None,
                "avg_pu": round(float(r.avg_pu), 4) if r.avg_pu is not None else None,
                "marge_pct": round(float(r.marge_pct), 2) if r.marge_pct is not None else None,
                "photo": photos.get(r.id),
            }
            for r in rows
        ],
        "pagination": paginate(total, 1 if export else page, max(total, 1) if export else limit),
        "sales_from": sales_from,
        "sales_to": sales_to,
    }


# ─── Product sheet ───────────────────────────────────────────────────────────


def _is_linked(db: Session, pharmacy_id: int, med_id: int) -> bool:
    """In the pharmacy's stock, sales or purchases: else its sheet is « not found »."""
    return any(
        db.query(model.id).filter(model.pharmacy_id == pharmacy_id, model.medicament_id == med_id).first() is not None
        for model in (PharmacyStock, Vente, Achat)
    )


def _movements(pharmacy_id: int, med_id: int):
    """Subquery: every purchase (+qty) and sale (−qty) line of one product in one pharmacy."""
    achats = select(
        literal("achat").label("kind"),
        Achat.id,
        Achat.delivery_date.label("date"),
        Achat.quantity.label("quantity"),
        Achat.unit_price,
        Achat.delivery_ref.label("document"),
        Achat.supplier.label("party"),
    ).where(Achat.pharmacy_id == pharmacy_id, Achat.medicament_id == med_id)
    ventes = select(
        literal("vente").label("kind"),
        Vente.id,
        Vente.date.label("date"),
        (-Vente.quantity).label("quantity"),
        Vente.unit_price,
        Vente.transaction_ref.label("document"),
        Vente.client.label("party"),
    ).where(Vente.pharmacy_id == pharmacy_id, Vente.medicament_id == med_id)
    return union_all(achats, ventes).subquery()


def _newest_first(moves):
    """Newest day first; same day: sales before purchases, then the latest line."""
    return (moves.c.date.desc().nullslast(), moves.c.kind.desc(), moves.c.id.desc())


def product_sheet(db: Session, pharmacy_id: int, med_id: int) -> dict | None:
    """Everything the « Général » and « Codes » tabs show; None = not one of the pharmacy's products."""
    med = db.get(Medicament, med_id)
    if med is None or not _is_linked(db, pharmacy_id, med_id):
        return None
    is_pharma = db.query(pharma_expr()).filter(Medicament.id == med_id).scalar()
    info = db.scalars(_info_of_product(ProductInfo).where(Medicament.id == med_id)).first()
    stock = db.query(PharmacyStock).filter_by(pharmacy_id=pharmacy_id, medicament_id=med_id).first()

    start, end = stock_abcd_window(pharmacy_today())
    units = (
        db.query(func.coalesce(func.sum(Vente.quantity), 0))
        .filter(
            Vente.pharmacy_id == pharmacy_id,
            Vente.medicament_id == med_id,
            Vente.date >= start.isoformat(),
            Vente.date <= end.isoformat(),
        )
        .scalar()
    )
    units = int(units or 0)
    current = stock.current_stock if stock else None
    priced = (Achat.pharmacy_id == pharmacy_id, Achat.medicament_id == med_id, *PRICED_PURCHASE)
    avg_pu = db.query(avg_pu_expr()).filter(*priced).scalar()
    last = db.query(Achat.unit_price, Achat.delivery_date).filter(*priced)
    last = last.order_by(Achat.delivery_date.desc().nullslast(), Achat.id.desc()).first()
    moves = _movements(pharmacy_id, med_id)
    recent = db.execute(select(moves).order_by(*_newest_first(moves)).limit(10)).all()

    return {
        "id": med.id,
        "pid": med.pid,
        "product": med.product,
        "laboratoire": med.laboratoire,
        "category": med.category,
        "category_type": "pharmacie" if is_pharma else "parapharmacie",
        "tva": med.tva,
        "barcode1": med.barcode1,
        "barcode2": med.barcode2,
        "info": (
            {
                "brand": info.brand,
                "category": info.category,
                "images": info.images,
                "description": info.description,
                "details": info.details,
                "source_url": info.source_url,
            }
            if info
            else None
        ),
        "prices": {
            "ppv": round(med.ppv, 2) if med.ppv is not None else None,
            "pph": round(med.pph, 2) if med.pph is not None else None,
            "avg_pu": round(float(avg_pu), 4) if avg_pu is not None else None,
            "last_pu": round(last.unit_price, 4) if last else None,
            "last_pu_date": last.delivery_date if last else None,
            "marge_pct": (
                round((1 - float(avg_pu) / med.ppv) * 100, 2)
                if avg_pu is not None and med.ppv and med.ppv > 0
                else None
            ),
        },
        "stock": {
            "current_stock": current,
            "stock_min": _stock_min_for(units),
            "stock_max": _stock_max_for(units),
            "units_sold_12m": units,
            "sales_from": start.isoformat(),
            "sales_to": end.isoformat(),
            "coverage_days": round(current * 365 / units)
            if current is not None and current >= 0 and units > 0
            else None,
            "status": _stock_status_from_coverage(current, units),
            "expiry_date": stock.expiry_date.isoformat() if stock and stock.expiry_date else None,
            "zone": (stock.zone if stock and stock.zone else None) or med.zone,
        },
        "recent_movements": [
            {
                "kind": m.kind,
                "date": m.date,
                "quantity": m.quantity,
                "unit_price": m.unit_price,
                "document": m.document,
                "party": m.party,
            }
            for m in recent
        ],
    }
