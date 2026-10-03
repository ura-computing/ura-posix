"""Shared SQL building blocks for the analytics queries (Rapport, Comptabilité,
Analyses, Stock, ventes ledger). One definition per formula so pages can't drift.
Moves into backend/analytics/ with the domain split (PLAN.md §6).
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import case as sa_case, func, or_, select
from sqlalchemy.orm import Session

from exclusions import achat_filter, vente_filter
from models import Achat, Medicament, Vente


def pharma_expr():
    """SQLAlchemy expression: True = pharmacie, False = parapharmacie.
    Admin product_type override takes precedence; falls back to category keywords
    (same keyword set as csv_parse.classify_product_type)."""
    auto = sa_case(
        (func.lower(Medicament.category).contains("edicament"), True),
        (func.lower(Medicament.category).contains("édicament"), True),
        (func.lower(Medicament.category).contains("oméopath"), True),
        (func.lower(Medicament.category).contains("omeopath"), True),
        (func.lower(Medicament.category).contains("iététique"), True),
        (func.lower(Medicament.category).contains("ietetique"), True),
        else_=False,
    )
    return sa_case(
        (Medicament.product_type == "pharmacie", True),
        (Medicament.product_type == "parapharmacie", False),
        else_=auto,
    )


def category_filter(category_type: str) -> list:
    """Mixte / Pharmacie / Parapharmacie segment → WHERE clauses (caller joins Medicament)."""
    if category_type == "pharmacie":
        return [Medicament.id.in_(_product_ids(pharma=True))]
    if category_type == "parapharmacie":
        # A sale with no product counts as parapharmacie (pharma_expr()'s else branch).
        return [or_(Medicament.id.is_(None), Medicament.id.in_(_product_ids(pharma=False)))]
    return []


def _product_ids(pharma: bool):
    """Ids of the pharmacie (or parapharmacie) products. Classifies the ~400 products
    once, instead of running pharma_expr() on each of the 100k joined sale lines.
    correlate(None): its own `medicaments` scan, not tied to the outer query's row."""
    return select(Medicament.id).where(pharma_expr() == pharma).correlate(None)


def ca_sum():
    """CA = Σ qty × coalesce(PPV, unit_price) — Rapport, Comptabilité and Analyses
    KPIs (caller joins Medicament)."""
    return func.sum(Vente.quantity * func.coalesce(Medicament.ppv, Vente.unit_price))


def avg_pu_expr():
    """Weighted average purchase price: Σ(PU × qty) / Σ qty."""
    return func.sum(Achat.unit_price * Achat.quantity) / func.sum(Achat.quantity)


def avg_pu_subquery(db: Session, *filters, id_label: str = "medicament_id", label: str = "avg_pu"):
    """Subquery: one row per medicament with its weighted average PU over the Achat
    rows matching `filters`."""
    return (
        db.query(Achat.medicament_id.label(id_label), avg_pu_expr().label(label))
        .filter(*filters)
        .group_by(Achat.medicament_id)
        .subquery()
    )


@dataclass(frozen=True)
class Filters:
    """Pharmacy + inclusive date window + Comptabilité exclusions, for Vente and
    Achat rows. Exclusions apply only when include_non_declared is False."""

    pharmacy_id: int | None
    date_from: str | None = None
    date_to: str | None = None
    include_non_declared: bool = True

    @property
    def excluding(self) -> bool:
        return bool(self.pharmacy_id) and not self.include_non_declared

    def ventes(self, db: Session) -> list:
        out: list = []
        if self.pharmacy_id:
            out.append(Vente.pharmacy_id == self.pharmacy_id)
        if self.date_from:
            out.append(Vente.date >= self.date_from)
        if self.date_to:
            out.append(Vente.date <= self.date_to)
        if self.excluding:
            out.append(vente_filter(db, self.pharmacy_id))
        return out

    def achats(self, db: Session) -> list:
        out: list = []
        if self.pharmacy_id:
            out.append(Achat.pharmacy_id == self.pharmacy_id)
        if self.date_from:
            out.append(Achat.delivery_date >= self.date_from)
        if self.date_to:
            out.append(Achat.delivery_date <= self.date_to)
        if self.excluding:
            out.append(achat_filter(db, self.pharmacy_id))
        return out
