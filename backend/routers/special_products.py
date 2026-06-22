"""Owner-managed product exclusions ('produits spéciaux') — direct CRUD with
no admin approval (per 2026-06-23 product decision).

The data lives in PharmacyMedicamentStatus(declared=False). Adding a row
flips the medicament out of every accounting aggregate (via the
non_declared_sub helper already wired in stats / analyse / margin-alerts
/ transactions). Deleting a row puts it back instantly. Fully reversible.

Feature gate: special_products. Owner toggles per-user via UserPermission;
admin grants/revokes at pharmacy level via PharmacyFeature.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path, Query
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import DbDep
from models import Achat, Medicament, PharmacyMedicamentStatus, Vente
from permissions import require_pharmacy_owner
from schemas.special_products import (
    DeleteResult,
    MedicamentSuggestion,
    SpecialProductCreate,
    SpecialProductOut,
)
from search import product_search_clauses, tokenize_search
from security import CurrentUserDep


router = APIRouter(tags=["special-products"])


MedIdPath = Annotated[int, Path(ge=1, description="Medicament id")]


def _to_out(status_row, med: Medicament) -> dict:
    return {
        "medicament_id": med.id,
        "product":       med.product,
        "pid":           med.pid,
        "category":      med.category,
        "created_at":    status_row.created_at.isoformat() if status_row.created_at else "",
    }


@router.get("/", response_model=list[SpecialProductOut])
def list_special_products(user: CurrentUserDep, db: DbDep) -> list[dict]:
    """All medicaments currently marked spécial for this pharmacy, newest first."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="special_products")
    rows = (
        db.query(PharmacyMedicamentStatus, Medicament)
        .join(Medicament, PharmacyMedicamentStatus.medicament_id == Medicament.id)
        .filter(
            PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
            PharmacyMedicamentStatus.declared == False,
        )
        .order_by(PharmacyMedicamentStatus.created_at.desc())
        .all()
    )
    return [_to_out(status, med) for status, med in rows]


@router.post("/", response_model=SpecialProductOut, status_code=201)
def create_special_product(
    body: SpecialProductCreate,
    user: CurrentUserDep,
    db:   DbDep,
) -> dict:
    """Mark a medicament as spécial for this pharmacy. Idempotent: a second
    request for the same medicament overwrites (flips declared back to False
    if the owner had re-declared previously) — never returns 409."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="special_products")

    med = db.query(Medicament).filter(Medicament.id == body.medicament_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Médicament introuvable")

    existing = (
        db.query(PharmacyMedicamentStatus)
        .filter(
            PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
            PharmacyMedicamentStatus.medicament_id == body.medicament_id,
        )
        .first()
    )
    if existing:
        existing.declared = False
        status_row = existing
    else:
        status_row = PharmacyMedicamentStatus(
            pharmacy_id=pharmacy_id,
            medicament_id=body.medicament_id,
            declared=False,
        )
        db.add(status_row)
    try:
        db.commit()
    except IntegrityError:
        # Race: another request inserted the row between our check + commit.
        db.rollback()
        status_row = (
            db.query(PharmacyMedicamentStatus)
            .filter(
                PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
                PharmacyMedicamentStatus.medicament_id == body.medicament_id,
            )
            .one()
        )
    db.refresh(status_row)
    return _to_out(status_row, med)


@router.delete("/{medicament_id}", response_model=DeleteResult)
def delete_special_product(
    medicament_id: MedIdPath,
    user: CurrentUserDep,
    db:   DbDep,
) -> dict:
    """Réintégrer — remove the spécial flag. Product returns to every aggregate
    on the next query. Idempotent: returns deleted=False if no row existed."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="special_products")
    row = (
        db.query(PharmacyMedicamentStatus)
        .filter(
            PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
            PharmacyMedicamentStatus.medicament_id == medicament_id,
        )
        .first()
    )
    if not row:
        return {"deleted": False, "medicament_id": medicament_id}
    db.delete(row); db.commit()
    return {"deleted": True, "medicament_id": medicament_id}


@router.get("/suggestions", response_model=list[MedicamentSuggestion])
def medicament_suggestions(
    user: CurrentUserDep,
    db:   DbDep,
    q:    Annotated[str, Query(min_length=2, description="≥2 chars; tokenized + accent-insensitive")],
) -> list[dict]:
    """Autocomplete: medicaments the pharmacy actually has Achats OR Ventes for,
    minus those already marked spécial. Limit 10."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="special_products")

    # Subqueries: meds the pharmacy has data for, and meds already excluded.
    achat_meds = (
        db.query(Achat.medicament_id)
        .filter(Achat.pharmacy_id == pharmacy_id, Achat.medicament_id.isnot(None))
        .distinct().scalar_subquery()
    )
    vente_meds = (
        db.query(Vente.medicament_id)
        .filter(Vente.pharmacy_id == pharmacy_id, Vente.medicament_id.isnot(None))
        .distinct().scalar_subquery()
    )
    excluded = (
        db.query(PharmacyMedicamentStatus.medicament_id)
        .filter(
            PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
            PharmacyMedicamentStatus.declared == False,
        )
        .scalar_subquery()
    )

    # Sale-count per medicament (small context for the suggestion row).
    sales_sub = (
        db.query(
            Vente.medicament_id.label("med_id"),
            func.count(Vente.id).label("nb_ventes"),
        )
        .filter(Vente.pharmacy_id == pharmacy_id, Vente.medicament_id.isnot(None))
        .group_by(Vente.medicament_id)
        .subquery()
    )

    qry = (
        db.query(
            Medicament.id, Medicament.pid, Medicament.product, Medicament.category,
            func.coalesce(sales_sub.c.nb_ventes, 0).label("nb_ventes"),
        )
        .outerjoin(sales_sub, sales_sub.c.med_id == Medicament.id)
        .filter(Medicament.id.notin_(excluded))
        .filter((Medicament.id.in_(achat_meds)) | (Medicament.id.in_(vente_meds)))
    )

    for clause in product_search_clauses(tokenize_search(q)):
        qry = qry.filter(clause)

    rows = qry.order_by(Medicament.product.asc()).limit(10).all()
    return [{
        "id":        r.id,
        "pid":       r.pid,
        "product":   r.product,
        "category":  r.category,
        "nb_ventes": int(r.nb_ventes or 0),
    } for r in rows]
