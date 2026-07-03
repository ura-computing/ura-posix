"""Tests for /v1/special-products/* — owner-managed product exclusions."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


@pytest.fixture
def medicament(db: Session):
    from models import Medicament
    counter = {"i": 0}

    def _make():
        counter["i"] += 1
        m = Medicament(pid=f"PSP{counter['i']:05d}", product=f"SP-Med{counter['i']}")
        db.add(m)
        db.commit()
        db.refresh(m)
        return m
    return _make


class TestListSpecialProducts:
    def test_empty_happy_path(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/special-products/")
        assert r.status_code == 200
        assert r.json() == []

    def test_unauthenticated(self, client: TestClient) -> None:
        r = client.get("/v1/special-products/")
        assert r.status_code == 401

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/special-products/")
        assert r.status_code == 403

    def test_missing_feature(self, auth_owner, set_pharmacy_features) -> None:
        client, _, p = auth_owner
        set_pharmacy_features(p.id, ())
        r = client.get("/v1/special-products/")
        assert r.status_code == 403


class TestExcludeProducts:
    def test_happy_path_inserts_new(self, auth_owner, medicament) -> None:
        client, _, _ = auth_owner
        m = medicament()
        r = client.post("/v1/special-products/", json={"medicament_ids": [m.id]})
        assert r.status_code == 201
        body = r.json()
        assert body["inserted"] == 1
        assert body["already_special"] == 0

    def test_idempotent_already_special(self, auth_owner, medicament) -> None:
        client, _, _ = auth_owner
        m = medicament()
        client.post("/v1/special-products/", json={"medicament_ids": [m.id]})
        r = client.post("/v1/special-products/", json={"medicament_ids": [m.id]})
        assert r.json()["already_special"] == 1

    def test_unknown_medicament_returns_404(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.post("/v1/special-products/", json={"medicament_ids": [999999]})
        assert r.status_code == 404

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.post("/v1/special-products/", json={"medicament_ids": [1]})
        assert r.status_code == 403


class TestReintegrateProducts:
    def test_happy_path(self, auth_owner, medicament) -> None:
        client, _, _ = auth_owner
        m = medicament()
        client.post("/v1/special-products/", json={"medicament_ids": [m.id]})
        r = client.post("/v1/special-products/reintegrate", json={"medicament_ids": [m.id]})
        assert r.status_code == 200
        body = r.json()
        assert body["reintegrated"] == 1
        assert body["not_special"] == 0

    def test_not_special_silently_counted(self, auth_owner, medicament) -> None:
        client, _, _ = auth_owner
        m = medicament()
        r = client.post("/v1/special-products/reintegrate", json={"medicament_ids": [m.id]})
        assert r.status_code == 200
        assert r.json()["not_special"] == 1
        assert r.json()["reintegrated"] == 0

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.post("/v1/special-products/reintegrate", json={"medicament_ids": [1]})
        assert r.status_code == 403


class TestMedicamentSuggestions:
    def test_min_length_enforced(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/special-products/suggestions?q=x")
        assert r.status_code == 422

    def test_happy_path_returns_list(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/special-products/suggestions?q=test")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/special-products/suggestions?q=test")
        assert r.status_code == 403
