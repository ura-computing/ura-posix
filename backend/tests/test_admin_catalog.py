"""Tests for /v1/admin/catalog/* — global Medicament CRUD (admin only)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


@pytest.fixture
def medicament_in_db(db: Session):
    from models import Medicament
    counter = {"i": 0}

    def _make(pid: str | None = None, product: str = "Doliprane"):
        counter["i"] += 1
        m = Medicament(
            pid=pid or f"CAT{counter['i']:05d}",
            product=f"{product} {counter['i']}",
            category="Medicament", tva="TVA (20.00%)",
            pph=10.0, ppv=15.0,
        )
        db.add(m); db.commit(); db.refresh(m)
        return m
    return _make


class TestUnclassifiedCount:
    def test_happy_path(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/admin/catalog/unclassified-count")
        assert r.status_code == 200
        assert "count" in r.json()

    def test_unauthenticated(self, client: TestClient) -> None:
        r = client.get("/v1/admin/catalog/unclassified-count")
        assert r.status_code == 401

    def test_owner_forbidden(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/admin/catalog/unclassified-count")
        assert r.status_code == 403


class TestCatalogCategories:
    def test_happy_path(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/admin/catalog/categories")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_owner_forbidden(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/admin/catalog/categories")
        assert r.status_code == 403


class TestListCatalog:
    def test_empty_happy_path(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/admin/catalog")
        assert r.status_code == 200
        body = r.json()
        assert "data" in body and "pagination" in body

    def test_with_rows(self, auth_admin, medicament_in_db) -> None:
        client, _ = auth_admin
        medicament_in_db(product="A")
        medicament_in_db(product="B")
        r = client.get("/v1/admin/catalog?limit=50")
        assert r.json()["pagination"]["total"] >= 2

    def test_owner_forbidden(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/admin/catalog")
        assert r.status_code == 403

    def test_unauthenticated(self, client: TestClient) -> None:
        r = client.get("/v1/admin/catalog")
        assert r.status_code == 401


class TestCreateMedicament:
    def test_happy_path(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.post("/v1/admin/catalog", json={
            "product": "Aspirine", "category": "Medicament", "tva": "TVA (20.00%)",
            "pph": 5.0, "ppv": 8.0,
        })
        assert r.status_code == 201
        assert r.json()["product"] == "Aspirine"

    def test_duplicate_pid_409(self, auth_admin) -> None:
        client, _ = auth_admin
        client.post("/v1/admin/catalog", json={
            "product": "DupliMed", "barcode1": "BC-DUP",
            "category": "X", "tva": "TVA (20.00%)", "pph": 1.0, "ppv": 2.0,
        })
        r = client.post("/v1/admin/catalog", json={
            "product": "DupliMed2", "barcode1": "BC-DUP",
            "category": "X", "tva": "TVA (20.00%)", "pph": 1.0, "ppv": 2.0,
        })
        assert r.status_code == 409

    def test_owner_forbidden(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.post("/v1/admin/catalog", json={
            "product": "X", "category": "Y", "tva": "T", "pph": 1.0, "ppv": 2.0,
        })
        assert r.status_code == 403


class TestUpdateMedicament:
    def test_happy_path_partial_update(self, auth_admin, medicament_in_db, db: Session) -> None:
        client, _ = auth_admin
        m = medicament_in_db()
        r = client.put(f"/v1/admin/catalog/{m.id}", json={"product": "Renamed"})
        assert r.status_code == 200
        db.refresh(m)
        assert m.product == "Renamed"

    def test_not_found(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.put("/v1/admin/catalog/999999", json={"product": "X"})
        assert r.status_code == 404

    def test_owner_forbidden(self, auth_owner, medicament_in_db) -> None:
        client, _, _ = auth_owner
        m = medicament_in_db()
        r = client.put(f"/v1/admin/catalog/{m.id}", json={"product": "X"})
        assert r.status_code == 403


class TestDeleteMedicament:
    def test_happy_path(self, auth_admin, medicament_in_db, db: Session) -> None:
        from models import Medicament
        client, _ = auth_admin
        m = medicament_in_db()
        med_id = m.id
        r = client.delete(f"/v1/admin/catalog/{med_id}")
        assert r.status_code == 204
        assert db.query(Medicament).filter(Medicament.id == med_id).first() is None

    def test_not_found(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.delete("/v1/admin/catalog/999999")
        assert r.status_code == 404

    def test_owner_forbidden(self, auth_owner, medicament_in_db) -> None:
        client, _, _ = auth_owner
        m = medicament_in_db()
        r = client.delete(f"/v1/admin/catalog/{m.id}")
        assert r.status_code == 403
