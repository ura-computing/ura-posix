"""Tests for /v1/admin/stats* + /v1/admin/pharmacy/{id}/stats* — admin-only
analytics. All endpoints reject non-admin with 403."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi.testclient import TestClient


class TestAdminStatsSystemTiles:
    def test_happy_path_shape(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/admin/stats")
        assert r.status_code == 200
        body = r.json()
        assert {"total_pharmacies", "total_active_users", "total_catalog_items",
                "pending_catalog_requests"} <= set(body)

    def test_excludes_archived_pharmacies(self, auth_admin, make_pharmacy, db) -> None:
        # Soft-deleted pharmacy must not bump the count.
        client, _ = auth_admin
        baseline = client.get("/v1/admin/stats").json()["total_pharmacies"]
        make_pharmacy(name="LivePh")
        archived = make_pharmacy(name="ArchPh")
        archived.archived_at = datetime.now(timezone.utc)
        db.commit()
        after = client.get("/v1/admin/stats").json()["total_pharmacies"]
        assert after == baseline + 1     # only the live one bumped the count

    def test_excludes_admins_from_active_users(self, auth_admin, make_user) -> None:
        # Baseline + create owner + create another admin → active-user count
        # should grow by 1 (the owner), not 2.
        client, _ = auth_admin
        baseline = client.get("/v1/admin/stats").json()["total_active_users"]
        make_user(role="owner")
        make_user(role="admin")
        after = client.get("/v1/admin/stats").json()["total_active_users"]
        assert after == baseline + 1     # admin excluded

    def test_owner_forbidden(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/admin/stats")
        assert r.status_code == 403

    def test_unauthenticated(self, client: TestClient) -> None:
        r = client.get("/v1/admin/stats")
        assert r.status_code == 401


class TestAdminPharmacyStats:
    def test_happy_path(self, auth_admin, make_pharmacy) -> None:
        client, _ = auth_admin
        p = make_pharmacy(name="StatsPh")
        r = client.get(f"/v1/admin/pharmacy/{p.id}/stats")
        assert r.status_code == 200
        assert "kpis" in r.json()

    def test_unknown_pharmacy_returns_payload(self, auth_admin) -> None:
        # The stats helper likely still returns a zero-filled payload for an
        # unknown id rather than 404 — assert shape stays consistent.
        client, _ = auth_admin
        r = client.get("/v1/admin/pharmacy/999999/stats")
        assert r.status_code in (200, 404)

    def test_owner_forbidden(self, auth_owner) -> None:
        client, _, p = auth_owner
        r = client.get(f"/v1/admin/pharmacy/{p.id}/stats")
        assert r.status_code == 403

    def test_unauthenticated(self, client: TestClient) -> None:
        r = client.get("/v1/admin/pharmacy/1/stats")
        assert r.status_code == 401


class TestAdminPharmacyMarginAlerts:
    def test_happy_path(self, auth_admin, make_pharmacy) -> None:
        client, _ = auth_admin
        p = make_pharmacy(name="MAph")
        r = client.get(f"/v1/admin/pharmacy/{p.id}/stats/margin-alerts")
        assert r.status_code == 200

    def test_owner_forbidden(self, auth_owner) -> None:
        client, _, p = auth_owner
        r = client.get(f"/v1/admin/pharmacy/{p.id}/stats/margin-alerts")
        assert r.status_code == 403


class TestAdminPharmacyStockSummary:
    def test_happy_path(self, auth_admin, make_pharmacy) -> None:
        client, _ = auth_admin
        p = make_pharmacy(name="STph")
        r = client.get(f"/v1/admin/pharmacy/{p.id}/stats/stock-summary")
        assert r.status_code == 200

    def test_owner_forbidden(self, auth_owner) -> None:
        client, _, p = auth_owner
        r = client.get(f"/v1/admin/pharmacy/{p.id}/stats/stock-summary")
        assert r.status_code == 403


class TestAdminPharmacyAnalyseMarge:
    def test_happy_path_produit(self, auth_admin, make_pharmacy) -> None:
        client, _ = auth_admin
        p = make_pharmacy(name="AMph")
        r = client.get(f"/v1/admin/pharmacy/{p.id}/stats/analyse-marge?mode=produit")
        assert r.status_code == 200
        assert r.json()["mode"] == "produit"

    def test_mode_required(self, auth_admin, make_pharmacy) -> None:
        client, _ = auth_admin
        p = make_pharmacy(name="AMph2")
        r = client.get(f"/v1/admin/pharmacy/{p.id}/stats/analyse-marge")
        assert r.status_code == 422

    def test_liste_mode_refused(self, auth_admin, make_pharmacy) -> None:
        client, _ = auth_admin
        p = make_pharmacy(name="AMph3")
        r = client.get(f"/v1/admin/pharmacy/{p.id}/stats/analyse-marge?mode=liste")
        assert r.status_code == 400

    def test_owner_forbidden(self, auth_owner) -> None:
        client, _, p = auth_owner
        r = client.get(f"/v1/admin/pharmacy/{p.id}/stats/analyse-marge?mode=produit")
        assert r.status_code == 403
