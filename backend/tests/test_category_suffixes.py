"""Tests for /v1/category-suffixes/* — admin-only global mapping CRUD."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


def _body(category: str = "Medicament", suffix: str = "-1", color: str | None = "teal") -> dict:
    return {"category": category, "suffix": suffix, "color": color}


class TestListCategorySuffixes:
    def test_empty_happy_path(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/category-suffixes")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_with_rows(self, auth_admin) -> None:
        client, _ = auth_admin
        client.post("/v1/category-suffixes", json=_body(category="Alpha", suffix="-A"))
        client.post("/v1/category-suffixes", json=_body(category="Beta", suffix="-B"))
        r = client.get("/v1/category-suffixes")
        assert len(r.json()) >= 2

    def test_owner_forbidden(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/category-suffixes")
        assert r.status_code == 403

    def test_unauthenticated(self, client: TestClient) -> None:
        r = client.get("/v1/category-suffixes")
        assert r.status_code == 401


class TestCreateCategorySuffix:
    def test_happy_path(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.post("/v1/category-suffixes", json=_body(category="NewCat", suffix="-N"))
        assert r.status_code == 201
        body = r.json()
        assert body["category"] == "NewCat"
        assert body["suffix"] == "-N"
        assert body["color"] == "teal"

    def test_null_color_allowed(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.post("/v1/category-suffixes", json=_body(category="NoColor", color=None))
        assert r.status_code == 201
        assert r.json()["color"] is None

    def test_invalid_color_422(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.post("/v1/category-suffixes", json=_body(category="Bad", color="puce"))
        assert r.status_code == 422

    def test_duplicate_category_409(self, auth_admin) -> None:
        client, _ = auth_admin
        client.post("/v1/category-suffixes", json=_body(category="Dup", suffix="-D"))
        r = client.post("/v1/category-suffixes", json=_body(category="Dup", suffix="-X"))
        assert r.status_code == 409

    def test_missing_fields_422(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.post("/v1/category-suffixes", json={"category": "OnlyCat"})
        assert r.status_code == 422

    def test_owner_forbidden(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.post("/v1/category-suffixes", json=_body(category="X", suffix="-Y"))
        assert r.status_code == 403


class TestUpdateCategorySuffix:
    def test_happy_path(self, auth_admin) -> None:
        client, _ = auth_admin
        created = client.post("/v1/category-suffixes", json=_body(category="UpA", suffix="-1")).json()
        r = client.put(f"/v1/category-suffixes/{created['id']}",
                       json=_body(category="UpA", suffix="-2", color="rose"))
        assert r.status_code == 200
        body = r.json()
        assert body["suffix"] == "-2"
        assert body["color"] == "rose"

    def test_rename_collides_with_existing_409(self, auth_admin) -> None:
        client, _ = auth_admin
        client.post("/v1/category-suffixes", json=_body(category="ColA", suffix="-1"))
        other = client.post("/v1/category-suffixes", json=_body(category="ColB", suffix="-2")).json()
        r = client.put(f"/v1/category-suffixes/{other['id']}",
                       json=_body(category="ColA", suffix="-3"))
        assert r.status_code == 409

    def test_not_found(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.put("/v1/category-suffixes/999999", json=_body())
        assert r.status_code == 404

    def test_owner_forbidden(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.put("/v1/category-suffixes/1", json=_body())
        assert r.status_code == 403


class TestDeleteCategorySuffix:
    def test_happy_path(self, auth_admin, db: Session) -> None:
        from models import CategorySuffix
        client, _ = auth_admin
        created = client.post("/v1/category-suffixes", json=_body(category="ToDel", suffix="-D")).json()
        r = client.delete(f"/v1/category-suffixes/{created['id']}")
        assert r.status_code == 204
        assert db.query(CategorySuffix).filter(CategorySuffix.id == created["id"]).first() is None

    def test_not_found(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.delete("/v1/category-suffixes/999999")
        assert r.status_code == 404

    def test_owner_forbidden(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.delete("/v1/category-suffixes/1")
        assert r.status_code == 403
