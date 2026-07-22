"""BL (bon de livraison) exclusions — PG-007, achats half.

Owner-managed, non-destructive, reversible. Excluding a `delivery_ref` inserts a
PharmacyBlExclusion row; every Achat with that ref then drops out of the
dashboard / analyse / stock / supplier-summary aggregates through the already-wired
`achat_bl_filter()`. Deleting the row restores everything.

The pharmacist finds a BL either by typing its reference, or by typing a product
name (the app lists every BL that product appears in). The exclusion always keys
on the reference, so it removes *all* lines of that BL at once.

Feature gate: special_products (same page as product exclusions).
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func

from database import DbDep
from models import Achat, Medicament, PharmacyBlExclusion
from permissions import require_pharmacy_owner
from schemas.bl_exclusions import (
    BlDetail,
    BlExclusionCreate,
    BlExclusionOut,
    BlExclusionResult,
    BlReintegrate,
    BlReintegrateResult,
    BlSummary,
)
from search import product_search_clauses, tokenize_search
from security import CurrentUserDep


router = APIRouter(tags=["bl-exclusions"])

_SEARCH_LIMIT = 30   # BLs returned by the exclude-search


def _bl_aggregate(db, pharmacy_id: int, refs: list[str] | None = None):
    """Group this pharmacy's Achats by delivery_ref → one row per BL with
    supplier / date / total / line & product counts. NULL refs are ignored
    (they can't be excluded — see achat_bl_filter)."""
    q = (
        db.query(
            Achat.delivery_ref.label("ref"),
            func.max(Achat.supplier).label("supplier"),
            func.max(Achat.delivery_date).label("delivery_date"),
            func.coalesce(func.sum(Achat.total), 0.0).label("total"),
            func.count(Achat.id).label("nb_lines"),
            func.count(func.distinct(Achat.medicament_id)).label("nb_products"),
        )
        .filter(Achat.pharmacy_id == pharmacy_id, Achat.delivery_ref.isnot(None))
    )
    if refs is not None:
        q = q.filter(Achat.delivery_ref.in_(refs))
    return q.group_by(Achat.delivery_ref)


def _excluded_refs(db, pharmacy_id: int) -> set[str]:
    return {r[0] for r in db.query(PharmacyBlExclusion.delivery_ref)
            .filter(PharmacyBlExclusion.pharmacy_id == pharmacy_id).all()}


# ─── List current exclusions ──────────────────────────────────────────────────

@router.get("/", response_model=list[BlExclusionOut])
def list_bl_exclusions(user: CurrentUserDep, db: DbDep) -> list[dict]:
    """Every BL currently excluded for this pharmacy, newest first, with its
    supplier / date / total pulled back from the Achats it covers."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="special_products")
    rows = (
        db.query(PharmacyBlExclusion)
        .filter(PharmacyBlExclusion.pharmacy_id == pharmacy_id)
        .order_by(PharmacyBlExclusion.created_at.desc())
        .all()
    )
    if not rows:
        return []
    agg = {a.ref: a for a in _bl_aggregate(db, pharmacy_id, [r.delivery_ref for r in rows]).all()}
    out = []
    for r in rows:
        a = agg.get(r.delivery_ref)
        out.append({
            "delivery_ref":  r.delivery_ref,
            "supplier":      a.supplier if a else None,
            "delivery_date": a.delivery_date if a else None,
            "total":         round(float(a.total), 2) if a else 0.0,
            "nb_lines":      int(a.nb_lines) if a else 0,
            "notes":         r.notes,
            "created_at":    r.created_at.isoformat() if r.created_at else "",
        })
    return out


# ─── Search BLs to exclude (by ref or by product) ─────────────────────────────

@router.get("/search", response_model=list[BlSummary])
def search_bls(
    user: CurrentUserDep,
    db:   DbDep,
    q:    Annotated[str, Query(min_length=2, description="BL reference (substring) or product name")],
) -> list[dict]:
    """Find BLs matching `q` either by delivery reference (substring, accent/case
    insensitive) OR by a product they contain. Returns BL summaries so the user
    can pick the right one; already-excluded BLs are flagged."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="special_products")
    term = q.strip()

    # (a) direct reference match
    ref_rows = (
        db.query(Achat.delivery_ref)
        .filter(
            Achat.pharmacy_id == pharmacy_id,
            Achat.delivery_ref.isnot(None),
            func.unaccent(Achat.delivery_ref).ilike(func.unaccent(f"%{term}%")),
        )
        .distinct()
    )
    refs: set[str] = {r[0] for r in ref_rows.all()}

    # (b) product match → the refs of every BL containing a matching product,
    # AND which product(s) matched (so the user recognises the BL — they remember
    # the product they bought, not the supplier/reference).
    matched_by_ref: dict[str, list[str]] = {}
    tokens = tokenize_search(term)
    if tokens:
        prod_q = (
            db.query(Achat.delivery_ref, Medicament.product)
            .join(Medicament, Achat.medicament_id == Medicament.id)
            .filter(Achat.pharmacy_id == pharmacy_id, Achat.delivery_ref.isnot(None))
        )
        for clause in product_search_clauses(tokens):
            prod_q = prod_q.filter(clause)
        for ref, product in prod_q.distinct().all():
            names = matched_by_ref.setdefault(ref, [])
            if product and product not in names and len(names) < 3:
                names.append(product)
    refs |= set(matched_by_ref.keys())

    if not refs:
        return []

    rows = (
        _bl_aggregate(db, pharmacy_id, list(refs))
        .order_by(func.max(Achat.delivery_date).desc())
        .limit(_SEARCH_LIMIT)
        .all()
    )
    excluded = _excluded_refs(db, pharmacy_id)
    return [{
        "delivery_ref":     r.ref,
        "supplier":         r.supplier,
        "delivery_date":    r.delivery_date,
        "total":            round(float(r.total), 2),
        "nb_lines":         int(r.nb_lines),
        "nb_products":      int(r.nb_products),
        "already_excluded": r.ref in excluded,
        "matched_products": matched_by_ref.get(r.ref, []),
    } for r in rows]


# ─── BL detail (product lines) for the confirmation step ──────────────────────

@router.get("/detail", response_model=BlDetail)
def bl_detail(
    user: CurrentUserDep,
    db:   DbDep,
    delivery_ref: Annotated[str, Query(min_length=1)],
) -> dict:
    """All product lines of one BL, so the user confirms it's the right one."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="special_products")
    rows = (
        db.query(Achat, Medicament)
        .outerjoin(Medicament, Achat.medicament_id == Medicament.id)
        .filter(Achat.pharmacy_id == pharmacy_id, Achat.delivery_ref == delivery_ref)
        .all()
    )
    if not rows:
        raise HTTPException(status_code=404, detail=f"Bon de livraison introuvable : {delivery_ref}")

    supplier = next((a.supplier for a, _ in rows if a.supplier), None)
    date     = next((a.delivery_date for a, _ in rows if a.delivery_date), None)
    total    = round(sum(float(a.total or 0) for a, _ in rows), 2)
    lines = [{
        "product":    m.product if m else None,
        "pid":        m.pid if m else None,
        "quantity":   a.quantity,
        "unit_price": a.unit_price,
        "total":      a.total,
    } for a, m in rows]
    return {
        "delivery_ref":  delivery_ref,
        "supplier":      supplier,
        "delivery_date": date,
        "total":         total,
        "nb_lines":      len(rows),
        "lines":         lines,
    }


# ─── Exclude a BL ─────────────────────────────────────────────────────────────

@router.post("/", response_model=BlExclusionResult, status_code=201)
def exclude_bl(body: BlExclusionCreate, user: CurrentUserDep, db: DbDep) -> dict:
    """Exclude one BL by reference (+ optional note). Idempotent — an already
    excluded ref is a no-op. 404 if the ref doesn't exist in this pharmacy."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="special_products")
    ref = body.delivery_ref.strip()
    if not ref:
        raise HTTPException(status_code=422, detail="Référence de livraison vide.")

    agg = _bl_aggregate(db, pharmacy_id, [ref]).first()
    if agg is None:
        raise HTTPException(status_code=404, detail=f"Bon de livraison introuvable : {ref}")

    existing = (
        db.query(PharmacyBlExclusion)
        .filter(PharmacyBlExclusion.pharmacy_id == pharmacy_id,
                PharmacyBlExclusion.delivery_ref == ref)
        .first()
    )
    already = 0
    if existing:
        already = 1
        if body.notes is not None:        # allow updating the note on re-exclude
            existing.notes = body.notes
        row = existing
    else:
        row = PharmacyBlExclusion(pharmacy_id=pharmacy_id, delivery_ref=ref, notes=body.notes)
        db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "excluded":         0 if already else 1,
        "already_excluded": already,
        "item": {
            "delivery_ref":  ref,
            "supplier":      agg.supplier,
            "delivery_date": agg.delivery_date,
            "total":         round(float(agg.total), 2),
            "nb_lines":      int(agg.nb_lines),
            "notes":         row.notes,
            "created_at":    row.created_at.isoformat() if row.created_at else "",
        },
    }


# ─── Réintégrer (un-exclude) ──────────────────────────────────────────────────

@router.post("/reintegrate", response_model=BlReintegrateResult)
def reintegrate_bls(body: BlReintegrate, user: CurrentUserDep, db: DbDep) -> dict:
    """Remove the exclusion on N BLs — their Achats return to every aggregate on
    the next query. Idempotent: refs not currently excluded count as not_excluded."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="special_products")
    refs = list(dict.fromkeys(r.strip() for r in body.delivery_refs if r.strip()))
    rows = (
        db.query(PharmacyBlExclusion)
        .filter(PharmacyBlExclusion.pharmacy_id == pharmacy_id,
                PharmacyBlExclusion.delivery_ref.in_(refs))
        .all()
    )
    found = {r.delivery_ref for r in rows}
    for r in rows:
        db.delete(r)
    db.commit()
    return {
        "reintegrated":  len(rows),
        "not_excluded":  len([r for r in refs if r not in found]),
        "delivery_refs": refs,
    }
