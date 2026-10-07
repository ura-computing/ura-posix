"""« Produits » SQL. The pharmacy's products = every product in its last stock import,
sold or bought by it (any date). Exclusions do not apply here (Comptabilité only).

« Vendus 12 mois », stock and average PU use the Stock page's rules, so both pages
always show the same numbers (`stock_queries`)."""

from __future__ import annotations

from sqlalchemy import and_, case, func, select, union
from sqlalchemy.orm import Session

from app.analytics.query_parts import avg_pu_subquery, category_filter, pharma_expr
from app.analytics.stock_queries import _vente_units_subq, stock_abcd_window
from app.core.models import Achat, Medicament, PharmacyStock, Vente
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
            }
            for r in rows
        ],
        "pagination": paginate(total, 1 if export else page, max(total, 1) if export else limit),
        "sales_from": sales_from,
        "sales_to": sales_to,
    }
