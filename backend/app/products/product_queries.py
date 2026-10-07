"""« Produits » SQL. The pharmacy's products = every product in its last stock import,
sold or bought by it (any date). Exclusions do not apply here (Comptabilité only).

Photos + description: the `product_infos` row with the same PID, else with a same barcode
(matched when shown, so a product imported later finds its photos too).

« Vendus 12 mois », stock and average PU use the Stock page's rules, so both pages
always show the same numbers (`stock_queries`)."""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import and_, case, func, literal, or_, select, union, union_all
from sqlalchemy.orm import Session

from app.analytics.query_parts import (
    PRICED_PURCHASE,
    avg_pu_expr,
    avg_pu_subquery,
    ca_line,
    category_filter,
    pharma_expr,
)
from app.analytics.stock_queries import (
    _stock_max_for,
    _stock_min_for,
    _stock_status_from_coverage,
    _vente_units_subq,
    stock_abcd_window,
)
from app.core.models import Achat, ImportBatch, Medicament, PharmacyStock, ProductInfo, Vente
from app.core.search import product_search_clauses, supplier_search_clauses, tokenize_search
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
        Achat.total,
        Achat.import_batch_id,
    ).where(Achat.pharmacy_id == pharmacy_id, Achat.medicament_id == med_id)
    ventes = select(
        literal("vente").label("kind"),
        Vente.id,
        Vente.date.label("date"),
        (-Vente.quantity).label("quantity"),
        Vente.unit_price,
        Vente.transaction_ref.label("document"),
        Vente.client.label("party"),
        Vente.total,
        Vente.import_batch_id,
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


# ─── Statistiques ────────────────────────────────────────────────────────────


def product_stats(db: Session, pharmacy_id: int, med_id: int) -> dict | None:
    """« Ventes et achats par mois » + the Statistiques tab; None = not one of the pharmacy's
    products. Sales and purchases are summed per month in SQL (one product: a few hundred rows)."""
    if db.get(Medicament, med_id) is None or not _is_linked(db, pharmacy_id, med_id):
        return None
    today = pharmacy_today()
    start, end = stock_abcd_window(today)
    sales_from, sales_to = start.isoformat(), end.isoformat()

    month = func.substr(Vente.date, 1, 7)
    by_month = (
        db.query(
            month.label("month"),
            func.sum(Vente.quantity).label("units"),
            func.sum(ca_line()).label("ca"),
        )
        .join(Medicament, Medicament.id == Vente.medicament_id)
        .filter(Vente.pharmacy_id == pharmacy_id, Vente.medicament_id == med_id, Vente.date.isnot(None))
        .group_by(month)
        .all()
    )
    sales = {r.month: (float(r.units or 0), float(r.ca or 0)) for r in by_month}
    first_sale, last_sale = (
        db.query(func.min(Vente.date), func.max(Vente.date))
        .filter(Vente.pharmacy_id == pharmacy_id, Vente.medicament_id == med_id)
        .one()
    )
    units_30d = (
        db.query(func.coalesce(func.sum(Vente.quantity), 0))
        .filter(
            Vente.pharmacy_id == pharmacy_id,
            Vente.medicament_id == med_id,
            Vente.date >= (today - timedelta(days=29)).isoformat(),
            Vente.date <= today.isoformat(),
        )
        .scalar()
    )
    achat_month = func.substr(Achat.delivery_date, 1, 7)
    purchases = {
        r.month: (float(r.units or 0), float(r.amount or 0))
        for r in db.query(
            achat_month.label("month"),
            func.sum(Achat.quantity).label("units"),
            func.sum(Achat.total).label("amount"),
        )
        .filter(Achat.pharmacy_id == pharmacy_id, Achat.medicament_id == med_id, Achat.delivery_date.isnot(None))
        .group_by(achat_month)
        .all()
    }

    window = [m for m in sales if sales_from[:7] <= m <= sales_to[:7]]
    units_12m = sum(sales[m][0] for m in window)
    months_in_window = (end.year - start.year) * 12 + end.month - start.month + 1
    best = max(sales.items(), key=lambda kv: (kv[1][0], kv[0]), default=None)

    # Per year: units sold / bought each month (January first), CA and amount bought.
    years = sorted({int(m[:4]) for m in [*sales, *purchases]}, reverse=True)
    sold = {y: [0.0] * 12 for y in years}
    bought = {y: [0.0] * 12 for y in years}
    ca = dict.fromkeys(years, 0.0)
    amount = dict.fromkeys(years, 0.0)
    for m, (units, line_ca) in sales.items():
        sold[int(m[:4])][int(m[5:7]) - 1] += units
        ca[int(m[:4])] += line_ca
    for m, (units, line_amount) in purchases.items():
        bought[int(m[:4])][int(m[5:7]) - 1] += units
        amount[int(m[:4])] += line_amount

    return {
        "sales_from": sales_from,
        "sales_to": sales_to,
        "units_30d": float(units_30d or 0),
        "units_12m": units_12m,
        "ca_12m": round(sum(sales[m][1] for m in window), 2),
        "avg_per_month": round(units_12m / 12, 2),
        "avg_per_day": round(units_12m / ((end - start).days + 1), 2),
        "months_without_sale": months_in_window - len(window),
        "first_sale": first_sale,
        "last_sale": last_sale,
        "best_month": {"month": best[0], "units": best[1][0]} if best and best[1][0] > 0 else None,
        "monthly": [
            {
                "year": y,
                "sold": sold[y],
                "sold_total": sum(sold[y]),
                "bought": bought[y],
                "bought_total": sum(bought[y]),
            }
            for y in years
        ],
        "yearly": [
            {
                "year": y,
                "units_sold": sum(sold[y]),
                "ca": round(ca[y], 2),
                "units_bought": sum(bought[y]),
                "amount_bought": round(amount[y], 2),
            }
            for y in years
        ],
    }


# ─── Mouvements ──────────────────────────────────────────────────────────────


def product_movements(
    db: Session,
    pharmacy_id: int,
    med_id: int,
    *,
    date_from: str | None,
    date_to: str | None,
    kind: str,
    search: str | None,
    page: int,
    limit: int,
    export: bool,
) -> dict | None:
    """Every purchase / sale line of one product, newest first (same order as « Mouvements
    récents »), + the file each came from; None = not one of the pharmacy's products."""
    if db.get(Medicament, med_id) is None or not _is_linked(db, pharmacy_id, med_id):
        return None
    moves = _movements(pharmacy_id, med_id)
    where = []
    if date_from:
        where.append(moves.c.date >= date_from)
    if date_to:
        where.append(moves.c.date <= date_to)
    if kind in ("achat", "vente"):
        where.append(moves.c.kind == kind)
    where += supplier_search_clauses(tokenize_search(search), [moves.c.document, moves.c.party])

    totals = db.execute(
        select(
            func.count(),
            func.coalesce(func.sum(case((moves.c.kind == "achat", moves.c.quantity))), 0),
            func.coalesce(func.sum(case((moves.c.kind == "vente", -moves.c.quantity))), 0),
        ).where(*where)
    ).one()
    q = (
        select(moves, ImportBatch.filename)
        .outerjoin(ImportBatch, ImportBatch.id == moves.c.import_batch_id)
        .where(*where)
        .order_by(*_newest_first(moves))
    )
    rows = db.execute(q if export else q.offset((page - 1) * limit).limit(limit)).all()
    total = int(totals[0])
    return {
        "data": [
            {
                "kind": r.kind,
                "date": r.date,
                "quantity": r.quantity,
                "unit_price": r.unit_price,
                "total": r.total,
                "document": r.document,
                "party": r.party,
                "filename": r.filename,
            }
            for r in rows
        ],
        "pagination": paginate(total, 1 if export else page, max(total, 1) if export else limit),
        "units_bought": float(totals[1]),
        "units_sold": float(totals[2]),
    }
