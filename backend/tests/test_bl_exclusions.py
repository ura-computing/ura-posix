"""Tests for PG-007 (achats half) — BL number exclusion endpoints + filter integration."""

import pytest

from models import PharmacyBlExclusion
from tests.factories import make_achat, make_medicament, make_vente


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture()
def two_bls(db, test_owner):
    """Two distinct BLs in the owner's pharmacy:
    BL-KEEP-001 → 1 achat line (qty 10 @ 40 = 400 MAD).
    BL-EXCLUDE-001 → 1 achat line (qty 5 @ 60 = 300 MAD).
    Both products also have ventes so the dashboard marge formula has something to chew on."""
    pharmacy_id = test_owner["pharmacy"].id
    keep = make_medicament(db, pid="BL-KEEP", product="Keep Medicament", category="Medicament (20.00%)", tva="TVA (20.00%)", pph=40.0, ppv=50.0)
    excl = make_medicament(db, pid="BL-EXCL", product="Excl Medicament", category="Medicament (20.00%)", tva="TVA (20.00%)", pph=60.0, ppv=80.0)
    make_achat(db, keep, pharmacy_id, quantity=10, unit_price=40.0, delivery_date="2026-03-01", delivery_ref="BL-KEEP-001", supplier="Grossiste K")
    make_achat(db, excl, pharmacy_id, quantity=5,  unit_price=60.0, delivery_date="2026-03-02", delivery_ref="BL-EXCLUDE-001", supplier="Grossiste E")
    make_vente(db, keep, pharmacy_id, quantity=10, unit_price=50.0, date="2026-03-15")
    make_vente(db, excl, pharmacy_id, quantity=5,  unit_price=80.0, date="2026-03-16")
    return {"pharmacy_id": pharmacy_id, "keep": keep, "excl": excl}


# ── POST /bl-exclusions ──────────────────────────────────────────────────────

class TestCreateBlExclusion:
    def test_create_succeeds_when_bl_exists(self, client, db, test_owner, two_bls):
        res = client.post(
            "/bl-exclusions",
            json={"delivery_ref": "BL-EXCLUDE-001", "notes": "retours fournisseur"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        body = res.json()
        assert body["delivery_ref"] == "BL-EXCLUDE-001"
        assert body["notes"] == "retours fournisseur"
        assert body["supplier"] == "Grossiste E"
        assert body["total_mad"] == 300.0  # 5 × 60
        assert body["nb_lines"] == 1

        row = (
            db.query(PharmacyBlExclusion)
            .filter(PharmacyBlExclusion.pharmacy_id == test_owner["pharmacy"].id)
            .first()
        )
        assert row is not None
        assert row.delivery_ref == "BL-EXCLUDE-001"

    def test_create_rejects_unknown_bl(self, client, test_owner, two_bls):
        # A BL that's not in the pharmacy's achats — likely a typo.
        res = client.post(
            "/bl-exclusions",
            json={"delivery_ref": "BL-DOES-NOT-EXIST"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 400
        assert "BL" in res.json()["detail"]

    def test_create_rejects_duplicate(self, client, test_owner, two_bls):
        client.post("/bl-exclusions", json={"delivery_ref": "BL-EXCLUDE-001"}, headers=test_owner["headers"])
        res = client.post("/bl-exclusions", json={"delivery_ref": "BL-EXCLUDE-001"}, headers=test_owner["headers"])
        assert res.status_code == 400
        assert "déjà" in res.json()["detail"]

    def test_admin_gets_403(self, client, test_admin):
        res = client.post("/bl-exclusions", json={"delivery_ref": "BL-ANY"}, headers=test_admin["headers"])
        assert res.status_code == 403


# ── GET /bl-exclusions ───────────────────────────────────────────────────────

class TestListBlExclusions:
    def test_returns_empty_when_none(self, client, test_owner):
        res = client.get("/bl-exclusions", headers=test_owner["headers"])
        assert res.status_code == 200
        assert res.json() == []

    def test_returns_enriched_rows(self, client, test_owner, two_bls):
        client.post("/bl-exclusions", json={"delivery_ref": "BL-EXCLUDE-001", "notes": "n"}, headers=test_owner["headers"])
        res = client.get("/bl-exclusions", headers=test_owner["headers"])
        assert res.status_code == 200
        body = res.json()
        assert len(body) == 1
        assert body[0]["delivery_ref"] == "BL-EXCLUDE-001"
        assert body[0]["total_mad"] == 300.0
        assert body[0]["supplier"] == "Grossiste E"


# ── DELETE /bl-exclusions/{ref} ──────────────────────────────────────────────

class TestDeleteBlExclusion:
    def test_delete_reintegrates(self, client, test_owner, two_bls):
        client.post("/bl-exclusions", json={"delivery_ref": "BL-EXCLUDE-001"}, headers=test_owner["headers"])
        res = client.delete("/bl-exclusions/BL-EXCLUDE-001", headers=test_owner["headers"])
        assert res.status_code == 200
        assert res.json() == {"deleted": True, "delivery_ref": "BL-EXCLUDE-001"}
        # List is empty again.
        assert client.get("/bl-exclusions", headers=test_owner["headers"]).json() == []

    def test_delete_404_when_not_excluded(self, client, test_owner, two_bls):
        res = client.delete("/bl-exclusions/BL-EXCLUDE-001", headers=test_owner["headers"])
        assert res.status_code == 404


# ── GET /bl-exclusions/suggestions ───────────────────────────────────────────

class TestBlSuggestions:
    def test_returns_matches(self, client, test_owner, two_bls):
        res = client.get("/bl-exclusions/suggestions", params={"q": "EXCLUDE"}, headers=test_owner["headers"])
        assert res.status_code == 200
        body = res.json()
        assert len(body) == 1
        assert body[0]["delivery_ref"] == "BL-EXCLUDE-001"
        assert body[0]["supplier"] == "Grossiste E"
        assert body[0]["total_mad"] == 300.0
        assert body[0]["nb_lines"] == 1

    def test_short_query_returns_empty(self, client, test_owner, two_bls):
        # 1-char queries are noise; require ≥ 2.
        res = client.get("/bl-exclusions/suggestions", params={"q": "B"}, headers=test_owner["headers"])
        assert res.status_code == 200
        assert res.json() == []


# ── Filter integration: excluded BL drops out of every Achat-side aggregate ──

class TestExclusionFilterIntegration:
    def test_dashboard_achats_total_excludes_bl(self, client, test_owner, two_bls):
        baseline = client.get(
            "/stats",
            params={"date_from": "2026-03-01", "date_to": "2026-03-31"},
            headers=test_owner["headers"],
        ).json()["kpis"]
        # baseline achats: 400 (BL-KEEP) + 300 (BL-EXCLUDE) = 700
        assert baseline["achats_total"] == 700.0

        client.post("/bl-exclusions", json={"delivery_ref": "BL-EXCLUDE-001"}, headers=test_owner["headers"])

        after = client.get(
            "/stats",
            params={"date_from": "2026-03-01", "date_to": "2026-03-31"},
            headers=test_owner["headers"],
        ).json()["kpis"]
        # After exclusion: only BL-KEEP's 400 should count.
        assert after["achats_total"] == 400.0

    def test_analyse_marge_bl_mode_drops_excluded_row(self, client, test_owner, two_bls):
        # Before: both BLs appear in the bl mode.
        before = client.get(
            "/stats/analyse-marge",
            params={"mode": "bl", "date_from": "2026-03-01", "date_to": "2026-03-31"},
            headers=test_owner["headers"],
        ).json()["rows"]
        refs_before = {r["delivery_ref"] for r in before}
        assert {"BL-KEEP-001", "BL-EXCLUDE-001"} <= refs_before

        client.post("/bl-exclusions", json={"delivery_ref": "BL-EXCLUDE-001"}, headers=test_owner["headers"])

        after = client.get(
            "/stats/analyse-marge",
            params={"mode": "bl", "date_from": "2026-03-01", "date_to": "2026-03-31"},
            headers=test_owner["headers"],
        ).json()["rows"]
        refs_after = {r["delivery_ref"] for r in after}
        assert "BL-EXCLUDE-001" not in refs_after
        assert "BL-KEEP-001" in refs_after

    def test_ventes_total_is_NOT_affected(self, client, test_owner, two_bls):
        """PG-007 is achats-half only — ventes are untouched (the schema has no Vente↔BL link)."""
        baseline = client.get(
            "/stats",
            params={"date_from": "2026-03-01", "date_to": "2026-03-31"},
            headers=test_owner["headers"],
        ).json()["kpis"]
        client.post("/bl-exclusions", json={"delivery_ref": "BL-EXCLUDE-001"}, headers=test_owner["headers"])
        after = client.get(
            "/stats",
            params={"date_from": "2026-03-01", "date_to": "2026-03-31"},
            headers=test_owner["headers"],
        ).json()["kpis"]
        assert after["ventes_total"] == baseline["ventes_total"]
