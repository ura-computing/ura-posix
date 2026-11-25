"""« Fournisseurs » (admin, Support): the supplier list shared by every pharmacy, filled from Sobrus (run mode
`suppliers`, queued by `app/sobrus/router.py`).

GET   /v1/admin/suppliers        search (name, city), kind, archived (the archived ones only), sort, page → one page
GET   /v1/admin/suppliers/{id}   its sheet (order fields: None = « inconnu »)
PATCH /v1/admin/suppliers/{id}   the fields sent (null = back to « inconnu »), `archived`: « Archiver » / back
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Path, Query
from sqlalchemy import asc, desc, or_

from app.core.database import DbDep
from app.core.errors import ApiError, ErrorCode
from app.core.models import Supplier
from app.core.permissions import admin_only
from app.ingestion.csv_parse import normalized_name
from app.ledger.schemas import paginate
from app.purchasing.schemas import SupplierEditIn, SupplierListResponse, SupplierRow, SupplierSheet

router = APIRouter(tags=["purchasing"], dependencies=[admin_only])

_SORTABLE = {"name": Supplier.name_key, "kind": Supplier.kind, "city": Supplier.city}


@router.get("/admin/suppliers", response_model=SupplierListResponse)
def list_suppliers(
    db: DbDep,
    search: Annotated[str | None, Query()] = None,
    kind: Annotated[Literal["laboratoire", "grossiste", "societe"] | None, Query()] = None,
    archived: Annotated[bool, Query(description="true = the archived ones only")] = False,
    sort_by: Annotated[Literal["name", "kind", "city"], Query()] = "name",
    sort_order: Annotated[Literal["asc", "desc"], Query()] = "asc",
    page: Annotated[int, Query(ge=1)] = 1,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
) -> SupplierListResponse:
    """Every word of the search in the name or the city (accents and case ignored): « bottu casa »."""
    q = db.query(Supplier).filter(Supplier.archived_at.isnot(None) if archived else Supplier.archived_at.is_(None))
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


def _supplier(db, supplier_id: int) -> Supplier:
    supplier = db.get(Supplier, supplier_id)
    if supplier is None:
        raise ApiError(404, ErrorCode.SUPPLIER_NOT_FOUND, "Fournisseur introuvable.")
    return supplier


@router.get("/admin/suppliers/{supplier_id}", response_model=SupplierSheet)
def get_supplier(supplier_id: Annotated[int, Path(ge=1)], db: DbDep) -> SupplierSheet:
    return SupplierSheet.model_validate(_supplier(db, supplier_id), from_attributes=True)


@router.patch("/admin/suppliers/{supplier_id}", response_model=SupplierSheet)
def edit_supplier(supplier_id: Annotated[int, Path(ge=1)], body: SupplierEditIn, db: DbDep) -> SupplierSheet:
    """A later « Importer depuis Sobrus » never replaces these values (it fills empty fields only)."""
    supplier = _supplier(db, supplier_id)
    changes = body.model_dump(exclude_unset=True)
    if "name" in changes:
        if not changes["name"]:
            raise ApiError(400, ErrorCode.SUPPLIER_EMPTY, "Le nom du fournisseur est obligatoire.")
        key = normalized_name(changes["name"])
        if db.query(Supplier.id).filter(Supplier.name_key == key, Supplier.id != supplier.id).first():
            raise ApiError(409, ErrorCode.SUPPLIER_EXISTS, "Un fournisseur porte déjà ce nom.")
        supplier.name_key = key
    if "archived" in changes:
        archived = changes.pop("archived")
        supplier.archived_at = datetime.now(timezone.utc) if archived else None
    for field, value in changes.items():
        setattr(supplier, field, value)
    db.commit()
    db.refresh(supplier)
    return SupplierSheet.model_validate(supplier, from_attributes=True)
