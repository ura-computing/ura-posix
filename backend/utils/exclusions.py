"""Shared subqueries for "exclude from accounting" filters.

`non_declared_sub` is built inline in many places (it predates this module — we
left those alone to keep this PR focused). `bl_excluded_sub` is new (PG-007
achats-half) so we centralise it here from day one. Use both side-by-side in
every Achat-side aggregation that already excludes non-declared medicaments.
"""
from sqlalchemy import or_
from sqlalchemy.orm import Session

from models import Achat, PharmacyBlExclusion, PharmacyMedicamentStatus


def non_declared_sub(db: Session, pharmacy_id: int):
    """Subquery of medicament_ids the pharmacy marked as non-declared (PharmacyMedicamentStatus.declared == False)."""
    return (
        db.query(PharmacyMedicamentStatus.medicament_id)
        .filter(
            PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
            PharmacyMedicamentStatus.declared == False,
        )
        .subquery()
    )


def bl_excluded_sub(db: Session, pharmacy_id: int):
    """Subquery of delivery_refs the pharmacy excluded from accounting (PG-007)."""
    return (
        db.query(PharmacyBlExclusion.delivery_ref)
        .filter(PharmacyBlExclusion.pharmacy_id == pharmacy_id)
        .subquery()
    )


def achat_bl_filter(db: Session, pharmacy_id: int):
    """SQLAlchemy clause: an Achat row passes the BL-exclusion check.

    `Achat.delivery_ref` is nullable (Sobrus often omits the BL ref on imports) and
    SQL `NULL NOT IN (subquery)` evaluates to NULL — which the WHERE clause treats as
    false, silently dropping the row. So we explicitly allow NULL refs through. This
    helper is the only correct way to apply the PG-007 exclusion; callers must not
    inline `Achat.delivery_ref.notin_(bl_excluded_sub(...))` directly.
    """
    return or_(
        Achat.delivery_ref.is_(None),
        Achat.delivery_ref.notin_(bl_excluded_sub(db, pharmacy_id)),
    )
