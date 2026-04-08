"""Tests for POST /stats/analyse-liste endpoint."""

import pytest
from tests.factories import make_achat, make_medicament, make_vente


@pytest.fixture()
def liste_data(db, test_owner):
    pharmacy_id = test_owner["pharmacy"].id

    med1 = make_medicament(db, pid="LST-001", product="Doliprane 1000mg", category="Medicament", ppv=50.0, pph=40.0)
    med2 = make_medicament(db, pid="LST-002", product="Crème Solaire SPF50", category="Parapharmacie", ppv=120.0, pph=95.0)
    med3 = make_medicament(db, pid="LST-003", product="Augmentin 1g", category="Medicament", ppv=105.0, pph=85.0)

    make_achat(db, med1, pharmacy_id, quantity=20, unit_price=38.0, delivery_ref="BL-L1")
    make_achat(db, med2, pharmacy_id, quantity=10, unit_price=95.0, delivery_ref="BL-L2")
    make_achat(db, med3, pharmacy_id, quantity=15, unit_price=85.0, delivery_ref="BL-L3")

    make_vente(db, med1, pharmacy_id, quantity=15, unit_price=50.0, transaction_ref="FAC-L1")
    make_vente(db, med2, pharmacy_id, quantity=5, unit_price=120.0, transaction_ref="FAC-L2")
    make_vente(db, med3, pharmacy_id, quantity=8, unit_price=105.0, transaction_ref="FAC-L3")

    return {"pharmacy_id": pharmacy_id, "med1": med1, "med2": med2, "med3": med3}


class TestAnalyseListe:
    def test_matches_exact_name(self, client, test_owner, liste_data):
        res = client.post("/stats/analyse-liste", json={
            "products": ["Doliprane 1000mg"],
        }, headers=test_owner["headers"])
        assert res.status_code == 200
        data = res.json()
        rows = data["rows"]
        found = [r for r in rows if r["match_status"] == "found"]
        assert len(found) == 1
        assert found[0]["product"] == "Doliprane 1000mg"

    def test_fuzzy_match_accent_insensitive(self, client, test_owner, liste_data):
        # "Creme Solaire SPF50" should match "Crème Solaire SPF50"
        res = client.post("/stats/analyse-liste", json={
            "products": ["Creme Solaire SPF50"],
        }, headers=test_owner["headers"])
        assert res.status_code == 200
        rows = res.json()["rows"]
        found = [r for r in rows if r["match_status"] == "found"]
        assert len(found) == 1

    def test_not_found_products(self, client, test_owner, liste_data):
        res = client.post("/stats/analyse-liste", json={
            "products": ["Produit Inexistant XYZ"],
        }, headers=test_owner["headers"])
        assert res.status_code == 200
        rows = res.json()["rows"]
        not_found = [r for r in rows if r["match_status"] == "not_found"]
        assert len(not_found) == 1
        assert not_found[0]["product"] == "Produit Inexistant XYZ"

    def test_kpis_computed_from_matched_only(self, client, test_owner, liste_data):
        # Only request 1 product — KPIs should reflect only that product
        res = client.post("/stats/analyse-liste", json={
            "products": ["Doliprane 1000mg"],
        }, headers=test_owner["headers"])
        data = res.json()
        kpis = data["kpis"]
        # Total ventes should be only Doliprane: 15 * 50 = 750
        assert kpis["total_ventes_dh"] == 750.0
        assert kpis["total_ventes_unites"] == 15.0

    def test_mixed_found_and_not_found(self, client, test_owner, liste_data):
        res = client.post("/stats/analyse-liste", json={
            "products": ["Doliprane 1000mg", "Produit Fantome"],
        }, headers=test_owner["headers"])
        rows = res.json()["rows"]
        found = [r for r in rows if r["match_status"] == "found"]
        not_found = [r for r in rows if r["match_status"] == "not_found"]
        assert len(found) == 1
        assert len(not_found) == 1

    def test_empty_products_list(self, client, test_owner, liste_data):
        res = client.post("/stats/analyse-liste", json={
            "products": [],
        }, headers=test_owner["headers"])
        assert res.status_code == 200
        assert res.json()["rows"] == []

    def test_respects_date_filter(self, client, test_owner, liste_data):
        # Use a date range that excludes all data
        res = client.post("/stats/analyse-liste", json={
            "products": ["Doliprane 1000mg"],
            "date_from": "2020-01-01",
            "date_to": "2020-12-31",
        }, headers=test_owner["headers"])
        data = res.json()
        # Should find product in DB but no ventes in date range
        kpis = data["kpis"]
        assert kpis["total_ventes_unites"] == 0

    def test_requires_auth(self, client):
        res = client.post("/stats/analyse-liste", json={"products": ["test"]})
        assert res.status_code in (401, 403)
