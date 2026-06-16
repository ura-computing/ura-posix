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


# ── /ventes Marge DH parity with /stats/analyse-marge ────────────────────────


class TestVentesMargeDhParity:
    """The Marge DH column on /ventes must reconcile with /stats/analyse-marge.

    Both pages use Marge DH = PPV − avg_pu. They must read the same `avg_pu`,
    which means /ventes' avg_pu subquery has to apply the same filters
    `/analyse`'s avg_pu_sub applies (backend/routers/stats/marge.py):
      - date window (Achat.delivery_date inside [date_from, date_to])
      - non-declared medicament exclusion
      - PG-007 BL exclusion (utils.exclusions.achat_bl_filter)
    """

    def _seed(self, db, pharmacy_id):
        """One product, one inside-window vente. Achats are added per-test."""
        med = make_medicament(
            db, pid="MARGE-DH", product="Marge DH Tester",
            category="Medicament (20.00%)", tva="TVA (20.00%)",
            pph=40.0, ppv=100.0,
        )
        make_vente(db, med, pharmacy_id, quantity=5, unit_price=100.0,
                   date="2026-03-20", transaction_ref="FAC-MDH")
        return med

    def _ventes_row(self, client, headers, params, product_name):
        res = client.get("/ventes", params=params, headers=headers)
        assert res.status_code == 200
        return next(r for r in res.json()["data"] if r["product"] == product_name)

    def test_avg_pu_respects_date_window(self, client, db, test_owner):
        """An out-of-window achat must not skew the avg_pu on the displayed vente row."""
        pharmacy_id = test_owner["pharmacy"].id
        med = self._seed(db, pharmacy_id)
        # In-window achat at PU=40
        make_achat(db, med, pharmacy_id, quantity=10, unit_price=40.0,
                   delivery_date="2026-03-05", delivery_ref="BL-INSIDE")
        # Out-of-window achat at PU=90 — must be ignored
        make_achat(db, med, pharmacy_id, quantity=10, unit_price=90.0,
                   delivery_date="2025-12-15", delivery_ref="BL-OUTSIDE")

        row = self._ventes_row(
            client, test_owner["headers"],
            {"date_from": "2026-03-01", "date_to": "2026-03-31"},
            med.product,
        )
        assert row["avg_pu"] == pytest.approx(40.0), (
            "out-of-window BL-OUTSIDE (PU=90) leaked into avg_pu — date filter not applied"
        )

    def test_avg_pu_matches_analyse_for_same_window(self, client, db, test_owner):
        """For the same date window and product, /ventes avg_pu == /analyse pu."""
        pharmacy_id = test_owner["pharmacy"].id
        med = self._seed(db, pharmacy_id)
        # Two in-window achats; expect weighted avg = (10*40 + 10*60) / 20 = 50
        make_achat(db, med, pharmacy_id, quantity=10, unit_price=40.0,
                   delivery_date="2026-03-05", delivery_ref="BL-A")
        make_achat(db, med, pharmacy_id, quantity=10, unit_price=60.0,
                   delivery_date="2026-03-10", delivery_ref="BL-B")
        params = {"date_from": "2026-03-01", "date_to": "2026-03-31"}

        v_row = self._ventes_row(client, test_owner["headers"], params, med.product)
        a_res = client.get(
            "/stats/analyse-marge",
            params={"mode": "produit", **params},
            headers=test_owner["headers"],
        )
        assert a_res.status_code == 200
        a_row = next(r for r in a_res.json()["rows"] if r["product"] == med.product)

        assert v_row["avg_pu"] == a_row["pu"], (
            f"/ventes avg_pu={v_row['avg_pu']} ≠ /analyse pu={a_row['pu']} — filters diverged"
        )
        # And Marge DH must agree end-to-end.
        expected_marge_dh = round(v_row["ppv"] - v_row["avg_pu"], 4)
        assert round(a_row["marge_dh"], 4) == expected_marge_dh

    def test_avg_pu_drops_excluded_bl(self, client, db, test_owner):
        """A pharmacist-excluded BL (PG-007) must not contribute to avg_pu on /ventes."""
        from models import PharmacyBlExclusion
        pharmacy_id = test_owner["pharmacy"].id
        med = self._seed(db, pharmacy_id)
        make_achat(db, med, pharmacy_id, quantity=10, unit_price=40.0,
                   delivery_date="2026-03-05", delivery_ref="BL-KEEP")
        make_achat(db, med, pharmacy_id, quantity=10, unit_price=60.0,
                   delivery_date="2026-03-10", delivery_ref="BL-EXCLUDED")
        params = {"date_from": "2026-03-01", "date_to": "2026-03-31"}

        # Sanity: both contribute → weighted avg = 50
        row = self._ventes_row(client, test_owner["headers"], params, med.product)
        assert row["avg_pu"] == pytest.approx(50.0)

        # Exclude BL-EXCLUDED — avg should fall back to BL-KEEP (40) only
        db.add(PharmacyBlExclusion(pharmacy_id=pharmacy_id, delivery_ref="BL-EXCLUDED"))
        db.flush()
        row = self._ventes_row(client, test_owner["headers"], params, med.product)
        assert row["avg_pu"] == pytest.approx(40.0), (
            "BL-EXCLUDED's PU=60 still leaked into avg_pu after PG-007 exclusion"
        )

    # ── recommended-by-adversarial-review extra coverage ──────────────────────

    def test_avg_pu_single_bound_window_only_date_from(self, client, db, test_owner):
        """Single-bound (date_from only) must still apply the date filter — no clamp to today."""
        pharmacy_id = test_owner["pharmacy"].id
        med = self._seed(db, pharmacy_id)
        make_achat(db, med, pharmacy_id, quantity=10, unit_price=40.0,
                   delivery_date="2026-03-05", delivery_ref="BL-INSIDE")
        make_achat(db, med, pharmacy_id, quantity=10, unit_price=90.0,
                   delivery_date="2025-12-15", delivery_ref="BL-PRE")
        row = self._ventes_row(
            client, test_owner["headers"],
            {"date_from": "2026-03-01"},  # no date_to
            med.product,
        )
        # Only BL-INSIDE qualifies; BL-PRE is before date_from.
        assert row["avg_pu"] == pytest.approx(40.0)

    def test_avg_pu_includes_null_delivery_ref_pg007_null_trap(self, client, db, test_owner):
        """PG-007 NULL trap regression: an Achat with delivery_ref=None must still
        contribute to avg_pu (NULL is not in any BL-exclusion list)."""
        pharmacy_id = test_owner["pharmacy"].id
        med = self._seed(db, pharmacy_id)
        make_achat(db, med, pharmacy_id, quantity=10, unit_price=40.0,
                   delivery_date="2026-03-05", delivery_ref="BL-A")
        make_achat(db, med, pharmacy_id, quantity=10, unit_price=80.0,
                   delivery_date="2026-03-10", delivery_ref=None)
        row = self._ventes_row(
            client, test_owner["headers"],
            {"date_from": "2026-03-01", "date_to": "2026-03-31"},
            med.product,
        )
        # Both contribute → weighted avg = (10×40 + 10×80) / 20 = 60. If the NULL
        # row were silently excluded by `delivery_ref NOT IN (...)` we'd see 40.
        assert row["avg_pu"] == pytest.approx(60.0), (
            "NULL delivery_ref Achat was dropped by achat_bl_filter — regression of PG-007 NULL fix"
        )

    # ── subtotal column (PPV × qty × (1 − Remise %)) ──────────────────────────

    def test_subtotal_formula_no_discount(self, client, db, test_owner):
        """Sous-total = PPV × qty × (1 − discount/100); discount=0 → PPV × qty."""
        pharmacy_id = test_owner["pharmacy"].id
        med = make_medicament(
            db, pid="SUBTOTAL-A", product="Subtotal No Discount",
            category="Medicament (20.00%)", tva="TVA (20.00%)",
            pph=40.0, ppv=100.0,
        )
        make_vente(db, med, pharmacy_id, quantity=3, unit_price=100.0,
                   discount=0.0, date="2026-03-12", transaction_ref="FAC-S1")
        res = client.get("/ventes", headers=test_owner["headers"])
        row = next(r for r in res.json()["data"] if r["product"] == med.product)
        # 100 × 3 × (1 − 0/100) = 300
        assert row["subtotal"] == pytest.approx(300.0)

    def test_subtotal_formula_with_discount(self, client, db, test_owner):
        """Remise stored as a percentage value: 10 means 10 % → factor 0.9."""
        pharmacy_id = test_owner["pharmacy"].id
        med = make_medicament(
            db, pid="SUBTOTAL-B", product="Subtotal With Discount",
            category="Medicament (20.00%)", tva="TVA (20.00%)",
            pph=40.0, ppv=89.0,
        )
        make_vente(db, med, pharmacy_id, quantity=3, unit_price=80.10,
                   discount=10.0, date="2026-03-13", transaction_ref="FAC-S2")
        res = client.get("/ventes", headers=test_owner["headers"])
        row = next(r for r in res.json()["data"] if r["product"] == med.product)
        # 89 × 3 × (1 − 10/100) = 89 × 3 × 0.9 = 240.30
        assert row["subtotal"] == pytest.approx(240.30)

    def test_subtotal_null_when_ppv_missing(self, client, db, test_owner):
        """If PPV is null on the Medicament, subtotal can't be computed."""
        pharmacy_id = test_owner["pharmacy"].id
        med = make_medicament(
            db, pid="SUBTOTAL-C", product="Subtotal Null PPV",
            category="Medicament (20.00%)", tva="TVA (20.00%)",
            pph=40.0, ppv=None,
        )
        make_vente(db, med, pharmacy_id, quantity=3, unit_price=100.0,
                   discount=0.0, date="2026-03-14", transaction_ref="FAC-S3")
        res = client.get("/ventes", headers=test_owner["headers"])
        row = next(r for r in res.json()["data"] if r["product"] == med.product)
        assert row["subtotal"] is None

    def test_avg_pu_none_for_non_declared_med_when_visible(self, client, db, test_owner):
        """`include_non_declared=True` keeps the vente row visible, but the product's
        Achats are still excluded from avg_pu (matches /analyse's contract).
        The cell renders Marge DH = '—' — the documented intentional behaviour."""
        from models import PharmacyMedicamentStatus
        pharmacy_id = test_owner["pharmacy"].id
        med = self._seed(db, pharmacy_id)
        make_achat(db, med, pharmacy_id, quantity=10, unit_price=40.0,
                   delivery_date="2026-03-05", delivery_ref="BL-NEED")
        # Mark the product as non-declared for this pharmacy.
        db.add(PharmacyMedicamentStatus(
            pharmacy_id=pharmacy_id, medicament_id=med.id, declared=False,
        ))
        db.flush()

        # include_non_declared=True keeps the row in the listing.
        res = client.get(
            "/ventes",
            params={
                "date_from": "2026-03-01", "date_to": "2026-03-31",
                "include_non_declared": True,
            },
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        row = next(r for r in res.json()["data"] if r["product"] == med.product)
        # The row IS visible (the user opted in) ...
        assert row["product"] == med.product
        # ... but avg_pu is None because the achat was filtered out of avg_pu_map.
        assert row["avg_pu"] is None


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
