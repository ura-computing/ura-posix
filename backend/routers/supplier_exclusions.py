"""Supplier (fournisseur) exclusions — achats-side sibling of BL exclusions.

Owner-managed, non-destructive, reversible. Excluding a supplier NAME inserts a
PharmacySupplierExclusion row; every Achat from that supplier then drops out of
the dashboard / analyse / stock / supplier-summary aggregates through the wired
`achat_supplier_filter()` (accent/case-insensitive match). Deleting the row
restores everything. Sales are never touched (the Sobrus ventes export carries
no supplier).

Feature gate: special_products (same page as product / BL exclusions).
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func

from csv_parse import strip_accents
from database import DbDep
from models import Achat, PharmacySupplierExclusion
from permissions import require_pharmacy_owner
from schemas.supplier_exclusions import (
    SupplierExclusionCreate,
    SupplierExclusionOut,
    SupplierExclusionResult,
    SupplierReintegrate,
    SupplierReintegrateResult,
    SupplierSummary,
)
from search import supplier_search_clauses, tokenize_search
from security import CurrentUserDep

router = APIRouter(tags=["supplier-exclusions"])



def _norm(name: str | None) -> str:
    return strip_accents(name or "").lower().strip()


def _supplier_aggregate(db, pharmacy_id: int, suppliers: list[str] | None = None):
    """Group this pharmacy's Achats by supplier → one row per supplier with
    total / line & product counts / last date. NULL suppliers are ignored."""
    q = (
        db.query(
            Achat.supplier.label("supplier"),
            func.coalesce(func.sum(Achat.total), 0.0).label("total"),
            func.count(Achat.id).label("nb_lines"),
            func.count(func.distinct(Achat.medicament_id)).label("nb_products"),
            func.max(Achat.delivery_date).label("last_date"),
        )
        .filter(Achat.pharmacy_id == pharmacy_id, Achat.supplier.isnot(None))
    )
    if suppliers is not None:
        q = q.filter(Achat.supplier.in_(suppliers))
    return q.group_by(Achat.supplier)


def _excluded_norm_set(db, pharmacy_id: int) -> set[str]:
    """Normalized (accent/case-insensitive) set of currently-excluded supplier names."""
    return {
        _norm(r[0]) for r in db.query(PharmacySupplierExclusion.supplier)
        .filter(PharmacySupplierExclusion.pharmacy_id == pharmacy_id).all()
    }


# ─── List current exclusions ──────────────────────────────────────────────────

@router.get("/", response_model=list[SupplierExclusionOut])
def list_supplier_exclusions(user: CurrentUserDep, db: DbDep) -> list[dict]:
    """Every supplier currently excluded for this pharmacy, newest first, with its
    aggregated totals pulled back from the Achats it covers."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="special_products")
    rows = (
        db.query(PharmacySupplierExclusion)
        .filter(PharmacySupplierExclusion.pharmacy_id == pharmacy_id)
        .order_by(PharmacySupplierExclusion.created_at.desc())
        .all()
    )
    if not rows:
        return []
    agg = {a.supplier: a for a in _supplier_aggregate(db, pharmacy_id, [r.supplier for r in rows]).all()}
    out = []
    for r in rows:
        a = agg.get(r.supplier)
        out.append({
            "supplier":    r.supplier,
            "total":       round(float(a.total), 2) if a else 0.0,
            "nb_lines":    int(a.nb_lines) if a else 0,
            "nb_products": int(a.nb_products) if a else 0,
            "last_date":   a.last_date if a else None,
            "notes":       r.notes,
            "created_at":  r.created_at.isoformat() if r.created_at else "",
        })
    return out


# ─── Search suppliers to exclude (by name) ────────────────────────────────────

@router.get("/search", response_model=list[SupplierSummary])
def search_suppliers(
    user: CurrentUserDep,
    db:   DbDep,
    q:    Annotated[str, Query(min_length=2, description="Supplier name (accent/case-insensitive, `*` wildcard)")],
) -> list[dict]:
    """Find suppliers matching `q` (accent/case-insensitive, `*`-aware) with their
    aggregated purchase totals so the user can pick one; already-excluded
    suppliers are flagged."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="special_products")
    tokens = tokenize_search(q.strip())
    if not tokens:
        return []

    agg = _supplier_aggregate(db, pharmacy_id)
    for clause in supplier_search_clauses(tokens, [Achat.supplier]):
        agg = agg.filter(clause)
    rows = agg.order_by(func.sum(Achat.total).desc()).all()

    excluded = _excluded_norm_set(db, pharmacy_id)
    return [{
        "supplier":         r.supplier,
        "total":            round(float(r.total), 2),
        "nb_lines":         int(r.nb_lines),
        "nb_products":      int(r.nb_products),
        "last_date":        r.last_date,
        "already_excluded": _norm(r.supplier) in excluded,
    } for r in rows]


# ─── Exclude a supplier ───────────────────────────────────────────────────────

@router.post("/", response_model=SupplierExclusionResult, status_code=201)
def exclude_supplier(body: SupplierExclusionCreate, user: CurrentUserDep, db: DbDep) -> dict:
    """Exclude one supplier by name (+ optional note). Idempotent — an already
    excluded supplier is a no-op. 404 if the supplier has no Achats in this pharmacy."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="special_products")
    supplier = body.supplier.strip()
    if not supplier:
        raise HTTPException(status_code=422, detail="Nom de fournisseur vide.")

    agg = _supplier_aggregate(db, pharmacy_id, [supplier]).first()
    if agg is None:
        raise HTTPException(status_code=404, detail=f"Fournisseur introuvable : {supplier}")

    existing = (
        db.query(PharmacySupplierExclusion)
        .filter(PharmacySupplierExclusion.pharmacy_id == pharmacy_id,
                PharmacySupplierExclusion.supplier == supplier)
        .first()
    )
    already = 0
    if existing:
        already = 1
        if body.notes is not None:        # allow updating the note on re-exclude
            existing.notes = body.notes
        row = existing
    else:
        row = PharmacySupplierExclusion(pharmacy_id=pharmacy_id, supplier=supplier, notes=body.notes)
        db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "excluded":         0 if already else 1,
        "already_excluded": already,
        "item": {
            "supplier":    supplier,
            "total":       round(float(agg.total), 2),
            "nb_lines":    int(agg.nb_lines),
            "nb_products": int(agg.nb_products),
            "last_date":   agg.last_date,
            "notes":       row.notes,
            "created_at":  row.created_at.isoformat() if row.created_at else "",
        },
    }


# ─── Réintégrer (un-exclude) ──────────────────────────────────────────────────

@router.post("/reintegrate", response_model=SupplierReintegrateResult)
def reintegrate_suppliers(body: SupplierReintegrate, user: CurrentUserDep, db: DbDep) -> dict:
    """Remove the exclusion on N suppliers — their Achats return to every aggregate
    on the next query. Idempotent: names not currently excluded count as not_excluded."""
    pharmacy_id = require_pharmacy_owner(user, db, feature="special_products")
    suppliers = list(dict.fromkeys(s.strip() for s in body.suppliers if s.strip()))
    rows = (
        db.query(PharmacySupplierExclusion)
        .filter(PharmacySupplierExclusion.pharmacy_id == pharmacy_id,
                PharmacySupplierExclusion.supplier.in_(suppliers))
        .all()
    )
    found = {r.supplier for r in rows}
    for r in rows:
        db.delete(r)
    db.commit()
    return {
        "reintegrated": len(rows),
        "not_excluded": len([s for s in suppliers if s not in found]),
        "suppliers":    suppliers,
    }
