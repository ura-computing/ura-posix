"""Shared subqueries + filters for "exclude from accounting" semantics.

Two kinds of exclusion exist per pharmacy:
- **Non-declared medicaments** — admin marked a product as not-in-our-stats via the
  catalog-request flow. A row in `pharmacy_medicament_status` with `declared=False`.
- **BL exclusions** (PG-007 achats-half) — pharmacist excluded a specific delivery_ref
  from accounting. Achat rows with that ref disappear from every aggregate.

Both filters apply to Achat-side aggregates wherever the dashboard already filters
non-declared products. Use `achat_bl_filter()` rather than inlining the subquery —
SQL's `NULL NOT IN (subquery)` evaluates to NULL → silently drops rows with NULL refs.
"""
from sqlalchemy import or_
from sqlalchemy.orm import Session

from models import Achat, PharmacyBlExclusion, PharmacyMedicamentStatus


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