"""Tests for POST /stats/analyse-liste endpoint."""

import pytest
from tests.factories import make_achat, make_medicament, make_pharmacy_stock, make_vente


@pytest.fixture()
def liste_data(db, test_owner):
    pharmacy_id = test_owner["pharmacy"].id

    med1 = make_medicament(db, pid="LST-001", product="Doliprane 1000mg", category="Medicament", ppv=50.0, pph=40.0,
                           barcode1="6118000040361", barcode2=None)
    med2 = make_medicament(db, pid="LST-002", product="Crème Solaire SPF50", category="Parapharmacie", ppv=120.0, pph=95.0,
                           barcode1="3401234567890", barcode2="1111222233334")
    med3 = make_medicament(db, pid="LST-003", product="Augmentin 1g", category="Medicament", ppv=105.0, pph=85.0)

    make_achat(db, med1, pharmacy_id, quantity=20, unit_price=38.0, delivery_ref="BL-L1")
    make_achat(db, med2, pharmacy_id, quantity=10, unit_price=95.0, delivery_ref="BL-L2")
    make_achat(db, med3, pharmacy_id, quantity=15, unit_price=85.0, delivery_ref="BL-L3")

    make_vente(db, med1, pharmacy_id, quantity=15, unit_price=50.0, transaction_ref="FAC-L1")
    make_vente(db, med2, pharmacy_id, quantity=5, unit_price=120.0, transaction_ref="FAC-L2")
    make_vente(db, med3, pharmacy_id, quantity=8, unit_price=105.0, transaction_ref="FAC-L3")

    # Stock snapshot (drives stock_dispo for Liste mode)
    make_pharmacy_stock(db, med1, pharmacy_id, current_stock=42)
    make_pharmacy_stock(db, med2, pharmacy_id, current_stock=7)
    # med3 deliberately has NO stock row → stock_dispo should be null

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


class TestAnalyseListeBarcodeFallback:
    def test_match_by_barcode1_when_name_fails(self, client, test_owner, liste_data):
        """Wrong name + correct barcode1 → resolves via barcode1."""
        res = client.post("/stats/analyse-liste", json={
            "items": [{"name": "Totally Wrong Name XYZ", "barcode1": "6118000040361"}],
        }, headers=test_owner["headers"])
        assert res.status_code == 200
        rows = res.json()["rows"]
        found = [r for r in rows if r["match_status"] == "found"]
        assert len(found) == 1
        assert found[0]["product"] == "Doliprane 1000mg"

    def test_match_by_barcode2_when_barcode1_garbage(self, client, test_owner, liste_data):
        """Wrong name + Excel-mangled barcode1 + correct barcode2 → resolves via barcode2."""
        res = client.post("/stats/analyse-liste", json={
            "items": [{"name": "Wrong Name", "barcode1": "8,47E+12", "barcode2": "1111222233334"}],
        }, headers=test_owner["headers"])
        assert res.status_code == 200
        rows = res.json()["rows"]
        found = [r for r in rows if r["match_status"] == "found"]
        assert len(found) == 1
        assert found[0]["product"] == "Crème Solaire SPF50"

    def test_garbage_barcodes_dont_match(self, client, test_owner, liste_data):
        """Both barcodes Excel-mangled → row stays not_found."""
        res = client.post("/stats/analyse-liste", json={
            "items": [{"name": "Unknown Product", "barcode1": "8,47E+12", "barcode2": "6,11E+12"}],
        }, headers=test_owner["headers"])
        assert res.status_code == 200
        rows = res.json()["rows"]
        not_found = [r for r in rows if r["match_status"] == "not_found"]
        assert len(not_found) == 1


class TestAnalyseListeStockSource:
    def test_stock_dispo_from_pharmacy_stock(self, client, test_owner, liste_data):
        """stock_dispo must come from PharmacyStock, not Achat.stock_max."""
        res = client.post("/stats/analyse-liste", json={
            "items": [{"name": "Doliprane 1000mg"}],
        }, headers=test_owner["headers"])
        assert res.status_code == 200
        rows = res.json()["rows"]
        found = [r for r in rows if r["match_status"] == "found"]
        assert len(found) == 1
        assert found[0]["stock_dispo"] == 42

    def test_stock_dispo_null_when_no_pharmacy_stock_row(self, client, test_owner, liste_data):
        """Product without a PharmacyStock row reports stock_dispo=None."""
        res = client.post("/stats/analyse-liste", json={
            "items": [{"name": "Augmentin 1g"}],
        }, headers=test_owner["headers"])
        assert res.status_code == 200
        rows = res.json()["rows"]
        found = [r for r in rows if r["match_status"] == "found"]
        assert len(found) == 1
        assert found[0]["stock_dispo"] is None

    def test_match_stock_only_product(self, client, db, test_owner):
        """A product in PharmacyStock but with no Vente/Achat must still match (qty=0)."""
        pharmacy_id = test_owner["pharmacy"].id
        med = make_medicament(db, pid="STK-ONLY", product="HELIOCARE COMPACT LIGHT SPF50+",
                              category="Parapharmacie", ppv=200.0, pph=150.0)
        make_pharmacy_stock(db, med, pharmacy_id, current_stock=11)
        res = client.post("/stats/analyse-liste", json={
            "items": [{"name": "HELIOCARE COMPACT LIGHT SPF50+"}],
        }, headers=test_owner["headers"])
        assert res.status_code == 200
        rows = res.json()["rows"]
        found = [r for r in rows if r["match_status"] == "found"]
        assert len(found) == 1
        assert found[0]["product"] == "HELIOCARE COMPACT LIGHT SPF50+"
        assert found[0]["stock_dispo"] == 11
        assert found[0]["qty"] == 0

    def test_match_catalog_only_product(self, client, db, test_owner):
        """A product in the catalog with no Vente/Achat/Stock must still match (qty=0, stock=null)."""
        # No pharmacy data of any kind for this med
        make_medicament(db, pid="CAT-ONLY", product="HELIOCARE PURE NEW PRODUCT",
                        category="Parapharmacie", ppv=180.0, pph=120.0)
        res = client.post("/stats/analyse-liste", json={
            "items": [{"name": "HELIOCARE PURE NEW PRODUCT"}],
        }, headers=test_owner["headers"])
        assert res.status_code == 200
        rows = res.json()["rows"]
        found = [r for r in rows if r["match_status"] == "found"]
        assert len(found) == 1
        assert found[0]["product"] == "HELIOCARE PURE NEW PRODUCT"
        assert found[0]["stock_dispo"] is None
        assert found[0]["qty"] == 0

    def test_match_by_pid(self, client, db, test_owner):
        """PID match resolves a row when name + barcode both fail."""
        make_medicament(db, pid="UNIQUE-PID-42", product="Some Long DB Name That Differs",
                        ppv=99.0, pph=70.0)
        res = client.post("/stats/analyse-liste", json={
            "items": [{"name": "totally different csv name", "pid": "UNIQUE-PID-42"}],
        }, headers=test_owner["headers"])
        assert res.status_code == 200
        rows = res.json()["rows"]
        found = [r for r in rows if r["match_status"] == "found"]
        assert len(found) == 1
        assert found[0]["product"] == "Some Long DB Name That Differs"
