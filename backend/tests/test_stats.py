"""Tests for stats endpoints (KPIs, analyse-marge, admin stats, products, peremptions)."""

import pytest
from datetime import date, timedelta
from tests.factories import make_achat, make_medicament, make_pharmacy_stock, make_vente


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture()
def stats_data(db, test_owner):
    """Create medicaments, achats, and ventes with known values for KPI verification.

    med1: Doliprane (Medicament category) — PPH=40, PPV=50
        achats:  qty=20 @ 40 => total=800
        ventes:  qty=15 @ 50 => total=750   (PPV-based: 15 * 50 = 750)

    med2: Creme Solaire (Parapharmacie category) — PPH=80, PPV=100
        achats:  qty=10 @ 80 => total=800
        ventes:  qty=5  @ 100 => total=500  (PPV-based: 5 * 100 = 500)
    """
    pharmacy_id = test_owner["pharmacy"].id

    med1 = make_medicament(
        db,
        pid="STAT-001",
        product="Doliprane 1000mg",
        category="Medicament (20.00%)",
        tva="TVA (20.00%)",
        pph=40.0,
        ppv=50.0,
    )
    med2 = make_medicament(
        db,
        pid="STAT-002",
        product="Creme Solaire SPF50",
        category="Parapharmacie (7.00%)",
        tva="TVA (7.00%)",
        pph=80.0,
        ppv=100.0,
    )

    make_achat(db, med1, pharmacy_id, quantity=20, unit_price=40.0, delivery_date="2026-03-01")
    make_achat(db, med2, pharmacy_id, quantity=10, unit_price=80.0, delivery_date="2026-03-05")

    make_vente(db, med1, pharmacy_id, quantity=15, unit_price=50.0, date="2026-03-10")
    make_vente(db, med2, pharmacy_id, quantity=5, unit_price=100.0, date="2026-03-15")

    return {
        "pharmacy_id": pharmacy_id,
        "med1": med1,
        "med2": med2,
        "expected_ventes_total": 15 * 50.0 + 5 * 100.0,  # 1250.0  (PPV-based)
        "expected_achats_total": 20 * 40.0 + 10 * 80.0,   # 1600.0
        "expected_ventes_count": 2,
        "expected_achats_count": 2,
    }


# ── GET /stats ───────────────────────────────────────────────────────────────

class TestGetStats:
    def test_returns_kpis_with_data(self, client, test_owner, stats_data):
        res = client.get("/stats", headers=test_owner["headers"])
        assert res.status_code == 200
        body = res.json()

        kpis = body["kpis"]
        assert kpis["ventes_total"] == stats_data["expected_ventes_total"]
        assert kpis["achats_total"] == stats_data["expected_achats_total"]
        assert kpis["ventes_count"] == stats_data["expected_ventes_count"]
        assert kpis["achats_count"] == stats_data["expected_achats_count"]

    def test_response_shape(self, client, test_owner, stats_data):
        res = client.get("/stats", headers=test_owner["headers"])
        assert res.status_code == 200
        body = res.json()

        assert "kpis" in body
        assert "previous_kpis" in body
        assert "monthly_trend" in body
        assert "top_categories" in body
        assert "advanced_kpis" in body
        assert "tva" in body
        assert "marge" in body
        assert "type_breakdown" in body

    def test_admin_gets_403(self, client, test_admin):
        res = client.get("/stats", headers=test_admin["headers"])
        assert res.status_code == 403
        assert "admins" in res.json()["detail"].lower()

    def test_empty_data(self, client, test_owner):
        res = client.get("/stats", headers=test_owner["headers"])
        assert res.status_code == 200
        kpis = res.json()["kpis"]
        assert kpis["ventes_total"] == 0
        assert kpis["achats_total"] == 0
        assert kpis["ventes_count"] == 0
        assert kpis["achats_count"] == 0

    def test_category_type_filter(self, client, test_owner, stats_data):
        # pharmacie filter should only include Medicament category
        res = client.get(
            "/stats",
            params={"category_type": "pharmacie"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        kpis = res.json()["kpis"]
        # Only Doliprane ventes: 15 * 50 = 750
        assert kpis["ventes_total"] == 15 * 50.0

    def test_date_range_filter(self, client, test_owner, stats_data):
        res = client.get(
            "/stats",
            params={"date_from": "2026-03-12", "date_to": "2026-03-20"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        kpis = res.json()["kpis"]
        # Only the vente on 2026-03-15 (Creme Solaire) falls in this range
        assert kpis["ventes_count"] == 1
        assert kpis["ventes_total"] == 5 * 100.0

    def test_top_categories(self, client, test_owner, stats_data):
        res = client.get("/stats", headers=test_owner["headers"])
        assert res.status_code == 200
        cats = res.json()["top_categories"]
        assert isinstance(cats, list)
        assert len(cats) >= 1
        # Each category entry has 'category' and 'total'
        for cat in cats:
            assert "category" in cat
            assert "total" in cat

    def test_marge_present(self, client, test_owner, stats_data):
        res = client.get("/stats", headers=test_owner["headers"])
        assert res.status_code == 200
        marge = res.json()["marge"]
        assert "marge_pct" in marge
        assert "marge_brute_dh" in marge
        assert "marge_nette_dh" in marge
        # With known PPV=50, PU=40 for Doliprane and PPV=100, PU=80 for Creme
        # marge should be positive
        assert marge["marge_brute_dh"] > 0

    def test_requires_auth(self, client):
        res = client.get("/stats")
        assert res.status_code == 403  # HTTPBearer returns 403 for missing auth

    def test_previous_kpis_shape(self, client, test_owner, stats_data):
        """previous_kpis must contain ventes_total and achats_total."""
        res = client.get("/stats", headers=test_owner["headers"])
        assert res.status_code == 200
        prev = res.json()["previous_kpis"]
        assert "ventes_total" in prev
        assert "achats_total" in prev
        assert isinstance(prev["ventes_total"], (int, float))
        assert isinstance(prev["achats_total"], (int, float))

    def test_previous_kpis_with_date_range(self, client, db, test_owner, stats_data):
        """When filtering March 10-15 2026, the previous period is the same dates
        one year earlier (March 10-15 2025)."""
        pharmacy_id = stats_data["pharmacy_id"]
        med1 = stats_data["med1"]

        # Add data in the year-ago window (March 10-15 2025) for med1
        make_vente(db, med1, pharmacy_id, quantity=3, unit_price=50.0, date="2025-03-12")
        make_achat(db, med1, pharmacy_id, quantity=4, unit_price=40.0, delivery_date="2025-03-13")

        res = client.get(
            "/stats",
            params={"date_from": "2026-03-10", "date_to": "2026-03-15"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        prev = res.json()["previous_kpis"]
        assert prev["ventes_total"] == 3 * 50.0
        assert prev["achats_total"] == 4 * 40.0

    def test_previous_kpis_empty_when_no_prior_data(self, client, test_owner, stats_data):
        """When there is no data in the year-ago window, totals should be 0."""
        res = client.get(
            "/stats",
            params={"date_from": "2026-03-01", "date_to": "2026-03-31"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        prev = res.json()["previous_kpis"]
        # Year-ago window is March 1-31 2025 — no data was inserted there
        assert prev["ventes_total"] == 0
        assert prev["achats_total"] == 0


# ── GET /stats/analyse-marge ─────────────────────────────────────────────────

class TestAnalyseMarge:
    def test_produit_mode(self, client, test_owner, stats_data):
        res = client.get(
            "/stats/analyse-marge",
            params={"mode": "produit"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        body = res.json()
        assert "kpis" in body
        assert "rows" in body
        assert len(body["rows"]) >= 2

        # Verify row shape for produit mode
        row = body["rows"][0]
        assert "product" in row
        assert "category" in row
        assert "ppv" in row
        assert "pu" in row
        assert "qty" in row
        assert "ca" in row
        assert "marge_pct" in row
        assert "marge_dh" in row

    def test_categorie_mode(self, client, test_owner, stats_data):
        res = client.get(
            "/stats/analyse-marge",
            params={"mode": "categorie"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        body = res.json()
        assert len(body["rows"]) >= 2
        row = body["rows"][0]
        assert "category" in row
        assert "qty" in row
        assert "ca" in row

    def test_fournisseur_mode(self, client, test_owner, stats_data):
        res = client.get(
            "/stats/analyse-marge",
            params={"mode": "fournisseur"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        body = res.json()
        assert "rows" in body
        # Should have at least one supplier (from make_achat default "Grossiste A")
        if body["rows"]:
            assert "supplier" in body["rows"][0]

    def test_bl_mode(self, client, test_owner, stats_data):
        res = client.get(
            "/stats/analyse-marge",
            params={"mode": "bl"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        body = res.json()
        assert "rows" in body
        if body["rows"]:
            assert "delivery_ref" in body["rows"][0]
            assert "supplier" in body["rows"][0]

    def test_admin_gets_403(self, client, test_admin):
        res = client.get("/stats/analyse-marge", headers=test_admin["headers"])
        assert res.status_code == 403

    def test_marge_values_correct_for_produit(self, client, test_owner, stats_data):
        """With PPV=50, PU=40 for Doliprane, marge should be 20%."""
        res = client.get(
            "/stats/analyse-marge",
            params={"mode": "produit"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        rows = res.json()["rows"]
        doliprane = next((r for r in rows if "Doliprane" in r["product"]), None)
        assert doliprane is not None
        assert doliprane["ppv"] == 50.0
        assert doliprane["pu"] == 40.0
        # marge_pct = (1 - 40/50) * 100 = 20.0
        assert doliprane["marge_pct"] == 20.0
        # marge_dh = 50 - 40 = 10.0
        assert doliprane["marge_dh"] == 10.0

    def test_pg010_grossiste_marge_computed(self, client, test_owner, stats_data):
        """PG-010: Analyses → Grossistes must populate marge_pct_avg / marge_dh_avg / total_achat_cost
        (the audit screenshot showed "—" / "0,00 MAD"). The default `stats_data` fixture buys
        both Doliprane (PPV=50 PU=40, qty=15) and Creme Solaire (PPV=100 PU=80, qty=5) from
        the default 'Grossiste A' supplier."""
        res = client.get(
            "/stats/analyse-marge",
            params={"mode": "grossiste"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        body = res.json()
        rows = body["rows"]
        # Pull the Grossiste A row
        row = next((r for r in rows if r["grossiste"] == "Grossiste A"), None)
        assert row is not None, "Grossiste A should appear in grossiste mode"
        # Both products have marge=20% (50→40 and 100→80), so weighted avg = 20%
        assert row["marge_pct_avg"] == 20.0
        # Weighted marge DH: (15*10 + 5*20) / (15+5) = 250 / 20 = 12.5
        assert row["marge_dh_avg"] == 12.5
        # Total achat cost = 20*40 + 10*80 = 1600
        assert row["total_achat_cost"] == 1600.0
        # KPIs should also reflect this and be addressable by 'grossiste' label
        kpis = body["kpis"]
        assert kpis["marge_pct_avg"] == 20.0
        assert kpis["marge_dh_avg"] == 12.5
        assert kpis["marge_pct_max"]["label"] == "Grossiste A"

    def test_pg010_laboratoire_marge_computed(self, client, db, test_owner):
        """PG-010 (labo branch): same fix shape — Analyses → Laboratoires must compute marge."""
        pharmacy_id = test_owner["pharmacy"].id
        med = make_medicament(
            db, pid="PG010-LAB-001", product="MKL Cream 100ml",
            category="Parapharmacie (7.00%)", tva="TVA (7.00%)",
            pph=60.0, ppv=80.0, laboratoire="MKL",
        )
        make_achat(db, med, pharmacy_id, quantity=10, unit_price=60.0, delivery_date="2026-03-01")
        make_vente(db, med, pharmacy_id, quantity=4, unit_price=80.0, date="2026-03-12")

        res = client.get(
            "/stats/analyse-marge",
            params={"mode": "laboratoire"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        rows = res.json()["rows"]
        row = next((r for r in rows if r["laboratoire"] == "MKL"), None)
        assert row is not None
        # marge_pct = (1 - 60/80) * 100 = 25
        assert row["marge_pct_avg"] == 25.0
        # marge_dh = 80 - 60 = 20
        assert row["marge_dh_avg"] == 20.0
        # total achat cost = 10 * 60 = 600
        assert row["total_achat_cost"] == 600.0

    def test_pg013_no_pph_fallback_when_achat_missing(self, client, db, test_owner):
        """PG-013: a Sobrus fiche with PPH == PPV must not yield a fake 0 % margin
        when there is no Achat row. The audit found this happens because Sobrus often
        copies PPV into PPH; falling back to PPH then makes marge_pct = 0 % which the
        pharmacist reads as 'no margin' when it's really 'no purchase data'."""
        pharmacy_id = test_owner["pharmacy"].id
        med = make_medicament(
            db, pid="PG013-001", product="SobrusOnly Cream 50ml",
            category="Parapharmacie (7.00%)", tva="TVA (7.00%)",
            pph=60.0, ppv=60.0,  # PPH == PPV (typical Sobrus fiche)
        )
        make_vente(db, med, pharmacy_id, quantity=2, unit_price=60.0, date="2026-03-12")
        # No Achat row for this medicament — PG-013 says marge must NOT be computed.

        res = client.get(
            "/stats/analyse-marge",
            params={"mode": "produit"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        row = next((r for r in res.json()["rows"] if r["product"] == med.product), None)
        assert row is not None, "product with vente but no achat should still appear in the list"
        assert row["pu"] is None, "pu must be null when no Achat — never the Sobrus PPH"
        assert row["marge_pct"] is None
        assert row["marge_dh"] is None

    def test_kpis_present(self, client, test_owner, stats_data):
        res = client.get(
            "/stats/analyse-marge",
            params={"mode": "produit"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        kpis = res.json()["kpis"]
        assert "total_ventes_dh" in kpis
        assert "total_ventes_unites" in kpis
        assert "marge_pct_avg" in kpis
        assert kpis["total_ventes_dh"] > 0
        assert kpis["total_ventes_unites"] > 0


# ── GET /stats/export-excel ──────────────────────────────────────────────────

class TestExportExcel:
    def test_returns_xlsx(self, client, test_owner, stats_data):
        res = client.get("/stats/export-excel", headers=test_owner["headers"])
        assert res.status_code == 200
        assert res.headers["content-type"] == (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        assert "content-disposition" in res.headers
        assert "attachment" in res.headers["content-disposition"]
        assert ".xlsx" in res.headers["content-disposition"]
        # Body should be non-empty binary
        assert len(res.content) > 100

    def test_admin_gets_403(self, client, test_admin):
        res = client.get("/stats/export-excel", headers=test_admin["headers"])
        assert res.status_code == 403

    def test_with_date_params(self, client, test_owner, stats_data):
        res = client.get(
            "/stats/export-excel",
            params={"date_from": "2026-03-01", "date_to": "2026-03-31"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        assert len(res.content) > 100


# ── GET /admin/pharmacy/{id}/stats ───────────────────────────────────────────

class TestAdminPharmacyStats:
    def test_admin_gets_stats(self, client, test_admin, test_owner, stats_data):
        pharmacy_id = stats_data["pharmacy_id"]
        res = client.get(
            f"/admin/pharmacy/{pharmacy_id}/stats",
            headers=test_admin["headers"],
        )
        assert res.status_code == 200
        body = res.json()
        assert "kpis" in body
        assert "monthly_trend" in body
        assert "top_categories" in body

        kpis = body["kpis"]
        assert kpis["ventes_total"] == stats_data["expected_ventes_total"]
        assert kpis["achats_total"] == stats_data["expected_achats_total"]

    def test_non_admin_gets_403(self, client, test_owner, stats_data):
        pharmacy_id = stats_data["pharmacy_id"]
        res = client.get(
            f"/admin/pharmacy/{pharmacy_id}/stats",
            headers=test_owner["headers"],
        )
        assert res.status_code == 403


# ── GET /admin/pharmacy/{id}/stats/analyse-marge ─────────────────────────────

class TestAdminPharmacyAnalyseMarge:
    def test_admin_gets_marge(self, client, test_admin, test_owner, stats_data):
        pharmacy_id = stats_data["pharmacy_id"]
        res = client.get(
            f"/admin/pharmacy/{pharmacy_id}/stats/analyse-marge",
            params={"mode": "produit"},
            headers=test_admin["headers"],
        )
        assert res.status_code == 200
        body = res.json()
        assert "kpis" in body
        assert "rows" in body
        assert len(body["rows"]) >= 2

    def test_non_admin_gets_403(self, client, test_owner, stats_data):
        pharmacy_id = stats_data["pharmacy_id"]
        res = client.get(
            f"/admin/pharmacy/{pharmacy_id}/stats/analyse-marge",
            headers=test_owner["headers"],
        )
        assert res.status_code == 403

    def test_category_type_filter(self, client, test_admin, test_owner, stats_data):
        pharmacy_id = stats_data["pharmacy_id"]
        res = client.get(
            f"/admin/pharmacy/{pharmacy_id}/stats/analyse-marge",
            params={"mode": "produit", "category_type": "pharmacie"},
            headers=test_admin["headers"],
        )
        assert res.status_code == 200
        rows = res.json()["rows"]
        # Only Medicament-category products should appear
        for row in rows:
            assert "Parapharmacie" not in row.get("category", "")


# ── GET /admin/stats ─────────────────────────────────────────────────────────

class TestAdminStats:
    def test_admin_dashboard_kpis(self, client, db, test_admin, test_owner, stats_data):
        res = client.get("/admin/stats", headers=test_admin["headers"])
        assert res.status_code == 200
        body = res.json()
        assert "total_pharmacies" in body
        assert "total_active_users" in body
        assert "total_catalog_items" in body
        assert "pending_catalog_requests" in body

        # There is at least 1 pharmacy (test_pharmacy) and 2 medicaments
        assert body["total_pharmacies"] >= 1
        assert body["total_catalog_items"] >= 2
        # At least admin + owner are active
        assert body["total_active_users"] >= 2

    def test_non_admin_gets_403(self, client, test_owner):
        res = client.get("/admin/stats", headers=test_owner["headers"])
        assert res.status_code == 403

    def test_reflects_new_data(self, client, db, test_admin, test_owner):
        """Verify the counts update when new data is added."""
        from models import CatalogRequest
        from utils.constants import RequestType, Status

        req = CatalogRequest(
            requested_by=test_owner["user"].id,
            pharmacy_id=test_owner["pharmacy"].id,
            product="Pending Product",
            status=Status.PENDING,
            request_type=RequestType.NEW_PRODUCT,
        )
        db.add(req)
        db.flush()

        res = client.get("/admin/stats", headers=test_admin["headers"])
        assert res.status_code == 200
        assert res.json()["pending_catalog_requests"] >= 1


# ── GET /stats/products ──────────────────────────────────────────────────────

class TestStatsProducts:
    def test_returns_products(self, client, test_owner, stats_data):
        res = client.get("/stats/products", headers=test_owner["headers"])
        assert res.status_code == 200
        products = res.json()
        assert isinstance(products, list)
        assert len(products) >= 2

        # Verify shape
        p = products[0]
        assert "medicament_id" in p
        assert "product" in p
        assert "category" in p
        assert "declared" in p

    def test_search_filter(self, client, test_owner, stats_data):
        res = client.get(
            "/stats/products",
            params={"search": "Doliprane"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        products = res.json()
        assert len(products) == 1
        assert "Doliprane" in products[0]["product"]

    def test_admin_gets_403(self, client, test_admin):
        res = client.get("/stats/products", headers=test_admin["headers"])
        assert res.status_code == 403

    def test_empty_when_no_data(self, client, test_owner):
        res = client.get("/stats/products", headers=test_owner["headers"])
        assert res.status_code == 200
        assert res.json() == []

    def test_declared_status(self, client, db, test_owner, stats_data):
        """Non-declared products should have declared=False."""
        from models import PharmacyMedicamentStatus

        # Mark med1 as non-declared
        db.add(PharmacyMedicamentStatus(
            pharmacy_id=stats_data["pharmacy_id"],
            medicament_id=stats_data["med1"].id,
            declared=False,
        ))
        db.flush()

        res = client.get("/stats/products", headers=test_owner["headers"])
        assert res.status_code == 200
        products = res.json()
        doliprane = next((p for p in products if "Doliprane" in p["product"]), None)
        assert doliprane is not None
        assert doliprane["declared"] is False

        creme = next((p for p in products if "Creme" in p["product"]), None)
        assert creme is not None
        assert creme["declared"] is True


# ── GET /stats/peremptions ──────────────────────────────────────────────────

@pytest.fixture()
def peremptions_data(db, test_owner):
    """Create medicaments with various expiry dates for peremption testing.

    med_expired: expiry 2025-01-01 (in the past) — expired
    med_very_close: expiry today + 3 months — very close
    med_close: expiry today + 9 months — close
    med_safe: expiry today + 18 months — not in any bracket
    """
    pharmacy_id = test_owner["pharmacy"].id
    today = date.today()

    med_expired = make_medicament(
        db,
        pid="PERM-001",
        product="Expired Drug",
        ppv=50.0,
        pph=40.0,
    )
    med_very_close = make_medicament(
        db,
        pid="PERM-002",
        product="Very Close Drug",
        ppv=80.0,
        pph=60.0,
    )
    med_close = make_medicament(
        db,
        pid="PERM-003",
        product="Close Drug",
        ppv=120.0,
        pph=90.0,
    )
    med_safe = make_medicament(
        db,
        pid="PERM-004",
        product="Safe Drug",
        ppv=200.0,
        pph=150.0,
    )

    # Stock rows drive peremption now (not Achat.expiry_date)
    make_pharmacy_stock(
        db, med_expired, pharmacy_id,
        current_stock=10, expiry_date="2025-01-01",
    )
    make_pharmacy_stock(
        db, med_very_close, pharmacy_id,
        current_stock=20, expiry_date=(today + timedelta(days=90)).isoformat(),
    )
    make_pharmacy_stock(
        db, med_close, pharmacy_id,
        current_stock=15, expiry_date=(today + timedelta(days=270)).isoformat(),
    )
    make_pharmacy_stock(
        db, med_safe, pharmacy_id,
        current_stock=30, expiry_date=(today + timedelta(days=540)).isoformat(),
    )

    return {
        "pharmacy_id": pharmacy_id,
        "med_expired": med_expired,
        "med_very_close": med_very_close,
        "med_close": med_close,
        "med_safe": med_safe,
    }


class TestPeremptions:
    def test_response_shape(self, client, test_owner, peremptions_data):
        res = client.get("/stats/peremptions", headers=test_owner["headers"])
        assert res.status_code == 200
        body = res.json()

        for bracket_key in ("expired", "very_close", "close"):
            assert bracket_key in body
            bracket = body[bracket_key]
            assert "count" in bracket
            assert "total_units" in bracket
            assert "purchase_value" in bracket
            assert "sale_value" in bracket
            assert "products" in bracket

    def test_expired_bracket(self, client, test_owner, peremptions_data):
        res = client.get("/stats/peremptions", headers=test_owner["headers"])
        assert res.status_code == 200
        expired = res.json()["expired"]

        assert expired["count"] == 1
        assert expired["total_units"] == 10
        assert expired["purchase_value"] == 10 * 40.0
        assert expired["sale_value"] == 10 * 50.0

    def test_very_close_bracket(self, client, test_owner, peremptions_data):
        res = client.get("/stats/peremptions", headers=test_owner["headers"])
        assert res.status_code == 200
        very_close = res.json()["very_close"]

        assert very_close["count"] == 1
        assert very_close["total_units"] == 20
        assert very_close["purchase_value"] == 20 * 60.0
        assert very_close["sale_value"] == 20 * 80.0

    def test_close_bracket(self, client, test_owner, peremptions_data):
        res = client.get("/stats/peremptions", headers=test_owner["headers"])
        assert res.status_code == 200
        close = res.json()["close"]

        assert close["count"] == 1
        assert close["total_units"] == 15
        assert close["purchase_value"] == 15 * 90.0
        assert close["sale_value"] == 15 * 120.0

    def test_safe_not_included(self, client, test_owner, peremptions_data):
        """Products with expiry > 12 months should not appear in any bracket."""
        res = client.get("/stats/peremptions", headers=test_owner["headers"])
        assert res.status_code == 200
        body = res.json()

        all_products = []
        for key in ("expired", "very_close", "close"):
            all_products.extend(body[key]["products"])

        product_names = [p["product"] for p in all_products]
        assert "Safe Drug" not in product_names

    def test_product_shape(self, client, test_owner, peremptions_data):
        res = client.get("/stats/peremptions", headers=test_owner["headers"])
        assert res.status_code == 200
        expired_products = res.json()["expired"]["products"]
        assert len(expired_products) >= 1

        p = expired_products[0]
        assert "product" in p
        assert "expiry_date" in p
        assert "quantity" in p
        assert "ppv" in p

    def test_admin_gets_403(self, client, test_admin):
        res = client.get("/stats/peremptions", headers=test_admin["headers"])
        assert res.status_code == 403

    def test_requires_auth(self, client):
        res = client.get("/stats/peremptions")
        assert res.status_code == 403

    def test_empty_when_no_data(self, client, test_owner):
        res = client.get("/stats/peremptions", headers=test_owner["headers"])
        assert res.status_code == 200
        body = res.json()
        for key in ("expired", "very_close", "close"):
            assert body[key]["count"] == 0
            assert body[key]["total_units"] == 0


class TestAdminPeremptions:
    def test_admin_gets_peremptions(self, client, test_admin, test_owner, peremptions_data):
        pharmacy_id = peremptions_data["pharmacy_id"]
        res = client.get(
            f"/admin/pharmacy/{pharmacy_id}/stats/peremptions",
            headers=test_admin["headers"],
        )
        assert res.status_code == 200
        body = res.json()
        for key in ("expired", "very_close", "close"):
            assert key in body

    def test_non_admin_gets_403(self, client, test_owner, peremptions_data):
        pharmacy_id = peremptions_data["pharmacy_id"]
        res = client.get(
            f"/admin/pharmacy/{pharmacy_id}/stats/peremptions",
            headers=test_owner["headers"],
        )
        assert res.status_code == 403
