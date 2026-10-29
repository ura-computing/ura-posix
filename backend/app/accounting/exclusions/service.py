"""Comptabilité exclusions — the ONE place that decides what drops out.

Four kinds, all owner-managed and reversible (Produits spéciaux page):
- **Special product** — `pharmacy_medicament_status.declared = False`.
- **BL** — an excluded `Achat.delivery_ref`.
- **Supplier** — an excluded `Achat.supplier` name (accent/case-insensitive).
- **BL line** — one product on one BL (`pharmacy_bl_line_exclusions`).

The first three become ONE medicament set (`excluded_medicaments_select`): every product on an
excluded BL and every product of an excluded supplier drops from BOTH ventes and
achats, exactly like a special product. A BL line removes only those achat lines
(`achat_filter`): the product's other BLs and its ventes stay.

APPLICATION RULE (user decision 2026-08-01): applied ONLY in Comptabilité
(`include_non_declared=False`). Every other page includes everything, so callers
add `vente_filter()` / `achat_filter()` only when `include_non_declared` is False.
"""

from sqlalchemy import and_, exists, func, select, union
from sqlalchemy.orm import Session

from app.core.models import (
    Achat,
    PharmacyBlExclusion,
    PharmacyBlLineExclusion,
    PharmacyMedicamentStatus,
    PharmacySupplierExclusion,
    Vente,
)


def _bl_excluded_sub(db: Session, pharmacy_id: int):
    """Scalar subquery of the delivery_refs the pharmacy excluded."""
    return (
        db.query(PharmacyBlExclusion.delivery_ref)
        .filter(PharmacyBlExclusion.pharmacy_id == pharmacy_id)
        .scalar_subquery()
    )


def _supplier_excluded_sub(db: Session, pharmacy_id: int):
    """Scalar subquery of the NORMALIZED (unaccent+lower+trim) supplier names the pharmacy
    excluded, so the match against the free-text Achat.supplier is accent/case-insensitive and
    ignores spaces at both ends (Sobrus writes some names with a trailing space)."""
    return (
        db.query(func.unaccent(func.lower(func.trim(PharmacySupplierExclusion.supplier))))
        .filter(PharmacySupplierExclusion.pharmacy_id == pharmacy_id)
        .scalar_subquery()
    )


def excluded_medicaments_select(db: Session, pharmacy_id: int):
    """medicament_ids excluded from comptabilité — the SINGLE source of truth:
    special products ∪ every product on an excluded BL ∪ every product of an
    excluded supplier."""
    special = select(PharmacyMedicamentStatus.medicament_id).where(
        PharmacyMedicamentStatus.pharmacy_id == pharmacy_id,
        PharmacyMedicamentStatus.declared == False,  # noqa: E712
    )
    on_excluded_bl = select(Achat.medicament_id).where(
        Achat.pharmacy_id == pharmacy_id,
        Achat.medicament_id.isnot(None),
        Achat.delivery_ref.in_(_bl_excluded_sub(db, pharmacy_id)),
    )
    from_excluded_supplier = select(Achat.medicament_id).where(
        Achat.pharmacy_id == pharmacy_id,
        Achat.medicament_id.isnot(None),
        func.unaccent(func.lower(func.trim(Achat.supplier))).in_(_supplier_excluded_sub(db, pharmacy_id)),
    )
    combined = union(special, on_excluded_bl, from_excluded_supplier).subquery()
    return select(combined.c.medicament_id)


def vente_filter(db: Session, pharmacy_id: int):
    """WHERE clause keeping the Vente rows whose product is not excluded."""
    return Vente.medicament_id.notin_(excluded_medicaments_select(db, pharmacy_id))


def achat_filter(db: Session, pharmacy_id: int):
    """WHERE clause keeping the Achat rows whose product is not excluded and that are not an
    excluded BL line (this product on this BL). No BL line excluded (most pharmacies): no line test."""
    kept = Achat.medicament_id.notin_(excluded_medicaments_select(db, pharmacy_id))
    if db.query(PharmacyBlLineExclusion.id).filter(PharmacyBlLineExclusion.pharmacy_id == pharmacy_id).first() is None:
        return kept
    excluded_line = exists().where(
        PharmacyBlLineExclusion.pharmacy_id == pharmacy_id,
        PharmacyBlLineExclusion.delivery_ref == Achat.delivery_ref,
        PharmacyBlLineExclusion.medicament_id == Achat.medicament_id,
    )
    return and_(kept, ~excluded_line)
