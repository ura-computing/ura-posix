"""/analyses supplier axes — Grossiste and Laboratoire partition Achat.supplier.

Grossiste = suppliers whose name starts with "GROSSISTE". Laboratoire = every
OTHER non-null supplier (the direct labs / "Société…" — e.g. WELEDA). Every
fournisseur appears in exactly one of the two tabs; searching a laboratoire
supplier by name now finds it.
"""
from __future__ import annotations

import pytest
from sqlalchemy.orm import Session

from analyse_queries import compute_analyse_marge
from models import Achat, Medicament, Vente

LABO_SUPPLIER = "Société WELEDA INSTITUT DE PHARMACIE VETERINAIRE (IPV)"
GROSS_SUPPLIER = "GROSSISTE CDP"


@pytest.fixture
def seed(db: Session, auth_owner):
    """One product bought+sold from a LABORATOIRE supplier, another from a GROSSISTE."""
    _client, _owner, pharmacy = auth_owner
    counter = {"i": 0}

    def _make(supplier: str, product: str) -> Medicament:
        counter["i"] += 1
        m = Medicament(pid=f"AXIS{counter['i']:05d}", product=product, ppv=100.0, tva="TVA (20.00%)")
        db.add(m); db.commit(); db.refresh(m)
        db.add(Achat(pharmacy_id=pharmacy.id, medicament_id=m.id, delivery_ref=f"BL-{counter['i']}",
                     delivery_date="2026-02-01", supplier=supplier, quantity=10.0,
                     unit_price=60.0, total=600.0))
        db.add(Vente(pharmacy_id=pharmacy.id, medicament_id=m.id, date="2026-02-10",
                     transaction_ref=f"V-{counter['i']}", quantity=5.0, unit_price=100.0, total=500.0))
        db.commit()
        return m

    _make(LABO_SUPPLIER, "WELEDA SKIN FOOD CREME 75ML")
    _make(GROSS_SUPPLIER, "DOLIPRANE 1000MG B8")
    return pharmacy


def _labels(rows: list[dict], key: str) -> list[str]:
    return [r[key] for r in rows]


class TestLaboratoireIsNonGrossisteSuppliers:
    def test_laboratoire_shows_the_direct_supplier(self, db: Session, seed) -> None:
        rows = compute_analyse_marge(db, seed.id, None, None, "all", "laboratoire")["rows"]
        labels = _labels(rows, "laboratoire")
        assert LABO_SUPPLIER in labels                       # WELEDA now appears
        assert GROSS_SUPPLIER not in labels                  # grossiste excluded
        # the row carries real CA / marge (not empty)
        weleda = next(r for r in rows if r["laboratoire"] == LABO_SUPPLIER)
        assert weleda["ca"] == 500.0
        assert weleda["marge_pct_avg"] is not None

    def test_grossiste_shows_the_grossiste_supplier(self, db: Session, seed) -> None:
        rows = compute_analyse_marge(db, seed.id, None, None, "all", "grossiste")["rows"]
        labels = _labels(rows, "grossiste")
        assert GROSS_SUPPLIER in labels
        assert LABO_SUPPLIER not in labels                   # a laboratoire never leaks here

    def test_the_two_axes_are_disjoint(self, db: Session, seed) -> None:
        labo = set(_labels(compute_analyse_marge(db, seed.id, None, None, "all", "laboratoire")["rows"], "laboratoire"))
        gross = set(_labels(compute_analyse_marge(db, seed.id, None, None, "all", "grossiste")["rows"], "grossiste"))
        assert labo.isdisjoint(gross)
