"""Shared subqueries + filters for "exclude from accounting" semantics.

Two kinds of exclusion exist per pharmacy:
- **Non-declared medicaments** — admin marked a product as not-in-our-stats via the
  catalog-request flow. A row in `pharmacy_medicament_status` with `declared=False`.
- **BL exclusions** (PG-007 achats-half) — pharmacist excluded a specific delivery_ref
  from accounting. Achat rows with that ref disappear from every aggregate.
- **Supplier exclusions** — pharmacist excluded a normalized supplier name.

Both filters apply to Achat-side aggregates wherever the dashboard already filters
non-declared products. Use `achat_bl_filter()` rather than inlining the subquery —
SQL's `NULL NOT IN (subquery)` evaluates to NULL → silently drops rows with NULL refs.

APPLICATION RULE (user decision 2026-08-01): excluded/special products, excluded
suppliers and excluded BLs are **included everywhere except /comptabilite**.
Every consumer gates the exclusion predicates on `include_non_declared`:
`True` (the default for every section) → NO exclusion clauses are added;
`False` (comptabilite only) → the full non-declared + BL + supplier filters apply.
"""
from sqlalchemy import and_, func, or_, select, union
from sqlalchemy.orm import Session

from models import (
    Achat,
    PharmacyBlExclusion,
    PharmacyMedicamentStatus,
    PharmacySupplierExclusion,
)


def non_declared_sub(db: Session, pharmacy_id: int):
    """Scalar subquery of medicament_ids the pharmacy marked as non-declared.
    Used with .notin_() — must be scalar_subquery() to avoid SQLA 2.0 warning."""
    return (
        db.query(PharmacyMedicamentStatus.medicament_id)
        .filter(
            PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
            PharmacyMedicamentStatus.declared == False,
        )
        .scalar_subquery()
    )


def bl_excluded_sub(db: Session, pharmacy_id: int):
    """Scalar subquery of delivery_refs the pharmacy excluded from accounting (PG-007)."""
    return (
        db.query(PharmacyBlExclusion.delivery_ref)
        .filter(PharmacyBlExclusion.pharmacy_id == pharmacy_id)
        .scalar_subquery()
    )


def achat_bl_filter(db: Session, pharmacy_id: int):
    """SQLAlchemy clause that lets an Achat row through the BL-exclusion check.
    NULL refs are kept (the Sobrus import sometimes omits BL ref); excluded refs drop."""
    return or_(
        Achat.delivery_ref.is_(None),
        Achat.delivery_ref.notin_(bl_excluded_sub(db, pharmacy_id)),
    )


def supplier_excluded_sub(db: Session, pharmacy_id: int):
    """Scalar subquery of NORMALIZED (unaccent+lower) supplier names the pharmacy
    excluded. Normalized so the match is accent/case-insensitive against the
    free-text Achat.supplier column."""
    return (
        db.query(func.unaccent(func.lower(PharmacySupplierExclusion.supplier)))
        .filter(PharmacySupplierExclusion.pharmacy_id == pharmacy_id)
        .scalar_subquery()
    )


def achat_supplier_filter(db: Session, pharmacy_id: int):
    """SQLAlchemy clause that lets an Achat row through the supplier-exclusion
    check. NULL suppliers are kept (SQL NOT IN-vs-NULL gotcha); rows whose
    normalized supplier matches an excluded name drop. Mirrors achat_bl_filter."""
    return or_(
        Achat.supplier.is_(None),
        func.unaccent(func.lower(Achat.supplier)).notin_(supplier_excluded_sub(db, pharmacy_id)),
    )


def achat_exclusion_filter(db: Session, pharmacy_id: int):
    """The full Achat-side exclusion clause = BL-exclusion AND supplier-exclusion.
    Every aggregate that filters out excluded purchases uses THIS (so the two
    exclusion kinds can never drift apart)."""
    return and_(
        achat_bl_filter(db, pharmacy_id),
        achat_supplier_filter(db, pharmacy_id),
    )


def excluded_medicaments_select(db: Session, pharmacy_id: int):
    """medicament_ids excluded from comptabilité — the SINGLE source of truth.

    Unifies the three exclusion kinds into one medicament set so that excluding a
    BL or a fournisseur behaves EXACTLY like excluding a special product: every
    product on that BL, and every product from that supplier, is dropped from BOTH
    achats AND ventes (med-level). Use with `.notin_()` on Vente.medicament_id and
    Achat.medicament_id. Only applied when include_non_declared=False (comptabilité);
    everywhere else the products show normally.
    """
    special = select(PharmacyMedicamentStatus.medicament_id).where(
        PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
        PharmacyMedicamentStatus.declared == False,  # noqa: E712
    )
    on_excluded_bl = select(Achat.medicament_id).where(
        Achat.pharmacy_id == pharmacy_id,
        Achat.medicament_id.isnot(None),
        Achat.delivery_ref.in_(bl_excluded_sub(db, pharmacy_id)),
    )
    from_excluded_supplier = select(Achat.medicament_id).where(
        Achat.pharmacy_id == pharmacy_id,
        Achat.medicament_id.isnot(None),
        func.unaccent(func.lower(Achat.supplier)).in_(supplier_excluded_sub(db, pharmacy_id)),
    )
    combined = union(special, on_excluded_bl, from_excluded_supplier).subquery()
    return select(combined.c.medicament_id)