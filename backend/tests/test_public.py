"""Tests for public endpoints (no auth required)."""


def test_health_check(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_list_public_pharmacies_empty(client):
    res = client.get("/public/pharmacies")
    assert res.status_code == 200
    assert res.json() == []


def test_list_public_pharmacies_with_data(client, test_pharmacy):
    res = client.get("/public/pharmacies")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    assert any(p["name"] == "Pharmacie Test" for p in data)
