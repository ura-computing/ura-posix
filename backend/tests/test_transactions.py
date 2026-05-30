"""Tests for achat and vente transaction endpoints."""

import pytest
from tests.factories import make_achat, make_medicament, make_vente


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture()
def seed_data(db, test_owner):
    """Create two medicaments with achats and ventes for the test pharmacy."""
    pharmacy_id = test_owner["pharmacy"].id

    med1 = make_medicament(
        db,
        pid="MED-001",
        product="Doliprane 1000mg",
        category="Medicament (20.00%)",
        tva="TVA (20.00%)",
        pph=40.0,
        ppv=50.0,
    )
    med2 = make_medicament(
        db,
        pid="PARA-001",
        product="Creme Solaire SPF50",
        category="Parapharmacie (7.00%)",
        tva="TVA (7.00%)",
        pph=80.0,
        ppv=100.0,
    )

    a1 = make_achat(db, med1, pharmacy_id, quantity=20, unit_price=40.0, supplier="Pharma Distrib")
    a2 = make_achat(
        db, med2, pharmacy_id, quantity=10, unit_price=80.0,
        supplier="Beauty Supply", delivery_ref="BL-100",
    )

    v1 = make_vente(db, med1, pharmacy_id, quantity=15, unit_price=50.0, transaction_ref="FAC-100")
    v2 = make_vente(
        db, med2, pharmacy_id, quantity=5, unit_price=100.0,
        transaction_ref="FAC-200", date="2026-03-20",
    )

    return {
        "pharmacy_id": pharmacy_id,
        "med1": med1,
        "med2": med2,
        "achats": [a1, a2],
        "ventes": [v1, v2],
    }


# ── GET /achat/categories ────────────────────────────────────────────────────

class TestAchatCategories:
    def test_returns_categories(self, client, test_owner, seed_data):
        res = client.get("/achat/categories", headers=test_owner["headers"])
        assert res.status_code == 200
        cats = res.json()
        assert isinstance(cats, list)
        assert len(cats) >= 2
        # Categories should be stripped of percentage suffix
        cat_lower = [c.lower() for c in cats]
        assert any("medicament" in c for c in cat_lower)
        assert any("parapharmacie" in c for c in cat_lower)

    def test_empty_when_no_data(self, client, test_owner):
        res = client.get("/achat/categories", headers=test_owner["headers"])
        assert res.status_code == 200
        assert res.json() == []

    def test_requires_auth(self, client):
        res = client.get("/achat/categories")
        assert res.status_code == 403  # HTTPBearer returns 403 for missing auth


# ── GET /achat/tva-rates ─────────────────────────────────────────────────────

class TestAchatTvaRates:
    def test_returns_tva_rates(self, client, test_owner, seed_data):
        res = client.get("/achat/tva-rates", headers=test_owner["headers"])
        assert res.status_code == 200
        rates = res.json()
        assert isinstance(rates, list)
        assert len(rates) >= 2
        assert "TVA (20.00%)" in rates
        assert "TVA (7.00%)" in rates

    def test_empty_when_no_data(self, client, test_owner):
        res = client.get("/achat/tva-rates", headers=test_owner["headers"])
        assert res.status_code == 200
        assert res.json() == []


# ── GET /achat/suggestions ───────────────────────────────────────────────────

class TestAchatSuggestions:
    def test_returns_product_suggestions(self, client, test_owner, seed_data):
        res = client.get("/achat/suggestions", params={"q": "Doli"}, headers=test_owner["headers"])
        assert res.status_code == 200
        data = res.json()
        assert "products" in data
        assert "suppliers" in data
        assert "refs" in data
        assert any("Doliprane" in p for p in data["products"])

    def test_returns_supplier_suggestions(self, client, test_owner, seed_data):
        res = client.get("/achat/suggestions", params={"q": "Pharma"}, headers=test_owner["headers"])
        assert res.status_code == 200
        data = res.json()
        assert any("Pharma" in s for s in data["suppliers"])

    def test_short_query_returns_empty(self, client, test_owner):
        res = client.get("/achat/suggestions", params={"q": "D"}, headers=test_owner["headers"])
        assert res.status_code == 200
        data = res.json()
        assert data == {"products": [], "suppliers": [], "refs": []}

    def test_empty_query_returns_empty(self, client, test_owner):
        res = client.get("/achat/suggestions", headers=test_owner["headers"])
        assert res.status_code == 200
        data = res.json()
        assert data == {"products": [], "suppliers": [], "refs": []}

    def test_pg006_tolerant_supplier_search(self, client, db, test_owner):
        """PG-006: the suggestions endpoint must match suppliers tolerantly —
        accent-insensitive, case-insensitive, multi-token, and `*` as a
        fragment separator (the way pharmacists already type).

        Supplier name: "Société PARA LA CDP".
        """
        pharmacy_id = test_owner["pharmacy"].id
        med = make_medicament(
            db, pid="PG006-001", product="GUM JUNIOR 6+ 300ML",
            category="Parapharmacie (33.330%)", tva="TVA (20.00%)",
            pph=60.60, ppv=61.00,
        )
        make_achat(db, med, pharmacy_id, quantity=4, unit_price=45.45,
                   supplier="Société PARA LA CDP", delivery_ref="BL-PG006")

        for query in ("CDP", "para", "societe para", "Société PARA", "soc*cdp"):
            res = client.get("/achat/suggestions", params={"q": query},
                             headers=test_owner["headers"])
            assert res.status_code == 200
            suppliers = res.json()["suppliers"]
            assert "Société PARA LA CDP" in suppliers, (
                f"query {query!r} should find Société PARA LA CDP, got {suppliers!r}"
            )


# ── GET /achat ───────────────────────────────────────────────────────────────

class TestListAchats:
    def test_returns_paginated_data(self, client, test_owner, seed_data):
        res = client.get("/achat", headers=test_owner["headers"])
        assert res.status_code == 200
        body = res.json()
        assert "data" in body
        assert "pagination" in body
        assert body["pagination"]["total"] == 2
        assert len(body["data"]) == 2

    def test_pagination_params(self, client, test_owner, seed_data):
        res = client.get("/achat", params={"page": 1, "limit": 1}, headers=test_owner["headers"])
        assert res.status_code == 200
        body = res.json()
        assert len(body["data"]) == 1
        assert body["pagination"]["totalPages"] == 2

    def test_search_filter(self, client, test_owner, seed_data):
        res = client.get("/achat", params={"search": "Doliprane"}, headers=test_owner["headers"])
        assert res.status_code == 200
        body = res.json()
        assert body["pagination"]["total"] == 1
        assert body["data"][0]["product"] == "Doliprane 1000mg"

    def test_category_filter(self, client, test_owner, seed_data):
        res = client.get(
            "/achat",
            params={"category": "Medicament"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        body = res.json()
        assert body["pagination"]["total"] == 1
        assert "Doliprane" in body["data"][0]["product"]

    def test_empty_when_no_data(self, client, test_owner):
        res = client.get("/achat", headers=test_owner["headers"])
        assert res.status_code == 200
        body = res.json()
        assert body["data"] == []
        assert body["pagination"]["total"] == 0

    def test_row_shape(self, client, test_owner, seed_data):
        res = client.get("/achat", headers=test_owner["headers"])
        assert res.status_code == 200
        row = res.json()["data"][0]
        expected_keys = {
            "id", "delivery_date", "delivery_ref", "delivery_ref_final",
            "delivery_ref_color", "supplier", "pid", "product", "category",
            "tva", "pph", "ppv", "quantity", "unit_price", "expiry_date", "total",
        }
        assert expected_keys.issubset(set(row.keys()))

    def test_export_mode(self, client, test_owner, seed_data):
        res = client.get("/achat", params={"export": True}, headers=test_owner["headers"])
        assert res.status_code == 200
        body = res.json()
        assert "data" in body
        assert "total" in body
        # Export mode returns all rows without pagination wrapper
        assert "pagination" not in body
        assert body["total"] == 2

    def test_permission_denied(self, client, db, test_employee):
        """Employee with achat permission set to False gets 403."""
        user = test_employee["user"]
        user.permissions = {"achat": False}
        db.flush()
        res = client.get("/achat", headers=test_employee["headers"])
        assert res.status_code == 403


# ── GET /ventes/categories ───────────────────────────────────────────────────

class TestVenteCategories:
    def test_returns_categories(self, client, test_owner, seed_data):
        res = client.get("/ventes/categories", headers=test_owner["headers"])
        assert res.status_code == 200
        cats = res.json()
        assert isinstance(cats, list)
        assert len(cats) >= 2

    def test_empty_when_no_data(self, client, test_owner):
        res = client.get("/ventes/categories", headers=test_owner["headers"])
        assert res.status_code == 200
        assert res.json() == []


# ── GET /ventes/tva-rates ────────────────────────────────────────────────────

class TestVenteTvaRates:
    def test_returns_tva_rates(self, client, test_owner, seed_data):
        res = client.get("/ventes/tva-rates", headers=test_owner["headers"])
        assert res.status_code == 200
        rates = res.json()
        assert isinstance(rates, list)
        assert len(rates) >= 2

    def test_empty_when_no_data(self, client, test_owner):
        res = client.get("/ventes/tva-rates", headers=test_owner["headers"])
        assert res.status_code == 200
        assert res.json() == []


# ── GET /ventes/suggestions ──────────────────────────────────────────────────

class TestVenteSuggestions:
    def test_returns_product_suggestions(self, client, test_owner, seed_data):
        res = client.get("/ventes/suggestions", params={"q": "Doli"}, headers=test_owner["headers"])
        assert res.status_code == 200
        data = res.json()
        assert "products" in data
        assert "clients" in data
        assert "refs" in data
        assert any("Doliprane" in p for p in data["products"])

    def test_returns_ref_suggestions(self, client, test_owner, seed_data):
        res = client.get("/ventes/suggestions", params={"q": "FAC"}, headers=test_owner["headers"])
        assert res.status_code == 200
        data = res.json()
        assert len(data["refs"]) >= 1

    def test_short_query_returns_empty(self, client, test_owner):
        res = client.get("/ventes/suggestions", params={"q": "D"}, headers=test_owner["headers"])
        assert res.status_code == 200
        data = res.json()
        assert data == {"products": [], "clients": [], "refs": []}


# ── GET /ventes ──────────────────────────────────────────────────────────────

class TestListVentes:
    def test_returns_paginated_data(self, client, test_owner, seed_data):
        res = client.get("/ventes", headers=test_owner["headers"])
        assert res.status_code == 200
        body = res.json()
        assert "data" in body
        assert "pagination" in body
        assert body["pagination"]["total"] == 2
        assert len(body["data"]) == 2

    def test_pagination_params(self, client, test_owner, seed_data):
        res = client.get("/ventes", params={"page": 1, "limit": 1}, headers=test_owner["headers"])
        assert res.status_code == 200
        body = res.json()
        assert len(body["data"]) == 1
        assert body["pagination"]["totalPages"] == 2

    def test_search_filter(self, client, test_owner, seed_data):
        res = client.get("/ventes", params={"search": "Creme"}, headers=test_owner["headers"])
        assert res.status_code == 200
        body = res.json()
        assert body["pagination"]["total"] == 1
        assert body["data"][0]["product"] == "Creme Solaire SPF50"

    def test_category_filter(self, client, test_owner, seed_data):
        res = client.get(
            "/ventes",
            params={"category": "Parapharmacie"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        body = res.json()
        assert body["pagination"]["total"] == 1
        assert "Creme" in body["data"][0]["product"]

    def test_date_range_filter(self, client, test_owner, seed_data):
        res = client.get(
            "/ventes",
            params={"date_from": "2026-03-18", "date_to": "2026-03-25"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        body = res.json()
        # Only the vente dated 2026-03-20 falls in this range
        assert body["pagination"]["total"] == 1

    def test_row_shape(self, client, test_owner, seed_data):
        res = client.get("/ventes", headers=test_owner["headers"])
        assert res.status_code == 200
        row = res.json()["data"][0]
        expected_keys = {
            "id", "date", "transaction_ref", "transaction_ref_final",
            "transaction_ref_color", "client", "pid", "product", "category",
            "tva", "ppv", "quantity", "discount", "unit_price", "total",
        }
        assert expected_keys.issubset(set(row.keys()))

    def test_export_mode(self, client, test_owner, seed_data):
        res = client.get("/ventes", params={"export": True}, headers=test_owner["headers"])
        assert res.status_code == 200
        body = res.json()
        assert "data" in body
        assert "total" in body
        assert "pagination" not in body
        assert body["total"] == 2

    def test_permission_denied(self, client, db, test_employee):
        """Employee with ventes permission set to False gets 403."""
        user = test_employee["user"]
        user.permissions = {"ventes": False}
        db.flush()
        res = client.get("/ventes", headers=test_employee["headers"])
        assert res.status_code == 403

    def test_tva_filter(self, client, test_owner, seed_data):
        res = client.get(
            "/ventes",
            params={"tva": "TVA (7.00%)"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        body = res.json()
        assert body["pagination"]["total"] == 1
        assert body["data"][0]["tva"] == "TVA (7.00%)"


# ── Fuzzy + barcode search ────────────────────────────────────────────────────

class TestFuzzyAndBarcodeSearch:
    @pytest.fixture()
    def fuzzy_seed(self, db, test_owner):
        pharmacy_id = test_owner["pharmacy"].id
        med = make_medicament(
            db,
            pid="HELIO-001",
            product="HELIOCARE 360°SPORT TRANSPARENT STICK SPF50+ 25G",
            barcode1="8470002024434",
        )
        make_achat(db, med, pharmacy_id, quantity=10, unit_price=180.0, supplier="Cantabria")
        make_vente(db, med, pharmacy_id, quantity=2, unit_price=300.0)
        return med

    def test_search_by_barcode_finds_product(self, client, test_owner, fuzzy_seed):
        res = client.get("/achat", params={"search": "8470002024434"}, headers=test_owner["headers"])
        assert res.status_code == 200
        body = res.json()
        assert body["pagination"]["total"] == 1
        assert "HELIOCARE" in body["data"][0]["product"]

    def test_fuzzy_match_typo_in_long_token(self, client, test_owner, fuzzy_seed):
        # "TRANSPAENT" (typo) should still match "TRANSPARENT" via pg_trgm.
        res = client.get(
            "/ventes",
            params={"search": "HELIOCARE TRANSPAENT"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        body = res.json()
        assert body["pagination"]["total"] == 1
        assert "TRANSPARENT" in body["data"][0]["product"]

    def test_short_typo_does_not_fuzzy_explode(self, client, test_owner, fuzzy_seed, seed_data):
        # 3-char tokens skip fuzzy (would otherwise match too many products);
        # gibberish like "zzz" must return zero rows.
        res = client.get("/ventes", params={"search": "zzz"}, headers=test_owner["headers"])
        assert res.status_code == 200
        assert res.json()["pagination"]["total"] == 0
