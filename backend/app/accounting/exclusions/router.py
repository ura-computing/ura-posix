"""Owner exclusions: special products, BLs, a product on some BLs, suppliers. They only change Comptabilité
(`exclusions.py` at the backend root); nothing is deleted, réintégrer restores it."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.accounting.exclusions import exclusion_queries
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
from app.core.database import DbDep
from app.core.permissions import member

router = APIRouter(tags=["exclusions"])


@router.get("/special-products/", response_model=list[SpecialProductOut])
def list_special_products(pharmacy_id: Annotated[int, member("special_products")], db: DbDep) -> list[dict]:
    """All medicaments currently marked spécial for this pharmacy, newest first."""
    return exclusion_queries.list_special_products(pharmacy_id=pharmacy_id, db=db)


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
    return exclusion_queries.exclude_products(body=body, pharmacy_id=pharmacy_id, db=db)


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
    return exclusion_queries.reintegrate_products(body=body, pharmacy_id=pharmacy_id, db=db)


@router.get("/special-products/suggestions", response_model=list[MedicamentSuggestion])
def medicament_suggestions(
    pharmacy_id: Annotated[int, member("special_products")],
    db: DbDep,
    q: Annotated[str, Query(min_length=2, description="≥2 chars; tokenized + accent-insensitive")],
) -> list[dict]:
    """Autocomplete: medicaments the pharmacy actually has Achats OR Ventes for,
    minus those already marked spécial. Limit 10."""
    return exclusion_queries.medicament_suggestions(pharmacy_id=pharmacy_id, db=db, q=q)


@router.get("/bl-exclusions/", response_model=list[BlExclusionOut])
def list_bl_exclusions(pharmacy_id: Annotated[int, member("special_products")], db: DbDep) -> list[dict]:
    """Every BL currently excluded for this pharmacy, newest first, with its
    supplier / date / total pulled back from the Achats it covers."""
    return exclusion_queries.list_bl_exclusions(pharmacy_id=pharmacy_id, db=db)


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
    return exclusion_queries.search_bls(pharmacy_id=pharmacy_id, db=db, q=q, supplier=supplier)


@router.get("/bl-exclusions/detail", response_model=BlDetail)
def bl_detail(
    pharmacy_id: Annotated[int, member("special_products")],
    db: DbDep,
    delivery_ref: Annotated[str, Query(min_length=1)],
) -> dict:
    """All product lines of one BL, so the user confirms it's the right one."""
    return exclusion_queries.bl_detail(pharmacy_id=pharmacy_id, db=db, delivery_ref=delivery_ref)


@router.post("/bl-exclusions/", response_model=BlExclusionResult, status_code=201)
def exclude_bl(body: BlExclusionCreate, pharmacy_id: Annotated[int, member("special_products")], db: DbDep) -> dict:
    """Exclude one BL by reference (+ optional note). Idempotent — an already
    excluded ref is a no-op. 404 if the ref doesn't exist in this pharmacy."""
    return exclusion_queries.exclude_bl(body=body, pharmacy_id=pharmacy_id, db=db)


@router.post("/bl-exclusions/reintegrate", response_model=BlReintegrateResult)
def reintegrate_bls(body: BlReintegrate, pharmacy_id: Annotated[int, member("special_products")], db: DbDep) -> dict:
    """Remove the exclusion on N BLs — their products return to Comptabilité on
    the next query. Idempotent: refs not currently excluded count as not_excluded."""
    return exclusion_queries.reintegrate_bls(body=body, pharmacy_id=pharmacy_id, db=db)


@router.get("/bl-line-exclusions/", response_model=list[BlLineExclusionOut])
def list_bl_line_exclusions(pharmacy_id: Annotated[int, member("special_products")], db: DbDep) -> list[dict]:
    """Every product-on-a-BL currently excluded, newest first, with its BL's facts and its quantity."""
    return exclusion_queries.list_bl_line_exclusions(pharmacy_id=pharmacy_id, db=db)


@router.post("/bl-line-exclusions/", response_model=BlLineExclusionResult, status_code=201)
def exclude_bl_lines(
    body: BlLineExclusionCreate, pharmacy_id: Annotated[int, member("special_products")], db: DbDep
) -> dict:
    """Leave this product out of Comptabilité on these BLs only (+ optional note). Idempotent per
    BL; 404 when the product was not bought on one of them."""
    return exclusion_queries.exclude_bl_lines(body=body, pharmacy_id=pharmacy_id, db=db)


@router.post("/bl-line-exclusions/reintegrate", response_model=BlLineReintegrateResult)
def reintegrate_bl_lines(
    body: BlLineReintegrate, pharmacy_id: Annotated[int, member("special_products")], db: DbDep
) -> dict:
    """Back into Comptabilité. Idempotent: ids not excluded (any more) count as not_excluded."""
    return exclusion_queries.reintegrate_bl_lines(body=body, pharmacy_id=pharmacy_id, db=db)


@router.get("/supplier-exclusions/", response_model=list[SupplierExclusionOut])
def list_supplier_exclusions(pharmacy_id: Annotated[int, member("special_products")], db: DbDep) -> list[dict]:
    """Every supplier currently excluded for this pharmacy, newest first, with its
    aggregated totals pulled back from the Achats it covers."""
    return exclusion_queries.list_supplier_exclusions(pharmacy_id=pharmacy_id, db=db)


@router.get("/supplier-exclusions/search", response_model=list[SupplierSummary])
def search_suppliers(
    pharmacy_id: Annotated[int, member("special_products")],
    db: DbDep,
    q: Annotated[str, Query(min_length=2, description="Supplier name (accent/case-insensitive, `*` wildcard)")],
) -> list[dict]:
    """Find suppliers matching `q` (accent/case-insensitive, `*`-aware) with their
    aggregated purchase totals so the user can pick one; already-excluded
    suppliers are flagged."""
    return exclusion_queries.search_suppliers(pharmacy_id=pharmacy_id, db=db, q=q)


@router.post("/supplier-exclusions/", response_model=SupplierExclusionResult, status_code=201)
def exclude_supplier(
    body: SupplierExclusionCreate, pharmacy_id: Annotated[int, member("special_products")], db: DbDep
) -> dict:
    """Exclude one supplier by name (+ optional note). Idempotent — an already
    excluded supplier is a no-op. 404 if the supplier has no Achats in this pharmacy."""
    return exclusion_queries.exclude_supplier(body=body, pharmacy_id=pharmacy_id, db=db)


@router.post("/supplier-exclusions/reintegrate", response_model=SupplierReintegrateResult)
def reintegrate_suppliers(
    body: SupplierReintegrate, pharmacy_id: Annotated[int, member("special_products")], db: DbDep
) -> dict:
    """Remove the exclusion on N suppliers — their products return to Comptabilité
    on the next query. Idempotent: names not currently excluded count as not_excluded."""
    return exclusion_queries.reintegrate_suppliers(body=body, pharmacy_id=pharmacy_id, db=db)


@router.put("/special-products/note", status_code=204)
def note_special_product(
    body: SpecialProductNote, pharmacy_id: Annotated[int, member("special_products")], db: DbDep
) -> None:
    return exclusion_queries.note_special_product(body=body, pharmacy_id=pharmacy_id, db=db)


@router.put("/bl-exclusions/note", status_code=204)
def note_bl(body: BlNote, pharmacy_id: Annotated[int, member("special_products")], db: DbDep) -> None:
    return exclusion_queries.note_bl(body=body, pharmacy_id=pharmacy_id, db=db)


@router.put("/supplier-exclusions/note", status_code=204)
def note_supplier(body: SupplierNote, pharmacy_id: Annotated[int, member("special_products")], db: DbDep) -> None:
    return exclusion_queries.note_supplier(body=body, pharmacy_id=pharmacy_id, db=db)


@router.put("/bl-line-exclusions/note", status_code=204)
def note_bl_line(body: BlLineNote, pharmacy_id: Annotated[int, member("special_products")], db: DbDep) -> None:
    return exclusion_queries.note_bl_line(body=body, pharmacy_id=pharmacy_id, db=db)
