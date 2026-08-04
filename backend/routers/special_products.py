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

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func

from database import DbDep
from models import Achat, Medicament, PharmacyMedicamentStatus, Vente
from permissions import require_pharmacy_owner
from schemas.special_products import (
    MedicamentSuggestion,
    SpecialProductBulkResult,
    SpecialProductCreate,
    SpecialProductOut,
    SpecialProductReintegrate,
    SpecialProductReintegrateResult,
)
from search import product_search_clauses, tokenize_search
from security import CurrentUserDep


router = APIRouter(tags=["special-products"])


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


@router.post("/", response_model=SpecialProductBulkResult, status_code=201)
def exclude_products(
    body: SpecialProductCreate,
    user: CurrentUserDep,
    db:   DbDep,
) -> dict:
    """Bulk-mark medicaments as spécial for this pharmacy. Idempotent —
    medicament_ids already flagged are counted as `already_special` rather
    than erroring. Atomic: if any id is bogus the whole request returns 404
    with the offending ids surfaced; nothing is committed."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="special_products")
    ids = list(dict.fromkeys(body.medicament_ids))      # dedupe, keep order

    existing_meds = {m.id: m for m in
        db.query(Medicament).filter(Medicament.id.in_(ids)).all()}
    bad = [i for i in ids if i not in existing_meds]
    if bad:
        raise HTTPException(
            status_code=404,
            detail=f"Médicament(s) introuvable(s) : {bad}",
        )

    existing_status = {s.medicament_id: s for s in
        db.query(PharmacyMedicamentStatus).filter(
            PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
            PharmacyMedicamentStatus.medicament_id.in_(ids),
        ).all()}

    inserted = already = 0
    touched: list[PharmacyMedicamentStatus] = []
    for med_id in ids:
        s = existing_status.get(med_id)
        if s:
            if s.declared is False:
                already += 1                # already spécial → no-op
            else:
                s.declared = False          # was re-declared previously → flip
                inserted += 1
            touched.append(s)
        else:
            s = PharmacyMedicamentStatus(
                pharmacy_id=pharmacy_id, medicament_id=med_id, declared=False,
            )
            db.add(s); touched.append(s); inserted += 1
    db.commit()
    for s in touched:
        db.refresh(s)
    return {
        "inserted":        inserted,
        "already_special": already,
        "products":        [_to_out(s, existing_meds[s.medicament_id]) for s in touched],
    }


@router.post("/reintegrate", response_model=SpecialProductReintegrateResult)
def reintegrate_products(
    body: SpecialProductReintegrate,
    user: CurrentUserDep,
    db:   DbDep,
) -> dict:
    """Bulk-réintégrer — remove the spécial flag on N medicaments at once.
    Products return to every aggregate on the next query. Idempotent: ids
    that aren't currently spécial are silently counted as `not_special`
    (no 404 — owner might be acting on stale UI state)."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="special_products")
    ids = list(dict.fromkeys(body.medicament_ids))      # dedupe, keep order

    rows = (
        db.query(PharmacyMedicamentStatus)
        .filter(
            PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
            PharmacyMedicamentStatus.medicament_id.in_(ids),
            PharmacyMedicamentStatus.declared == False,
        )
        .all()
    )
    found = {r.medicament_id for r in rows}
    for r in rows:
        db.delete(r)
    db.commit()
    return {
        "reintegrated":   len(rows),
        "not_special":    len([i for i in ids if i not in found]),
        "medicament_ids": ids,
    }


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

    rows = qry.order_by(Medicament.product.asc()).all()
    return [{
        "id":        r.id,
        "pid":       r.pid,
        "product":   r.product,
        "category":  r.category,
        "nb_ventes": int(r.nb_ventes or 0),
    } for r in rows]
