"""Tests for /v1/stats* — the owner-side analytics endpoints.

Feature-gated as follows:
  /stats                   → feature="rapports"
  /stats/margin-alerts     → feature="alertes"
  /stats/stock-summary     → feature="stock"
  /stats/stock-abcd        → feature="stock"
  /stats/peremptions       → feature="stock"
  /stats/analyse-marge     → feature="analyse"
  /stats/analyse-liste     → feature="analyse"
"""
from __future__ import annotations

from fastapi.testclient import TestClient


# Featureless owner — drop all features so the gate fires.
def _strip(set_pharmacy_features, p):
    set_pharmacy_features(p.id, ())


class TestGetStats:
    def test_happy_path(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/stats")
        assert r.status_code == 200
        body = r.json()
        assert "kpis" in body and "marge" in body and "tva" in body

    def test_unauthenticated(self, client: TestClient) -> None:
        r = client.get("/v1/stats")
        assert r.status_code == 401

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/stats")
        assert r.status_code == 403

    def test_missing_feature(self, auth_owner, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        _strip(set_pharmacy_features, p)
        r = client.get("/v1/stats")
        assert r.status_code == 403


class TestMarginAlerts:
    def test_happy_path(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/stats/margin-alerts")
        assert r.status_code == 200

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/stats/margin-alerts")
        assert r.status_code == 403

    def test_missing_feature(self, auth_owner, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        _strip(set_pharmacy_features, p)
        r = client.get("/v1/stats/margin-alerts")
        assert r.status_code == 403


class TestStockSummary:
    def test_happy_path(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/stats/stock-summary")
        assert r.status_code == 200

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/stats/stock-summary")
        assert r.status_code == 403


class TestStockAbcd:
    def test_happy_path(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/stats/stock-abcd")
        assert r.status_code == 200

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/stats/stock-abcd")
        assert r.status_code == 403

    def test_missing_feature(self, auth_owner, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        _strip(set_pharmacy_features, p)
        r = client.get("/v1/stats/stock-abcd")
        assert r.status_code == 403


class TestPeremptions:
    def test_happy_path(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/stats/peremptions")
        assert r.status_code == 200

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/stats/peremptions")
        assert r.status_code == 403


class TestAnalyseMarge:
    def test_happy_path_produit(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/stats/analyse-marge?mode=produit")
        assert r.status_code == 200
        assert r.json()["mode"] == "produit"

    def test_mode_required(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/stats/analyse-marge")
        assert r.status_code == 422

    def test_invalid_mode_422(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/stats/analyse-marge?mode=bogus")
        assert r.status_code == 422

    def test_liste_mode_routed_to_post(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/stats/analyse-marge?mode=liste")
        assert r.status_code == 400
        assert "POST" in r.json()["detail"]

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/stats/analyse-marge?mode=produit")
        assert r.status_code == 403

    def test_missing_feature(self, auth_owner, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        _strip(set_pharmacy_features, p)
        r = client.get("/v1/stats/analyse-marge?mode=produit")
        assert r.status_code == 403


class TestAnalyseListe:
    def test_happy_path(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.post("/v1/stats/analyse-liste", json={
            "items": [{"name": "X", "pid": "P00001"}],
            "date_from": None, "date_to": None, "category_type": "all",
        })
        assert r.status_code == 200
        assert r.json()["mode"] == "liste"

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.post("/v1/stats/analyse-liste", json={"items": []})
        assert r.status_code == 403

    def test_missing_feature(self, auth_owner, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        _strip(set_pharmacy_features, p)
        r = client.post("/v1/stats/analyse-liste", json={"items": []})
        assert r.status_code == 403
