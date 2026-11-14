"""Owner exclusions: special products, BLs, a product on some BLs, suppliers. They only change Comptabilité
(`exclusions.py` at the backend root); nothing is deleted, réintégrer restores it."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import func

from app.ingestion.csv_parse import strip_accents
from app.core.database import DbDep
from app.core.errors import ApiError, ErrorCode
from app.core.models import (
    Achat,
    Medicament,
    PharmacyBlExclusion,
    PharmacyBlLineExclusion,
    PharmacyMedicamentStatus,
    PharmacySupplierExclusion,
    Vente,
)
from app.core.permissions import member
from app.accounting.exclusions.schemas import (
    BlDetail,
    BlExclusionCreate,
    BlExclusionOut,
    BlExclusionResult,
    BlLineExclusionCreate,
    BlLineExclusionOut,
    BlLineExclusionResult,
    BlLineNote,
    BlLineReintegrate,
    BlLineReintegrateResult,
    BlNote,
    BlReintegrate,
    BlReintegrateResult,
    BlSummary,
    MedicamentSuggestion,
    SpecialProductBulkResult,
    SpecialProductCreate,
    SpecialProductNote,
    SpecialProductOut,
    SpecialProductReintegrate,
    SpecialProductReintegrateResult,
    SupplierExclusionCreate,
    SupplierExclusionOut,
    SupplierExclusionResult,
    SupplierNote,
    SupplierReintegrate,
    SupplierReintegrateResult,
    SupplierSummary,
)
from app.core.search import product_search_clauses, supplier_search_clauses, tokenize_search


router = APIRouter(tags=["exclusions"])


# ═══ Special products ════════════════════════════════════════════════════════
# Owner-managed product exclusions ('produits spéciaux') — direct CRUD with
# no admin approval (per 2026-06-23 product decision).
#
# The data lives in PharmacyMedicamentStatus(declared=False). Adding a row
# drops the medicament from Comptabilité only (`exclusions.py`). Deleting a row
# puts it back instantly. Fully reversible.
#
# Feature gate: special_products. Owner toggles per-user via UserPermission;
# admin grants/revokes at pharmacy level via PharmacyFeature.


def _to_out(status_row, med: Medicament) -> dict:
    return {
        "medicament_id": med.id,
        "product": med.product,
        "pid": med.pid,
        "category": med.category,
        "notes": status_row.notes,
        "created_at": status_row.created_at.isoformat() if status_row.created_at else "",
    }


@router.get("/special-products/", response_model=list[SpecialProductOut])
def list_special_products(pharmacy_id: Annotated[int, member("special_products")], db: DbDep) -> list[dict]:
    """All medicaments currently marked spécial for this pharmacy, newest first."""
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


@router.post("/special-products/", response_model=SpecialProductBulkResult, status_code=201)
def exclude_products(
    body: SpecialProductCreate,
    pharmacy_id: Annotated[int, member("special_products")],
    db: DbDep,
) -> dict:
    """Bulk-mark medicaments as spécial for this pharmacy. Idempotent —
    medicament_ids already flagged are counted as `already_special` rather
    than erroring. Atomic: if any id is bogus the whole request returns 404
    with the offending ids surfaced; nothing is committed."""
    ids = list(dict.fromkeys(body.medicament_ids))  # dedupe, keep order

    existing_meds = {m.id: m for m in db.query(Medicament).filter(Medicament.id.in_(ids)).all()}
    bad = [i for i in ids if i not in existing_meds]
    if bad:
        raise ApiError(
            404,
            ErrorCode.MEDICAMENTS_NOT_FOUND,
            f"Médicament(s) introuvable(s) : {bad}",
            ids=", ".join(map(str, bad)),
        )

    existing_status = {
        s.medicament_id: s
        for s in db.query(PharmacyMedicamentStatus)
        .filter(
            PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
            PharmacyMedicamentStatus.medicament_id.in_(ids),
        )
        .all()
    }

    inserted = already = 0
    touched: list[PharmacyMedicamentStatus] = []
    for med_id in ids:
        s = existing_status.get(med_id)
        if s:
            if s.declared is False:
                already += 1  # already spécial → no-op
            else:
                s.declared = False  # was re-declared previously → flip
                inserted += 1
            touched.append(s)
        else:
            s = PharmacyMedicamentStatus(
                pharmacy_id=pharmacy_id,
                medicament_id=med_id,
                declared=False,
            )
            db.add(s)
            touched.append(s)
            inserted += 1
    db.commit()
    for s in touched:
        db.refresh(s)
    return {
        "inserted": inserted,
        "already_special": already,
        "products": [_to_out(s, existing_meds[s.medicament_id]) for s in touched],
    }


@router.post("/special-products/reintegrate", response_model=SpecialProductReintegrateResult)
def reintegrate_products(
    body: SpecialProductReintegrate,
    pharmacy_id: Annotated[int, member("special_products")],
    db: DbDep,
) -> dict:
    """Bulk-réintégrer — remove the spécial flag on N medicaments at once.
    Products return to Comptabilité on the next query. Idempotent: ids
    that aren't currently spécial are silently counted as `not_special`
    (no 404 — owner might be acting on stale UI state)."""
    ids = list(dict.fromkeys(body.medicament_ids))  # dedupe, keep order

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
        "reintegrated": len(rows),
        "not_special": len([i for i in ids if i not in found]),
        "medicament_ids": ids,
    }


@router.get("/special-products/suggestions", response_model=list[MedicamentSuggestion])
def medicament_suggestions(
    pharmacy_id: Annotated[int, member("special_products")],
    db: DbDep,
    q: Annotated[str, Query(min_length=2, description="≥2 chars; tokenized + accent-insensitive")],
) -> list[dict]:
    """Autocomplete: medicaments the pharmacy actually has Achats OR Ventes for,
    minus those already marked spécial. Limit 10."""

    # Subqueries: meds the pharmacy has data for, and meds already excluded.
    achat_meds = (
        db.query(Achat.medicament_id)
        .filter(Achat.pharmacy_id == pharmacy_id, Achat.medicament_id.isnot(None))
        .distinct()
        .scalar_subquery()
    )
    vente_meds = (
        db.query(Vente.medicament_id)
        .filter(Vente.pharmacy_id == pharmacy_id, Vente.medicament_id.isnot(None))
        .distinct()
        .scalar_subquery()
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
            Medicament.id,
            Medicament.pid,
            Medicament.product,
            Medicament.category,
            func.coalesce(sales_sub.c.nb_ventes, 0).label("nb_ventes"),
        )
        .outerjoin(sales_sub, sales_sub.c.med_id == Medicament.id)
        .filter(Medicament.id.notin_(excluded))
        .filter((Medicament.id.in_(achat_meds)) | (Medicament.id.in_(vente_meds)))
    )

    for clause in product_search_clauses(tokenize_search(q)):
        qry = qry.filter(clause)

    rows = qry.order_by(Medicament.product.asc()).all()
    return [
        {
            "id": r.id,
            "pid": r.pid,
            "product": r.product,
            "category": r.category,
            "nb_ventes": int(r.nb_ventes or 0),
        }
        for r in rows
    ]


# ═══ BL exclusions ═══════════════════════════════════════════════════════════
# BL (bon de livraison) exclusions — PG-007, achats half.
#
# Owner-managed, non-destructive, reversible. Excluding a `delivery_ref` inserts a
# PharmacyBlExclusion row; in Comptabilité only, every product on that BL then
# drops from ventes and achats (`exclusions.py`). Deleting the row restores everything.
#
# The pharmacist finds a BL either by typing its reference, or by typing a product
# name (the app lists every BL that product appears in). The exclusion always keys
# on the reference, so it removes *all* lines of that BL at once.
#
# Feature gate: special_products (same page as product exclusions).


def _bl_aggregate(db, pharmacy_id: int, refs: list[str] | None = None):
    """Group this pharmacy's Achats by delivery_ref → one row per BL with
    supplier / date / total / line & product counts. NULL refs are ignored
    (they can't be excluded)."""
    q = db.query(
        Achat.delivery_ref.label("ref"),
        func.max(Achat.supplier).label("supplier"),
        func.max(Achat.delivery_date).label("delivery_date"),
        func.coalesce(func.sum(Achat.total), 0.0).label("total"),
        func.count(Achat.id).label("nb_lines"),
        func.count(func.distinct(Achat.medicament_id)).label("nb_products"),
    ).filter(Achat.pharmacy_id == pharmacy_id, Achat.delivery_ref.isnot(None))
    if refs is not None:
        q = q.filter(Achat.delivery_ref.in_(refs))
    return q.group_by(Achat.delivery_ref)


def _excluded_refs(db, pharmacy_id: int) -> set[str]:
    return {
        r[0]
        for r in db.query(PharmacyBlExclusion.delivery_ref).filter(PharmacyBlExclusion.pharmacy_id == pharmacy_id).all()
    }


# ─── List current exclusions ──────────────────────────────────────────────────


@router.get("/bl-exclusions/", response_model=list[BlExclusionOut])
def list_bl_exclusions(pharmacy_id: Annotated[int, member("special_products")], db: DbDep) -> list[dict]:
    """Every BL currently excluded for this pharmacy, newest first, with its
    supplier / date / total pulled back from the Achats it covers."""
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
        out.append(
            {
                "delivery_ref": r.delivery_ref,
                "supplier": a.supplier if a else None,
                "delivery_date": a.delivery_date if a else None,
                "total": round(float(a.total), 2) if a else 0.0,
                "nb_lines": int(a.nb_lines) if a else 0,
                "notes": r.notes,
                "created_at": r.created_at.isoformat() if r.created_at else "",
            }
        )
    return out


# ─── Search BLs to exclude (by ref or by product) ─────────────────────────────


@router.get("/bl-exclusions/search", response_model=list[BlSummary])
def search_bls(
    pharmacy_id: Annotated[int, member("special_products")],
    db: DbDep,
    q: Annotated[str | None, Query(min_length=2, description="BL reference (substring) or product name")] = None,
    supplier: Annotated[
        str | None, Query(min_length=1, description="Every BL of this supplier (« BL par Fournisseur »)")
    ] = None,
) -> list[dict]:
    """Find BLs matching `q` either by delivery reference (substring, accent/case
    insensitive) OR by a product they contain; or, with `supplier`, every BL of that supplier (its name as the
    supplier search gives it). Returns BL summaries, newest first; already-excluded BLs are flagged."""
    if supplier is not None:
        name = supplier.strip()
        refs = {
            r[0]
            for r in db.query(Achat.delivery_ref)
            .filter(Achat.pharmacy_id == pharmacy_id, Achat.delivery_ref.isnot(None), func.trim(Achat.supplier) == name)
            .distinct()
        }
        return _bl_summaries(db, pharmacy_id, refs, {})
    tokens = tokenize_search((q or "").strip())

    # (a) direct reference match — tokenized, accent/case-insensitive, `*`-aware
    # (prefix `LVC*`, suffix `*2606`, infix `LV*06`) via the shared search helper.
    refs: set[str] = set()
    if tokens:
        ref_rows = db.query(Achat.delivery_ref).filter(Achat.pharmacy_id == pharmacy_id, Achat.delivery_ref.isnot(None))
        for clause in supplier_search_clauses(tokens, [Achat.delivery_ref]):
            ref_rows = ref_rows.filter(clause)
        refs = {r[0] for r in ref_rows.distinct().all()}

    # (b) product match → the refs of every BL containing a matching product,
    # AND which product(s) matched (so the user recognises the BL — they remember
    # the product they bought, not the supplier/reference).
    matched_by_ref: dict[str, list[str]] = {}
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
    return _bl_summaries(db, pharmacy_id, refs, matched_by_ref)


def _bl_summaries(db, pharmacy_id: int, refs: set[str], matched_by_ref: dict[str, list[str]]) -> list[dict]:
    """These BLs as search results, newest first (`matched_products`: the products the search matched)."""
    if not refs:
        return []
    rows = _bl_aggregate(db, pharmacy_id, list(refs)).order_by(func.max(Achat.delivery_date).desc()).all()
    excluded = _excluded_refs(db, pharmacy_id)
    return [
        {
            "delivery_ref": r.ref,
            "supplier": r.supplier,
            "delivery_date": r.delivery_date,
            "total": round(float(r.total), 2),
            "nb_lines": int(r.nb_lines),
            "nb_products": int(r.nb_products),
            "already_excluded": r.ref in excluded,
            "matched_products": matched_by_ref.get(r.ref, []),
        }
        for r in rows
    ]


# ─── BL detail (product lines) for the confirmation step ──────────────────────


@router.get("/bl-exclusions/detail", response_model=BlDetail)
def bl_detail(
    pharmacy_id: Annotated[int, member("special_products")],
    db: DbDep,
    delivery_ref: Annotated[str, Query(min_length=1)],
) -> dict:
    """All product lines of one BL, so the user confirms it's the right one."""
    rows = (
        db.query(Achat, Medicament)
        .outerjoin(Medicament, Achat.medicament_id == Medicament.id)
        .filter(Achat.pharmacy_id == pharmacy_id, Achat.delivery_ref == delivery_ref)
        .all()
    )
    if not rows:
        raise ApiError(404, ErrorCode.BL_NOT_FOUND, f"Bon de livraison introuvable : {delivery_ref}", ref=delivery_ref)

    supplier = next((a.supplier for a, _ in rows if a.supplier), None)
    date = next((a.delivery_date for a, _ in rows if a.delivery_date), None)
    total = round(sum(float(a.total or 0) for a, _ in rows), 2)
    # Its products already left out on this BL only (« BL par Fournisseur » → the star of a product line).
    left_out = dict(
        db.query(PharmacyBlLineExclusion.medicament_id, PharmacyBlLineExclusion.id).filter(
            PharmacyBlLineExclusion.pharmacy_id == pharmacy_id, PharmacyBlLineExclusion.delivery_ref == delivery_ref
        )
    )
    lines = [
        {
            "product": m.product if m else None,
            "pid": m.pid if m else None,
            "medicament_id": a.medicament_id,
            "quantity": a.quantity,
            "unit_price": a.unit_price,
            "total": a.total,
            "exclusion_id": left_out.get(a.medicament_id),
        }
        for a, m in rows
    ]
    return {
        "delivery_ref": delivery_ref,
        "supplier": supplier,
        "delivery_date": date,
        "total": total,
        "nb_lines": len(rows),
        "lines": lines,
    }


# ─── Exclude a BL ─────────────────────────────────────────────────────────────


@router.post("/bl-exclusions/", response_model=BlExclusionResult, status_code=201)
def exclude_bl(body: BlExclusionCreate, pharmacy_id: Annotated[int, member("special_products")], db: DbDep) -> dict:
    """Exclude one BL by reference (+ optional note). Idempotent — an already
    excluded ref is a no-op. 404 if the ref doesn't exist in this pharmacy."""
    ref = body.delivery_ref.strip()
    if not ref:
        raise ApiError(422, ErrorCode.BL_REF_EMPTY, "Référence de livraison vide.")

    agg = _bl_aggregate(db, pharmacy_id, [ref]).first()
    if agg is None:
        raise ApiError(404, ErrorCode.BL_NOT_FOUND, f"Bon de livraison introuvable : {ref}", ref=ref)

    existing = (
        db.query(PharmacyBlExclusion)
        .filter(PharmacyBlExclusion.pharmacy_id == pharmacy_id, PharmacyBlExclusion.delivery_ref == ref)
        .first()
    )
    already = 0
    if existing:
        already = 1
        if body.notes is not None:  # allow updating the note on re-exclude
            existing.notes = body.notes
        row = existing
    else:
        row = PharmacyBlExclusion(pharmacy_id=pharmacy_id, delivery_ref=ref, notes=body.notes)
        db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "excluded": 0 if already else 1,
        "already_excluded": already,
        "item": {
            "delivery_ref": ref,
            "supplier": agg.supplier,
            "delivery_date": agg.delivery_date,
            "total": round(float(agg.total), 2),
            "nb_lines": int(agg.nb_lines),
            "notes": row.notes,
            "created_at": row.created_at.isoformat() if row.created_at else "",
        },
    }


# ─── Réintégrer (un-exclude) ──────────────────────────────────────────────────


@router.post("/bl-exclusions/reintegrate", response_model=BlReintegrateResult)
def reintegrate_bls(body: BlReintegrate, pharmacy_id: Annotated[int, member("special_products")], db: DbDep) -> dict:
    """Remove the exclusion on N BLs — their products return to Comptabilité on
    the next query. Idempotent: refs not currently excluded count as not_excluded."""
    refs = list(dict.fromkeys(r.strip() for r in body.delivery_refs if r.strip()))
    rows = (
        db.query(PharmacyBlExclusion)
        .filter(PharmacyBlExclusion.pharmacy_id == pharmacy_id, PharmacyBlExclusion.delivery_ref.in_(refs))
        .all()
    )
    found = {r.delivery_ref for r in rows}
    for r in rows:
        db.delete(r)
    db.commit()
    return {
        "reintegrated": len(rows),
        "not_excluded": len([r for r in refs if r not in found]),
        "delivery_refs": refs,
    }


# ═══ BL line exclusions ══════════════════════════════════════════════════════
# « Exclure un produit d'un BL »: pick a product → every BL it was bought on → tick some. In
# Comptabilité only, those achat lines drop (`service.achat_filter`); the product's other BLs and
# its ventes stay. The whole-BL exclusions above keep their rule.
#
# Feature gate: special_products (same page).


def _line_aggregate(db, pharmacy_id: int, medicament_id: int | None = None):
    """This pharmacy's achats grouped by (BL, product): supplier / date / quantity / total / lines."""
    q = db.query(
        Achat.delivery_ref.label("ref"),
        Achat.medicament_id.label("med"),
        func.max(Achat.supplier).label("supplier"),
        func.max(Achat.delivery_date).label("delivery_date"),
        func.coalesce(func.sum(Achat.quantity), 0.0).label("quantity"),
        func.coalesce(func.sum(Achat.total), 0.0).label("total"),
        func.count(Achat.id).label("nb_lines"),
    ).filter(Achat.pharmacy_id == pharmacy_id, Achat.delivery_ref.isnot(None), Achat.medicament_id.isnot(None))
    if medicament_id is not None:
        q = q.filter(Achat.medicament_id == medicament_id)
    return q.group_by(Achat.delivery_ref, Achat.medicament_id)


@router.get("/bl-line-exclusions/", response_model=list[BlLineExclusionOut])
def list_bl_line_exclusions(pharmacy_id: Annotated[int, member("special_products")], db: DbDep) -> list[dict]:
    """Every product-on-a-BL currently excluded, newest first, with its BL's facts and its quantity."""
    rows = (
        db.query(PharmacyBlLineExclusion, Medicament)
        .join(Medicament, PharmacyBlLineExclusion.medicament_id == Medicament.id)
        .filter(PharmacyBlLineExclusion.pharmacy_id == pharmacy_id)
        .order_by(PharmacyBlLineExclusion.created_at.desc(), PharmacyBlLineExclusion.id.desc())
        .all()
    )
    if not rows:
        return []
    refs = {x.delivery_ref for x, _ in rows}
    agg = {(a.ref, a.med): a for a in _line_aggregate(db, pharmacy_id).filter(Achat.delivery_ref.in_(refs)).all()}
    out = []
    for x, med in rows:
        a = agg.get((x.delivery_ref, x.medicament_id))
        out.append(
            {
                "id": x.id,
                "delivery_ref": x.delivery_ref,
                "supplier": a.supplier if a else None,
                "delivery_date": a.delivery_date if a else None,
                "medicament_id": med.id,
                "pid": med.pid,
                "product": med.product,
                "quantity": float(a.quantity) if a else 0.0,
                "total": round(float(a.total), 2) if a else 0.0,
                "notes": x.notes,
                "created_at": x.created_at.isoformat() if x.created_at else "",
            }
        )
    return out


@router.post("/bl-line-exclusions/", response_model=BlLineExclusionResult, status_code=201)
def exclude_bl_lines(
    body: BlLineExclusionCreate, pharmacy_id: Annotated[int, member("special_products")], db: DbDep
) -> dict:
    """Leave this product out of Comptabilité on these BLs only (+ optional note). Idempotent per
    BL; 404 when the product was not bought on one of them."""
    refs = list(dict.fromkeys(r.strip() for r in body.delivery_refs if r.strip()))
    if not refs:
        raise ApiError(422, ErrorCode.BL_REF_EMPTY, "Référence de livraison vide.")
    held = {
        a.ref for a in _line_aggregate(db, pharmacy_id, body.medicament_id).filter(Achat.delivery_ref.in_(refs)).all()
    }
    missing = [r for r in refs if r not in held]
    if missing:
        raise ApiError(404, ErrorCode.BL_NOT_FOUND, f"Bon de livraison introuvable : {missing[0]}", ref=missing[0])
    existing = {
        r[0]
        for r in db.query(PharmacyBlLineExclusion.delivery_ref).filter(
            PharmacyBlLineExclusion.pharmacy_id == pharmacy_id,
            PharmacyBlLineExclusion.medicament_id == body.medicament_id,
            PharmacyBlLineExclusion.delivery_ref.in_(refs),
        )
    }
    rows = [
        PharmacyBlLineExclusion(
            pharmacy_id=pharmacy_id, delivery_ref=ref, medicament_id=body.medicament_id, notes=body.notes
        )
        for ref in refs
        if ref not in existing
    ]
    db.add_all(rows)
    db.commit()
    ids = [
        r[0]
        for r in db.query(PharmacyBlLineExclusion.id).filter(
            PharmacyBlLineExclusion.pharmacy_id == pharmacy_id,
            PharmacyBlLineExclusion.medicament_id == body.medicament_id,
            PharmacyBlLineExclusion.delivery_ref.in_(refs),
        )
    ]
    return {"excluded": len(rows), "already_excluded": len(existing), "ids": sorted(ids)}


@router.post("/bl-line-exclusions/reintegrate", response_model=BlLineReintegrateResult)
def reintegrate_bl_lines(
    body: BlLineReintegrate, pharmacy_id: Annotated[int, member("special_products")], db: DbDep
) -> dict:
    """Back into Comptabilité. Idempotent: ids not excluded (any more) count as not_excluded."""
    ids = list(dict.fromkeys(body.ids))
    rows = (
        db.query(PharmacyBlLineExclusion)
        .filter(PharmacyBlLineExclusion.pharmacy_id == pharmacy_id, PharmacyBlLineExclusion.id.in_(ids))
        .all()
    )
    for r in rows:
        db.delete(r)
    db.commit()
    return {"reintegrated": len(rows), "not_excluded": len(ids) - len(rows)}


# ═══ Supplier exclusions ═════════════════════════════════════════════════════
# Supplier (fournisseur) exclusions — achats-side sibling of BL exclusions.
#
# Owner-managed, non-destructive, reversible. Excluding a supplier NAME inserts a
# PharmacySupplierExclusion row; in Comptabilité only, every product bought from
# that supplier (accent/case-insensitive match) then drops from ventes and achats
# (`exclusions.py`). Deleting the row restores everything.
#
# Feature gate: special_products (same page as product / BL exclusions).


def _norm(name: str | None) -> str:
    return strip_accents(name or "").lower().strip()


def _supplier_aggregate(db, pharmacy_id: int, suppliers: list[str] | None = None):
    """Group this pharmacy's Achats by supplier → one row per supplier with
    total / line & product counts / last date. NULL suppliers are ignored. Names are
    compared trimmed: Sobrus writes some with a space at the end (« … FRANCHISE »)."""
    name = func.trim(Achat.supplier)
    q = db.query(
        name.label("supplier"),
        func.coalesce(func.sum(Achat.total), 0.0).label("total"),
        func.count(Achat.id).label("nb_lines"),
        func.count(func.distinct(Achat.medicament_id)).label("nb_products"),
        func.max(Achat.delivery_date).label("last_date"),
    ).filter(Achat.pharmacy_id == pharmacy_id, Achat.supplier.isnot(None))
    if suppliers is not None:
        q = q.filter(name.in_([s.strip() for s in suppliers]))
    return q.group_by(name)


def _excluded_norm_set(db, pharmacy_id: int) -> set[str]:
    """Normalized (accent/case-insensitive) set of currently-excluded supplier names."""
    return {
        _norm(r[0])
        for r in db.query(PharmacySupplierExclusion.supplier)
        .filter(PharmacySupplierExclusion.pharmacy_id == pharmacy_id)
        .all()
    }


# ─── List current exclusions ──────────────────────────────────────────────────


@router.get("/supplier-exclusions/", response_model=list[SupplierExclusionOut])
def list_supplier_exclusions(pharmacy_id: Annotated[int, member("special_products")], db: DbDep) -> list[dict]:
    """Every supplier currently excluded for this pharmacy, newest first, with its
    aggregated totals pulled back from the Achats it covers."""
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
        a = agg.get(r.supplier.strip())
        out.append(
            {
                "supplier": r.supplier,
                "total": round(float(a.total), 2) if a else 0.0,
                "nb_lines": int(a.nb_lines) if a else 0,
                "nb_products": int(a.nb_products) if a else 0,
                "last_date": a.last_date if a else None,
                "notes": r.notes,
                "created_at": r.created_at.isoformat() if r.created_at else "",
            }
        )
    return out


# ─── Search suppliers to exclude (by name) ────────────────────────────────────


@router.get("/supplier-exclusions/search", response_model=list[SupplierSummary])
def search_suppliers(
    pharmacy_id: Annotated[int, member("special_products")],
    db: DbDep,
    q: Annotated[str, Query(min_length=2, description="Supplier name (accent/case-insensitive, `*` wildcard)")],
) -> list[dict]:
    """Find suppliers matching `q` (accent/case-insensitive, `*`-aware) with their
    aggregated purchase totals so the user can pick one; already-excluded
    suppliers are flagged."""
    tokens = tokenize_search(q.strip())
    if not tokens:
        return []

    agg = _supplier_aggregate(db, pharmacy_id)
    for clause in supplier_search_clauses(tokens, [Achat.supplier]):
        agg = agg.filter(clause)
    rows = agg.order_by(func.sum(Achat.total).desc()).all()

    excluded = _excluded_norm_set(db, pharmacy_id)
    return [
        {
            "supplier": r.supplier,
            "total": round(float(r.total), 2),
            "nb_lines": int(r.nb_lines),
            "nb_products": int(r.nb_products),
            "last_date": r.last_date,
            "already_excluded": _norm(r.supplier) in excluded,
        }
        for r in rows
    ]


# ─── Exclude a supplier ───────────────────────────────────────────────────────


@router.post("/supplier-exclusions/", response_model=SupplierExclusionResult, status_code=201)
def exclude_supplier(
    body: SupplierExclusionCreate, pharmacy_id: Annotated[int, member("special_products")], db: DbDep
) -> dict:
    """Exclude one supplier by name (+ optional note). Idempotent — an already
    excluded supplier is a no-op. 404 if the supplier has no Achats in this pharmacy."""
    supplier = body.supplier.strip()
    if not supplier:
        raise ApiError(422, ErrorCode.SUPPLIER_EMPTY, "Nom de fournisseur vide.")

    agg = _supplier_aggregate(db, pharmacy_id, [supplier]).first()
    if agg is None:
        raise ApiError(404, ErrorCode.SUPPLIER_NOT_FOUND, f"Fournisseur introuvable : {supplier}", supplier=supplier)

    # Same name ignoring case / accents = same supplier (the search flags it the same way).
    existing = next(
        (
            r
            for r in db.query(PharmacySupplierExclusion).filter(PharmacySupplierExclusion.pharmacy_id == pharmacy_id)
            if _norm(r.supplier) == _norm(supplier)
        ),
        None,
    )
    already = 0
    if existing:
        already = 1
        if body.notes is not None:  # allow updating the note on re-exclude
            existing.notes = body.notes
        row = existing
    else:
        row = PharmacySupplierExclusion(pharmacy_id=pharmacy_id, supplier=supplier, notes=body.notes)
        db.add(row)
    db.commit()
    db.refresh(row)
    return {
        "excluded": 0 if already else 1,
        "already_excluded": already,
        "item": {
            "supplier": supplier,
            "total": round(float(agg.total), 2),
            "nb_lines": int(agg.nb_lines),
            "nb_products": int(agg.nb_products),
            "last_date": agg.last_date,
            "notes": row.notes,
            "created_at": row.created_at.isoformat() if row.created_at else "",
        },
    }


# ─── Réintégrer (un-exclude) ──────────────────────────────────────────────────


@router.post("/supplier-exclusions/reintegrate", response_model=SupplierReintegrateResult)
def reintegrate_suppliers(
    body: SupplierReintegrate, pharmacy_id: Annotated[int, member("special_products")], db: DbDep
) -> dict:
    """Remove the exclusion on N suppliers — their products return to Comptabilité
    on the next query. Idempotent: names not currently excluded count as not_excluded."""
    suppliers = list(dict.fromkeys(s.strip() for s in body.suppliers if s.strip()))
    rows = (
        db.query(PharmacySupplierExclusion)
        .filter(PharmacySupplierExclusion.pharmacy_id == pharmacy_id, PharmacySupplierExclusion.supplier.in_(suppliers))
        .all()
    )
    found = {r.supplier for r in rows}
    for r in rows:
        db.delete(r)
    db.commit()
    return {
        "reintegrated": len(rows),
        "not_excluded": len([s for s in suppliers if s not in found]),
        "suppliers": suppliers,
    }


# ═══ Notes ═══════════════════════════════════════════════════════════════════
# « Ajouter une note » on an excluded line (after the exclusion: excluding is one click). Empty
# text = no note. 404 when the line is not excluded (any more).


def _note(text: str | None) -> str | None:
    return (text or "").strip() or None


@router.put("/special-products/note", status_code=204)
def note_special_product(
    body: SpecialProductNote, pharmacy_id: Annotated[int, member("special_products")], db: DbDep
) -> None:
    row = (
        db.query(PharmacyMedicamentStatus)
        .filter(
            PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
            PharmacyMedicamentStatus.medicament_id == body.medicament_id,
            PharmacyMedicamentStatus.declared == False,  # noqa: E712
        )
        .first()
    )
    if row is None:
        raise ApiError(404, ErrorCode.MEDICAMENT_NOT_FOUND, "Produit exclu introuvable.")
    row.notes = _note(body.notes)
    db.commit()


@router.put("/bl-exclusions/note", status_code=204)
def note_bl(body: BlNote, pharmacy_id: Annotated[int, member("special_products")], db: DbDep) -> None:
    ref = body.delivery_ref.strip()
    row = (
        db.query(PharmacyBlExclusion)
        .filter(PharmacyBlExclusion.pharmacy_id == pharmacy_id, PharmacyBlExclusion.delivery_ref == ref)
        .first()
    )
    if row is None:
        raise ApiError(404, ErrorCode.BL_NOT_FOUND, f"Bon de livraison introuvable : {ref}", ref=ref)
    row.notes = _note(body.notes)
    db.commit()


@router.put("/supplier-exclusions/note", status_code=204)
def note_supplier(body: SupplierNote, pharmacy_id: Annotated[int, member("special_products")], db: DbDep) -> None:
    norm = _norm(body.supplier)
    row = next(
        (
            r
            for r in db.query(PharmacySupplierExclusion).filter(PharmacySupplierExclusion.pharmacy_id == pharmacy_id)
            if _norm(r.supplier) == norm
        ),
        None,
    )
    if row is None:
        raise ApiError(
            404, ErrorCode.SUPPLIER_NOT_FOUND, f"Fournisseur introuvable : {body.supplier}", supplier=body.supplier
        )
    row.notes = _note(body.notes)
    db.commit()


@router.put("/bl-line-exclusions/note", status_code=204)
def note_bl_line(body: BlLineNote, pharmacy_id: Annotated[int, member("special_products")], db: DbDep) -> None:
    row = (
        db.query(PharmacyBlLineExclusion)
        .filter(PharmacyBlLineExclusion.pharmacy_id == pharmacy_id, PharmacyBlLineExclusion.id == body.id)
        .first()
    )
    if row is None:
        raise ApiError(404, ErrorCode.BL_NOT_FOUND, "Ligne de BL exclue introuvable.")
    row.notes = _note(body.notes)
    db.commit()
