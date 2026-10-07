"""« Produits » SQL. The pharmacy's products = every product in its last stock import,
sold or bought by it (any date). Exclusions do not apply here (Comptabilité only).

The owner's edits (`pharmacy_product_edits`) replace the imported values in « Produits »
only; every other page keeps the imported ones.

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
    pharma_expr,
)
from app.analytics.stock_queries import (
    _stock_max_for,
    _stock_min_for,
    _stock_status_from_coverage,
    _vente_units_subq,
    stock_abcd_window,
)
from app.core.errors import ApiError, ErrorCode
from app.core.models import (
    Achat,
    ImportBatch,
    Medicament,
    PharmacyProductEdit,
    PharmacyStock,
    ProductInfo,
    Vente,
)
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

    # Shown = the owner's value when he edited it (« Modifier »), else the imported one.
    e = PharmacyProductEdit
    product = func.coalesce(e.product, Medicament.product)
    laboratoire = func.coalesce(e.laboratoire, Medicament.laboratoire)
    category = func.coalesce(e.category, Medicament.category)
    is_pharma = pharma_expr()  # the catalogue's type: the owner can't change it
    current_stock = func.coalesce(e.current_stock, stock.c.current_stock)
    ppv = func.coalesce(e.ppv, Medicament.ppv)
    units = func.coalesce(sold.c.units, 0)
    marge = case((and_(ppv > 0, avg_pu.c.avg_pu.isnot(None)), (1.0 - avg_pu.c.avg_pu / ppv) * 100.0))
    q = (
        db.query(
            Medicament.id,
            Medicament.pid,
            product.label("product"),
            laboratoire.label("laboratoire"),
            category.label("category"),
            is_pharma.label("is_pharma"),
            current_stock.label("current_stock"),
            units.label("units_sold_12m"),
            ppv.label("ppv"),
            avg_pu.c.avg_pu,
            marge.label("marge_pct"),
        )
        .join(linked, linked.c.medicament_id == Medicament.id)
        .outerjoin(sold, sold.c.medicament_id == Medicament.id)
        .outerjoin(stock, stock.c.medicament_id == Medicament.id)
        .outerjoin(avg_pu, avg_pu.c.medicament_id == Medicament.id)
        .outerjoin(e, and_(e.pharmacy_id == pharmacy_id, e.medicament_id == Medicament.id))
    )
    # Imported name / codes, and the owner's ones.
    extra = [Medicament.laboratoire, e.product, e.laboratoire, e.barcode1, e.barcode2]
    for clause in product_search_clauses(tokenize_search(search), extra):
        q = q.filter(clause)
    if category_type in ("pharmacie", "parapharmacie"):
        q = q.filter(is_pharma == (category_type == "pharmacie"))
    total = q.count()

    # Whitelist (no SQL from the query string). Empty values last, then by name.
    columns = {
        "product": product,
        "laboratoire": laboratoire,
        "category": category,
        "current_stock": current_stock,
        "units_sold_12m": units,
        "ppv": ppv,
        "marge_pct": marge,
    }
    column = columns.get(sort_by or "", product)
    ordered = column.desc() if sort_order == "desc" else column.asc()
    q = q.order_by(ordered.nullslast(), product, Medicament.id)
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


# Fields the owner can change (« Modifier »), in `pharmacy_product_edits`. Not the type
# (pharmacie / parapharmacie): it stays the catalogue's, in both directions.
EDITABLE_FIELDS = (
    "product",
    "laboratoire",
    "category",
    "tva",
    "ppv",
    "pph",
    "zone",
    "current_stock",
    "stock_min",
    "stock_max",
    "expiry_date",
    "barcode1",
    "barcode2",
    "description",
)


def _imported_values(db: Session, pharmacy_id: int, med: Medicament) -> tuple[dict, dict]:
    """(imported value of every editable field, what else the sheet needs): the values the
    imports and the scraped catalogue give, before the owner's edits."""
    is_pharma = db.query(pharma_expr()).filter(Medicament.id == med.id).scalar()
    info = db.scalars(_info_of_product(ProductInfo).where(Medicament.id == med.id)).first()
    stock = db.query(PharmacyStock).filter_by(pharmacy_id=pharmacy_id, medicament_id=med.id).first()
    start, end = stock_abcd_window(pharmacy_today())
    units = (
        db.query(func.coalesce(func.sum(Vente.quantity), 0))
        .filter(
            Vente.pharmacy_id == pharmacy_id,
            Vente.medicament_id == med.id,
            Vente.date >= start.isoformat(),
            Vente.date <= end.isoformat(),
        )
        .scalar()
    )
    units = int(units or 0)
    imported = {
        "product": med.product,
        "laboratoire": med.laboratoire,
        "category": med.category,
        "tva": med.tva,
        "ppv": round(med.ppv, 2) if med.ppv is not None else None,
        "pph": round(med.pph, 2) if med.pph is not None else None,
        "zone": (stock.zone if stock and stock.zone else None) or med.zone,
        "current_stock": stock.current_stock if stock else None,
        "stock_min": _stock_min_for(units),
        "stock_max": _stock_max_for(units),
        "expiry_date": stock.expiry_date.isoformat() if stock and stock.expiry_date else None,
        "barcode1": med.barcode1,
        "barcode2": med.barcode2,
        "description": info.description if info else None,
    }
    extra = {
        "category_type": "pharmacie" if is_pharma else "parapharmacie",
        "info": info,
        "units": units,
        "sales_from": start.isoformat(),
        "sales_to": end.isoformat(),
    }
    return imported, extra


def _edit_row(db: Session, pharmacy_id: int, med_id: int) -> PharmacyProductEdit | None:
    return db.query(PharmacyProductEdit).filter_by(pharmacy_id=pharmacy_id, medicament_id=med_id).first()


def _edited_values(edit: PharmacyProductEdit | None) -> dict:
    """{field: the owner's value} for the edited fields only (dates as ISO text)."""
    if edit is None:
        return {}
    values = {f: getattr(edit, f) for f in EDITABLE_FIELDS if getattr(edit, f) is not None}
    if "expiry_date" in values:
        values["expiry_date"] = values["expiry_date"].isoformat()
    return values


def product_sheet(db: Session, pharmacy_id: int, med_id: int) -> dict | None:
    """Everything the « Général » and « Codes » tabs show; None = not one of the pharmacy's
    products. Each editable field shows the owner's value when there is one (`imported` = the
    imported value of those fields); prices, marge, coverage follow the values shown."""
    med = db.get(Medicament, med_id)
    if med is None or not _is_linked(db, pharmacy_id, med_id):
        return None
    imported, extra = _imported_values(db, pharmacy_id, med)
    edited = _edited_values(_edit_row(db, pharmacy_id, med_id))
    v = {**imported, **edited}  # what the sheet shows
    info, units = extra["info"], extra["units"]

    priced = (Achat.pharmacy_id == pharmacy_id, Achat.medicament_id == med_id, *PRICED_PURCHASE)
    avg_pu = db.query(avg_pu_expr()).filter(*priced).scalar()
    last = db.query(Achat.unit_price, Achat.delivery_date).filter(*priced)
    last = last.order_by(Achat.delivery_date.desc().nullslast(), Achat.id.desc()).first()
    moves = _movements(pharmacy_id, med_id)
    recent = db.execute(select(moves).order_by(*_newest_first(moves)).limit(10)).all()
    current, ppv = v["current_stock"], v["ppv"]

    return {
        "id": med.id,
        "pid": med.pid,
        "product": v["product"],
        "laboratoire": v["laboratoire"],
        "category": v["category"],
        "category_type": extra["category_type"],
        "tva": v["tva"],
        "barcode1": v["barcode1"],
        "barcode2": v["barcode2"],
        "info": (
            {
                "brand": info.brand if info else None,
                "category": info.category if info else None,
                "images": info.images if info else [],
                "description": v["description"],
                "details": info.details if info else [],
            }
            if info or v["description"]
            else None
        ),
        "prices": {
            "ppv": ppv,
            "pph": v["pph"],
            "avg_pu": round(float(avg_pu), 4) if avg_pu is not None else None,
            "last_pu": round(last.unit_price, 4) if last else None,
            "last_pu_date": last.delivery_date if last else None,
            "marge_pct": round((1 - float(avg_pu) / ppv) * 100, 2) if avg_pu is not None and ppv and ppv > 0 else None,
        },
        "stock": {
            "current_stock": current,
            "stock_min": v["stock_min"],
            "stock_max": v["stock_max"],
            "units_sold_12m": units,
            "sales_from": extra["sales_from"],
            "sales_to": extra["sales_to"],
            "coverage_days": round(current * 365 / units)
            if current is not None and current >= 0 and units > 0
            else None,
            "status": _stock_status_from_coverage(current, units),
            "expiry_date": v["expiry_date"],
            "zone": v["zone"],
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
        "imported": {f: imported[f] for f in edited},
    }


def save_product_edits(db: Session, pharmacy_id: int, med_id: int, user_id: int, changes: dict) -> dict | None:
    """Owner's « Enregistrer »: `changes` = {field: new value | None}. None, or the imported
    value itself, = not edited (« Revenir à la valeur importée »). None = not the pharmacy's
    product. Raises ApiError when a typed minimum stock ends up above the maximum."""
    med = db.get(Medicament, med_id)
    if med is None or not _is_linked(db, pharmacy_id, med_id):
        return None
    imported, _ = _imported_values(db, pharmacy_id, med)
    edit = _edit_row(db, pharmacy_id, med_id) or PharmacyProductEdit(pharmacy_id=pharmacy_id, medicament_id=med_id)
    for field, value in changes.items():
        same = (
            value is None
            or value == imported[field]
            or (field == "expiry_date" and value.isoformat() == imported[field])
        )
        setattr(edit, field, None if same else value)

    # Checked only when the owner types a min / max: going back to an imported value is never blocked.
    shown = {**imported, **_edited_values(edit)}
    typed = any(changes.get(f) is not None for f in ("stock_min", "stock_max"))
    if (
        typed
        and shown["stock_min"] is not None
        and shown["stock_max"] is not None
        and shown["stock_min"] > shown["stock_max"]
    ):
        db.rollback()
        raise ApiError(400, ErrorCode.STOCK_MIN_ABOVE_MAX, "Le stock minimum ne peut pas dépasser le stock maximum.")
    if all(getattr(edit, f) is None for f in EDITABLE_FIELDS):
        if edit.id is not None:
            db.delete(edit)
    else:
        edit.updated_by = user_id
        db.add(edit)
    db.commit()
    return product_sheet(db, pharmacy_id, med_id)


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
