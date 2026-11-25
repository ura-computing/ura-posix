"""« Fournisseurs » (admin, Support): the supplier list shared by every pharmacy, filled from Sobrus (run mode
`suppliers`, queued by `app/sobrus/router.py`).

GET   /v1/admin/suppliers        search (name, city), kind, archived (the archived ones only), sort, page → one page
GET   /v1/admin/suppliers/{id}   its sheet (order fields: None = « inconnu »)
PATCH /v1/admin/suppliers/{id}   the fields sent (null = back to « inconnu »), `archived`: « Archiver » / back
GET   /v1/admin/suppliers/{id}/conditions   its conditions (not deleted), with their products
POST  /v1/admin/suppliers/{id}/conditions   add one
PUT   /v1/admin/conditions/{cid}            change one: version + 1, the old one kept in `condition_history`
DELETE /v1/admin/conditions/{cid}           delete one (kept, `deleted_at`; its history stays)
GET / POST /v1/admin/purchasing-groups, PUT / DELETE …/{id}   « Groupements »: name, note, member pharmacies
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Path, Query
from sqlalchemy import asc, desc, or_

from app.core.database import DbDep
from app.core.errors import ApiError, ErrorCode
from app.core.models import (
    ConditionHistory,
    ConditionProduct,
    Medicament,
    Pharmacy,
    PurchasingGroup,
    PurchasingGroupMember,
    Supplier,
    SupplierCondition,
)
from app.core.audit import user_label
from app.core.permissions import AdminDep, admin_only
from app.ingestion.csv_parse import normalized_name
from app.ledger.schemas import paginate
from app.purchasing.schemas import (
    ConditionIn,
    ConditionOut,
    ConditionProductOut,
    GroupIn,
    GroupOut,
    GroupPharmacy,
    SupplierEditIn,
    SupplierListResponse,
    SupplierRow,
    SupplierSheet,
)

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


@router.get("/admin/suppliers/{supplier_id:int}", response_model=SupplierSheet)
def get_supplier(supplier_id: Annotated[int, Path(ge=1)], db: DbDep) -> SupplierSheet:
    return SupplierSheet.model_validate(_supplier(db, supplier_id), from_attributes=True)


@router.patch("/admin/suppliers/{supplier_id:int}", response_model=SupplierSheet)
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


# ── Conditions (D-2) ─────────────────────────────────────────────────────────

_CONDITION_FIELDS = ("kind", "basis", "value", "days", "tiers", "text", "valid_from", "valid_to", "state", "source")


def _conditions_out(db, conditions: list[SupplierCondition]) -> list[ConditionOut]:
    ids = [c.id for c in conditions]
    products: dict[int, list[ConditionProductOut]] = {}
    if ids:
        rows = (
            db.query(ConditionProduct.condition_id, Medicament.id, Medicament.pid, Medicament.product)
            .join(Medicament, Medicament.id == ConditionProduct.medicament_id)
            .filter(ConditionProduct.condition_id.in_(ids))
            .order_by(Medicament.product)
        )
        for cid, mid, pid, name in rows:
            products.setdefault(cid, []).append(ConditionProductOut(id=mid, pid=pid, product=name))
    return [
        ConditionOut(
            **{f: getattr(c, f) for f in _CONDITION_FIELDS},
            id=c.id,
            version=c.version,
            updated_by_name=c.updated_by_name,
            updated_at=c.updated_at,
            products=products.get(c.id, []),
        )
        for c in conditions
    ]


def _write(db, condition: SupplierCondition, body: ConditionIn, actor: str) -> None:
    """The condition's fields + its products (only catalogue products: an unknown id → 404)."""
    values = body.model_dump(exclude={"product_ids"}, by_alias=True)
    for field in _CONDITION_FIELDS:
        setattr(condition, field, values[field])
    condition.updated_by_name = actor
    found = {mid for (mid,) in db.query(Medicament.id).filter(Medicament.id.in_(body.product_ids))}
    if len(found) != len(body.product_ids):
        raise ApiError(404, ErrorCode.MEDICAMENTS_NOT_FOUND, "Produit introuvable dans le catalogue.")
    db.flush()
    db.query(ConditionProduct).filter(ConditionProduct.condition_id == condition.id).delete()
    db.add_all(ConditionProduct(condition_id=condition.id, medicament_id=mid) for mid in body.product_ids)


def _condition(db, condition_id: int) -> SupplierCondition:
    condition = db.get(SupplierCondition, condition_id)
    if condition is None or condition.deleted_at is not None:
        raise ApiError(404, ErrorCode.CONDITION_NOT_FOUND, "Condition introuvable.")
    return condition


def _snapshot(db, condition: SupplierCondition, actor: str) -> None:
    """The version about to change, kept for good."""
    out = _conditions_out(db, [condition])[0].model_dump(mode="json")
    db.add(ConditionHistory(condition_id=condition.id, version=condition.version, snapshot=out, changed_by_name=actor))


@router.get("/admin/suppliers/{supplier_id:int}/conditions", response_model=list[ConditionOut])
def list_conditions(supplier_id: Annotated[int, Path(ge=1)], db: DbDep) -> list[ConditionOut]:
    """Confirmed first, then « À vérifier », then « Manquante »; by kind."""
    _supplier(db, supplier_id)
    rows = (
        db.query(SupplierCondition)
        .filter(SupplierCondition.supplier_id == supplier_id, SupplierCondition.deleted_at.is_(None))
        .all()
    )
    order = {"confirmed": 0, "unverified": 1, "missing": 2}
    rows.sort(key=lambda c: (order[c.state], c.kind, c.id))
    return _conditions_out(db, rows)


@router.post("/admin/suppliers/{supplier_id:int}/conditions", response_model=ConditionOut, status_code=201)
def add_condition(
    supplier_id: Annotated[int, Path(ge=1)], body: ConditionIn, admin: AdminDep, db: DbDep
) -> ConditionOut:
    _supplier(db, supplier_id)
    condition = SupplierCondition(supplier_id=supplier_id)
    db.add(condition)
    _write(db, condition, body, user_label(admin))  # its fields, then saved, then its products
    db.commit()
    db.refresh(condition)
    return _conditions_out(db, [condition])[0]


@router.put("/admin/conditions/{condition_id}", response_model=ConditionOut)
def edit_condition(
    condition_id: Annotated[int, Path(ge=1)], body: ConditionIn, admin: AdminDep, db: DbDep
) -> ConditionOut:
    condition = _condition(db, condition_id)
    _snapshot(db, condition, user_label(admin))
    _write(db, condition, body, user_label(admin))
    condition.version += 1
    db.commit()
    db.refresh(condition)
    return _conditions_out(db, [condition])[0]


@router.delete("/admin/conditions/{condition_id}", status_code=204)
def delete_condition(condition_id: Annotated[int, Path(ge=1)], admin: AdminDep, db: DbDep) -> None:
    condition = _condition(db, condition_id)
    _snapshot(db, condition, user_label(admin))
    condition.deleted_at = datetime.now(timezone.utc)
    condition.updated_by_name = user_label(admin)
    db.commit()


# ── Purchasing groups (D-5) ──────────────────────────────────────────────────


def _groups_out(db, groups: list[PurchasingGroup]) -> list[GroupOut]:
    members: dict[int, list[GroupPharmacy]] = {}
    rows = (
        db.query(PurchasingGroupMember.group_id, Pharmacy)
        .join(Pharmacy, Pharmacy.id == PurchasingGroupMember.pharmacy_id)
        .filter(PurchasingGroupMember.group_id.in_([g.id for g in groups]))
        .order_by(Pharmacy.name)
    )
    for gid, p in rows:
        members.setdefault(gid, []).append(GroupPharmacy(id=p.id, name=p.name, code=p.code, city=p.city))
    return [GroupOut(id=g.id, name=g.name, note=g.note, pharmacies=members.get(g.id, [])) for g in groups]


def _save_group(db, group: PurchasingGroup, body: GroupIn) -> GroupOut:
    clash = db.query(PurchasingGroup.id).filter(PurchasingGroup.name == body.name, PurchasingGroup.id != group.id)
    if clash.first():
        raise ApiError(409, ErrorCode.GROUP_EXISTS, "Un groupement porte déjà ce nom.")
    ids = sorted(set(body.pharmacy_ids))
    if len({pid for (pid,) in db.query(Pharmacy.id).filter(Pharmacy.id.in_(ids))}) != len(ids):
        raise ApiError(404, ErrorCode.PHARMACY_NOT_FOUND, "Pharmacie introuvable.")
    group.name, group.note = body.name, body.note
    db.add(group)
    db.flush()
    db.query(PurchasingGroupMember).filter(PurchasingGroupMember.group_id == group.id).delete()
    db.add_all(PurchasingGroupMember(group_id=group.id, pharmacy_id=pid) for pid in ids)
    db.commit()
    return _groups_out(db, [group])[0]


def _group(db, group_id: int) -> PurchasingGroup:
    group = db.get(PurchasingGroup, group_id)
    if group is None:
        raise ApiError(404, ErrorCode.GROUP_NOT_FOUND, "Groupement introuvable.")
    return group


@router.get("/admin/purchasing-groups", response_model=list[GroupOut])
def list_groups(db: DbDep) -> list[GroupOut]:
    return _groups_out(db, db.query(PurchasingGroup).order_by(PurchasingGroup.name).all())


@router.post("/admin/purchasing-groups", response_model=GroupOut, status_code=201)
def add_group(body: GroupIn, db: DbDep) -> GroupOut:
    return _save_group(db, PurchasingGroup(), body)


@router.put("/admin/purchasing-groups/{group_id}", response_model=GroupOut)
def edit_group(group_id: Annotated[int, Path(ge=1)], body: GroupIn, db: DbDep) -> GroupOut:
    return _save_group(db, _group(db, group_id), body)


@router.delete("/admin/purchasing-groups/{group_id}", status_code=204)
def delete_group(group_id: Annotated[int, Path(ge=1)], db: DbDep) -> None:
    db.delete(_group(db, group_id))
    db.commit()
