"""« Fournisseurs » (admin, Support): the supplier list shared by every pharmacy, filled from Sobrus (run mode
`suppliers`, queued by `app/sobrus/router.py`).

GET /v1/admin/suppliers   search (name, city), kind, sort, page → one page
"""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Query
from sqlalchemy import asc, desc, or_

from app.core.database import DbDep
from app.core.models import Supplier
from app.core.permissions import admin_only
from app.ingestion.csv_parse import normalized_name
from app.ledger.schemas import paginate
from app.purchasing.schemas import SupplierListResponse, SupplierRow

router = APIRouter(tags=["purchasing"], dependencies=[admin_only])

_SORTABLE = {"name": Supplier.name_key, "kind": Supplier.kind, "city": Supplier.city}


@router.get("/admin/suppliers", response_model=SupplierListResponse)
def list_suppliers(
    db: DbDep,
    search: Annotated[str | None, Query()] = None,
    kind: Annotated[Literal["laboratoire", "grossiste", "societe"] | None, Query()] = None,
    sort_by: Annotated[Literal["name", "kind", "city"], Query()] = "name",
    sort_order: Annotated[Literal["asc", "desc"], Query()] = "asc",
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
) -> SupplierListResponse:
    """Every word of the search in the name or the city (accents and case ignored): « bottu casa »."""
    q = db.query(Supplier)
    for word in normalized_name(search).split():
        q = q.filter(or_(Supplier.name_key.contains(word, autoescape=True), Supplier.city.icontains(word)))
    if kind:
        q = q.filter(Supplier.kind == kind)
    total = q.count()
    order = desc if sort_order == "desc" else asc
    rows = (
        q.order_by(order(_SORTABLE[sort_by]).nullslast(), Supplier.name_key)
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return SupplierListResponse(
        data=[SupplierRow.model_validate(s, from_attributes=True) for s in rows],
        pagination=paginate(total, page, limit),
    )
