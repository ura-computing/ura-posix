"""Tests for GET /achat/supplier-summary endpoint."""

import pytest
from tests.factories import make_achat, make_medicament, make_vente


@pytest.fixture()
def supplier_data(db, test_owner):
    pharmacy_id = test_owner["pharmacy"].id

    med1 = make_medicament(db, pid="SUP-001", product="Doliprane 1000mg", category="Medicament", ppv=50.0, pph=40.0)
    med2 = make_medicament(db, pid="SUP-002", product="Creme Solaire", category="Parapharmacie", ppv=100.0, pph=80.0)

    # Grossiste purchases
    make_achat(db, med1, pharmacy_id, quantity=20, unit_price=40.0, supplier="Grossiste SOPHACA", delivery_ref="BL-G1")
    make_achat(db, med1, pharmacy_id, quantity=10, unit_price=38.0, supplier="Grossiste SOREMED", delivery_ref="BL-G2")

    # Direct labo purchases
    make_achat(db, med2, pharmacy_id, quantity=5, unit_price=80.0, supplier="Laboratoire Avene", delivery_ref="BL-L1")

    return {"pharmacy_id": pharmacy_id, "med1": med1, "med2": med2}


class TestSupplierSummary:
    def test_returns_grossiste_vs_labo_breakdown(self, client, test_owner, supplier_data):
        res = client.get("/achat/supplier-summary", headers=test_owner["headers"])
        assert res.status_code == 200
        data = res.json()
        assert "grossiste" in data
        assert "direct_labo" in data

        g = data["grossiste"]
        assert g["total_mad"] == 20 * 40.0 + 10 * 38.0  # 800 + 380 = 1180
        assert g["bl_count"] == 2
        assert g["unit_count"] == 30

        l = data["direct_labo"]
        assert l["total_mad"] == 5 * 80.0  # 400
        assert l["bl_count"] == 1
        assert l["unit_count"] == 5

    def test_classifies_by_grossiste_prefix(self, client, test_owner, supplier_data):
        res = client.get("/achat/supplier-summary", headers=test_owner["headers"])
        data = res.json()
        # "Grossiste SOPHACA" and "Grossiste SOREMED" → grossiste
        # "Laboratoire Avene" → direct_labo
        assert data["grossiste"]["bl_count"] == 2
        assert data["direct_labo"]["bl_count"] == 1

    def test_respects_date_filter(self, client, db, test_owner, supplier_data):
        pharmacy_id = test_owner["pharmacy"].id
        med = supplier_data["med1"]
        make_achat(db, med, pharmacy_id, quantity=100, unit_price=40.0, supplier="Grossiste NEW",
                   delivery_ref="BL-G3", delivery_date="2025-01-15")

        # Filter to only Jan 2025
        res = client.get("/achat/supplier-summary?date_from=2025-01-01&date_to=2025-01-31",
                         headers=test_owner["headers"])
        data = res.json()
        assert data["grossiste"]["total_mad"] == 100 * 40.0  # Only the Jan purchase

    def test_empty_returns_zeros(self, client, test_owner):
        res = client.get("/achat/supplier-summary", headers=test_owner["headers"])
        assert res.status_code == 200
        data = res.json()
        assert data["grossiste"]["total_mad"] == 0
        assert data["direct_labo"]["total_mad"] == 0

    def test_requires_auth(self, client):
        res = client.get("/achat/supplier-summary")
        assert res.status_code in (401, 403)
