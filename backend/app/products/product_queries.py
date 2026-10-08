"""« Produits » SQL. The pharmacy's products = every product in its last stock import,
sold or bought by it (any date). Exclusions do not apply here (Comptabilité only).

The owner's edits (`pharmacy_product_edits`) replace the imported values in « Produits »
only; every other page keeps the imported ones.

Photos + description: the `product_infos` row with the same PID, else with a same barcode
(matched when shown, so a product imported later finds its photos too).

« Vendus 12 mois », stock and average PU use the Stock page's rules, so both pages
always show the same numbers (`stock_queries`)."""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import Float, and_, case, func, literal, or_, select, union, union_all
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
        literal(None, Float).label("discount"),
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
        Vente.discount,
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


def _last_30_days(db: Session, pharmacy_id: int, med_id: int) -> dict:
    """« Ventes / Achats 30 jours » + « Performance »: units sold / bought today and the 29 days
    before, and in the 30 days before those (the % change)."""
    today = pharmacy_today()
    since, before = (today - timedelta(days=29)).isoformat(), (today - timedelta(days=59)).isoformat()
    out = {}
    for name, model, day in (("sold", Vente, Vente.date), ("bought", Achat, Achat.delivery_date)):
        recent, older = (
            db.query(
                func.coalesce(func.sum(case((day >= since, model.quantity))), 0),
                func.coalesce(func.sum(case((day < since, model.quantity))), 0),
            )
            .filter(
                model.pharmacy_id == pharmacy_id,
                model.medicament_id == med_id,
                day >= before,
                day <= today.isoformat(),
            )
            .one()
        )
        out[name], out[f"{name}_before"] = float(recent), float(older)
    return out


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
    recent = db.execute(select(moves).order_by(*_newest_first(moves)).limit(5)).all()
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
        "last_30d": _last_30_days(db, pharmacy_id, med_id),
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


def _previous_period(date_from: date, date_to: date) -> tuple[date, date]:
    """The same number of days, just before the period (7 → the 7 days before)."""
    days = (date_to - date_from).days + 1
    return date_from - timedelta(days=days), date_from - timedelta(days=1)


def _trend_buckets(date_from: date, date_to: date) -> tuple[str, list[tuple[date, date]]]:
    """« Tendances »: one point a day up to 31 days, a week (7 days from the start) up to 92,
    else a calendar month (the first and last ones cut to the period)."""
    days = (date_to - date_from).days + 1
    if days <= 31:
        starts, unit = [date_from + timedelta(days=i) for i in range(days)], "day"
    elif days <= 92:
        starts, unit = [date_from + timedelta(days=i) for i in range(0, days, 7)], "week"
    else:
        starts, unit = [date_from], "month"
        d = date_from.replace(day=1)
        while (d := date(d.year + d.month // 12, d.month % 12 + 1, 1)) <= date_to:
            starts.append(d)
    ends = [s - timedelta(days=1) for s in starts[1:]] + [date_to]
    return unit, list(zip(starts, ends, strict=True))


def _last_12_months(today: date) -> list[str]:
    """This month and the 11 before, oldest first: ["2025-11", …, "2026-10"]."""
    n = today.year * 12 + today.month - 1
    return [f"{m // 12}-{m % 12 + 1:02d}" for m in range(n - 11, n + 1)]


def product_stats(db: Session, pharmacy_id: int, med_id: int, date_from: date, date_to: date) -> dict | None:
    """Statistiques tab; None = not one of the pharmacy's products. The period (and the one just
    before, same length) drives the KPIs, « Tendances » and « Top fournisseurs »; the charts and
    « Détail mensuel » are always the last 12 months. CA = Rapport rule (qty × PPV); marge =
    CA − units sold × average purchase price (every purchase, as on « Général ») = CA × marge %.
    One product = a few thousand lines at most: summed in Python."""
    if db.get(Medicament, med_id) is None or not _is_linked(db, pharmacy_id, med_id):
        return None
    today = pharmacy_today()
    prev_from, prev_to = _previous_period(date_from, date_to)
    months = _last_12_months(today)
    lo = min(prev_from.isoformat(), f"{months[0]}-01")
    hi = max(date_to, today).isoformat()
    sales = db.execute(
        select(Vente.date, Vente.quantity, ca_line().label("ca"), Vente.transaction_ref)
        .join(Medicament, Medicament.id == Vente.medicament_id)
        .where(Vente.pharmacy_id == pharmacy_id, Vente.medicament_id == med_id, Vente.date >= lo, Vente.date <= hi)
    ).all()
    mine = (Achat.pharmacy_id == pharmacy_id, Achat.medicament_id == med_id)
    purchases = db.execute(
        select(Achat.delivery_date.label("date"), Achat.quantity, Achat.supplier).where(
            *mine, Achat.delivery_date >= lo, Achat.delivery_date <= hi
        )
    ).all()
    avg_pu = db.query(avg_pu_expr()).filter(*mine, *PRICED_PURCHASE).scalar()

    def figures(first: str, last: str) -> dict:
        """Sums of the sale / purchase lines dated first → last (ISO text, inclusive)."""
        sold_lines = [v for v in sales if first <= v.date <= last]
        sold = sum(float(v.quantity or 0) for v in sold_lines)
        ca = sum(float(v.ca or 0) for v in sold_lines)
        return {
            "sold": sold,
            "bought": sum(float(a.quantity or 0) for a in purchases if first <= a.date <= last),
            "ca": round(ca, 2),
            "marge": round(ca - sold * float(avg_pu), 2) if avg_pu is not None else None,
            "transactions": len({v.transaction_ref for v in sold_lines if v.transaction_ref}),
        }

    unit, buckets = _trend_buckets(date_from, date_to)
    trend = []
    for first, last in buckets:
        f = figures(first.isoformat(), last.isoformat())
        trend.append({"start": first.isoformat(), "sold": f["sold"], "bought": f["bought"]})

    # « Top fournisseurs »: units bought in the period per supplier, the 3 biggest + the rest.
    by_supplier: dict[str | None, float] = {}
    for a in purchases:
        if date_from.isoformat() <= a.date <= date_to.isoformat():
            by_supplier[a.supplier] = by_supplier.get(a.supplier, 0.0) + float(a.quantity or 0)
    total = sum(by_supplier.values())
    ranked = sorted(by_supplier.items(), key=lambda kv: (-kv[1], kv[0] or ""))

    def share(supplier: str | None, quantity: float) -> dict:
        return {
            "supplier": supplier,
            "quantity": quantity,
            "pct": round(quantity / total * 100, 2) if total > 0 else None,
        }

    # « Derniers prix d'achat par fournisseur »: each supplier's latest priced purchase (any date).
    last_prices: list[dict] = []
    seen: set[str | None] = set()
    for a in db.execute(
        select(Achat.supplier, Achat.unit_price, Achat.delivery_date)
        .where(*mine, *PRICED_PURCHASE)
        .order_by(Achat.delivery_date.desc().nullslast(), Achat.id.desc())
    ):
        if a.supplier not in seen:
            seen.add(a.supplier)
            last_prices.append({"supplier": a.supplier, "unit_price": round(a.unit_price, 4), "date": a.delivery_date})
        if len(last_prices) == 5:
            break

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "previous_from": prev_from.isoformat(),
        "previous_to": prev_to.isoformat(),
        "period": figures(date_from.isoformat(), date_to.isoformat()),
        "previous": figures(prev_from.isoformat(), prev_to.isoformat()),
        "monthly": [
            {"month": m, **{k: v for k, v in figures(f"{m}-01", f"{m}-31").items() if k != "transactions"}}
            for m in months
        ],
        "trend_unit": unit,
        "trend": trend,
        "top_suppliers": [share(name, qty) for name, qty in ranked[:3]],
        "other_suppliers": share(None, sum(qty for _, qty in ranked[3:])) if len(ranked) > 3 else None,
        "last_prices": last_prices,
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
) -> dict | None:
    """Every purchase / sale line of one product, newest first (same order as « Mouvements
    récents »), with the sale's remise; None = not one of the pharmacy's products."""
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

    total = db.execute(select(func.count()).select_from(moves).where(*where)).scalar_one()
    q = select(moves).where(*where).order_by(*_newest_first(moves)).offset((page - 1) * limit).limit(limit)
    return {
        "data": [
            {
                "kind": r.kind,
                "date": r.date,
                "quantity": r.quantity,
                "unit_price": r.unit_price,
                "total": r.total,
                "discount": r.discount,
                "document": r.document,
                "party": r.party,
            }
            for r in db.execute(q)
        ],
        "pagination": paginate(total, page, limit),
    }


# ─── Codes ───────────────────────────────────────────────────────────────────


def product_lookup(db: Session, pharmacy_id: int, code: str) -> int | None:
    """« Scanner / Rechercher un code barre »: the pharmacy's product whose PID or barcode is
    exactly `code` (imported, or the owner's own barcode). None = none (never says whether it
    exists in another pharmacy)."""
    code = code.strip()
    if not code:
        return None
    own = select(PharmacyProductEdit.medicament_id).where(
        PharmacyProductEdit.pharmacy_id == pharmacy_id,
        or_(PharmacyProductEdit.barcode1 == code, PharmacyProductEdit.barcode2 == code),
    )
    return db.scalars(
        select(Medicament.id)
        .where(
            or_(
                Medicament.pid == code, Medicament.barcode1 == code, Medicament.barcode2 == code, Medicament.id.in_(own)
            ),
            Medicament.id.in_(select(_linked_ids(pharmacy_id))),
        )
        .order_by(Medicament.product, Medicament.id)
        .limit(1)
    ).first()
