"""Unités disponibles must be real in ALL analyse tabs (computed from
PharmacyStock directly, not row aggregates), respecting the tab's filter."""
from __future__ import annotations

import pytest
from sqlalchemy.orm import Session

from analyse_queries import compute_analyse_marge
from models import Medicament, PharmacyStock, Vente


@pytest.fixture
def seed_stock(db: Session, auth_owner):
    _c, _o, pharmacy = auth_owner
    i = {"n": 0}
    def _make(name: str, cat: str, stock: int) -> None:
        i["n"] += 1
        m = Medicament(pid=f"UNI{i['n']:05d}", product=name, category=cat,
                       tva="TVA (20.00%)", ppv=20.0)
        db.add(m); db.flush()
        db.add(PharmacyStock(pharmacy_id=pharmacy.id, medicament_id=m.id, current_stock=stock))
        db.add(Vente(pharmacy_id=pharmacy.id, medicament_id=m.id, date="2026-02-10",
                     transaction_ref=f"V-{i['n']}", quantity=2.0, unit_price=20.0, total=40.0))
        db.commit()
    _make("DOLIPRANE 1000MG B8", "Médicament", 10)
    _make("EFFERALGAN 500MG", "Médicament", 4)
    _make("CREME SOLAIRE SPF50", "Parapharmacie", 7)
    return pharmacy


class TestTotalUnitsAvailable:
    def test_all_modes_have_real_stock(self, db: Session, seed_stock) -> None:
        for mode in ("categorie", "mois", "annee", "operateur", "produit"):
            k = compute_analyse_marge(db, seed_stock.id, None, None, "all", mode)["kpis"]
            assert k["total_units_available"] == 21  # 10 + 4 + 7

    def test_pharmacie_filter(self, db: Session, seed_stock) -> None:
        k = compute_analyse_marge(db, seed_stock.id, None, None, "pharmacie", "categorie")["kpis"]
        assert k["total_units_available"] == 14

    def test_parapharmacie_filter(self, db: Session, seed_stock) -> None:
        k = compute_analyse_marge(db, seed_stock.id, None, None, "parapharmacie", "categorie")["kpis"]
        assert k["total_units_available"] == 7

    def test_annee_product_search(self, db: Session, seed_stock) -> None:
        k = compute_analyse_marge(db, seed_stock.id, None, None, "all", "annee", product="DOLIPRANE")["kpis"]
        assert k["total_units_available"] == 10

    def test_no_stock_returns_none(self, db: Session, auth_owner) -> None:
        _c, _o, pharmacy = auth_owner
        m = Medicament(pid="UNI99999", product="NO STOCK", category="Médicament",
                       tva="TVA (20.00%)", ppv=10.0)
        db.add(m); db.flush()
        db.add(Vente(pharmacy_id=pharmacy.id, medicament_id=m.id, date="2026-02-10",
                     transaction_ref="V-NOSTOCK", quantity=1.0, unit_price=10.0, total=10.0))
        db.commit()
        k = compute_analyse_marge(db, pharmacy.id, None, None, "all", "categorie")["kpis"]
        assert k["total_units_available"] is None