"""Tests for /v1/admin/pharmacies/* + /v1/admin/users/* — the admin's
permission-management surface."""
from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


# ── GET /admin/pharmacies (list) ──────────────────────────────────────────

class TestListPharmacies:
    def test_happy_path(self, auth_admin, make_pharmacy) -> None:
        client, _ = auth_admin
        make_pharmacy(name="Pharm A")
        make_pharmacy(name="Pharm B")
        r = client.get("/v1/admin/pharmacies")
        assert r.status_code == 200
        rows = r.json()
        assert any(p["name"] == "Pharm A" for p in rows)
        assert any(p["name"] == "Pharm B" for p in rows)

    def test_excludes_archived_by_default(self, auth_admin, make_pharmacy, db: Session) -> None:
        from datetime import datetime, timezone
        from models import Pharmacy
        client, _ = auth_admin
        p = make_pharmacy(name="ArchivedOne")
        p.archived_at = datetime.now(timezone.utc)
        db.commit()
        r = client.get("/v1/admin/pharmacies")
        assert all(row["name"] != "ArchivedOne" for row in r.json())

    def test_include_archived_true(self, auth_admin, make_pharmacy, db: Session) -> None:
        from datetime import datetime, timezone
        client, _ = auth_admin
        p = make_pharmacy(name="ArchivedTwo")
        p.archived_at = datetime.now(timezone.utc)
        db.commit()
        r = client.get("/v1/admin/pharmacies?include_archived=true")
        assert any(row["name"] == "ArchivedTwo" for row in r.json())

    def test_owner_forbidden(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.get("/v1/admin/pharmacies")
        assert r.status_code == 403

    def test_unauthenticated(self, client: TestClient) -> None:
        r = client.get("/v1/admin/pharmacies")
        assert r.status_code == 401


# ── GET /admin/pharmacies/{id} ────────────────────────────────────────────

class TestGetPharmacy:
    def test_happy_path(self, auth_admin, make_pharmacy) -> None:
        client, _ = auth_admin
        p = make_pharmacy(name="Detail")
        r = client.get(f"/v1/admin/pharmacies/{p.id}")
        assert r.status_code == 200
        body = r.json()
        assert body["id"] == p.id
        assert body["name"] == "Detail"
        assert "enabled_features" in body
        assert "members" in body
        assert "owners_union_permissions" in body

    def test_not_found(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/admin/pharmacies/999999")
        assert r.status_code == 404

    def test_owner_forbidden(self, auth_owner) -> None:
        client, _, p = auth_owner
        r = client.get(f"/v1/admin/pharmacies/{p.id}")
        assert r.status_code == 403


# ── POST /admin/pharmacies (create with auto-code) ────────────────────────

class TestCreatePharmacy:
    def test_happy_path_auto_generates_code(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.post("/v1/admin/pharmacies", json={"name": "PA", "city": "Bouskoura"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["code"] is not None
        assert body["code"].startswith("BOU")

    def test_second_in_same_city_increments(self, auth_admin, db: Session) -> None:
        client, _ = auth_admin
        c1 = client.post("/v1/admin/pharmacies", json={"name": "First", "city": "Bouskoura"})
        c2 = client.post("/v1/admin/pharmacies", json={"name": "Second", "city": "Bouskoura"})
        assert c1.status_code == 200 and c2.status_code == 200
        assert c1.json()["code"] != c2.json()["code"]
        assert c2.json()["code"].startswith("BOU")

    def test_blank_city_returns_422(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.post("/v1/admin/pharmacies", json={"name": "X", "city": ""})
        assert r.status_code == 422

    def test_missing_city_returns_422(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.post("/v1/admin/pharmacies", json={"name": "X"})
        assert r.status_code == 422

    def test_client_sent_code_is_ignored(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.post("/v1/admin/pharmacies", json={
            "name": "Y", "city": "Casablanca", "code": "CUSTOM",
        })
        assert r.status_code == 200
        # Generated, not echoed back as "CUSTOM".
        assert r.json()["code"].startswith("CAS")

    def test_default_features_enabled(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.post("/v1/admin/pharmacies", json={"name": "Z", "city": "Rabat"})
        assert r.status_code == 200
        # DEFAULT_ENABLED_FEATURES from admin_pharmacies.py
        assert {"rapports", "achats", "ventes", "stock"} <= set(r.json()["enabled_features"])

    def test_owner_forbidden(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.post("/v1/admin/pharmacies", json={"name": "X", "city": "Casa"})
        assert r.status_code == 403


# ── PATCH /admin/pharmacies/{id} ──────────────────────────────────────────

class TestUpdatePharmacy:
    def test_happy_path(self, auth_admin, make_pharmacy) -> None:
        client, _ = auth_admin
        p = make_pharmacy(name="Before")
        r = client.patch(f"/v1/admin/pharmacies/{p.id}", json={
            "name": "After", "city": p.city, "address": "10 Bd",
        })
        assert r.status_code == 200
        assert r.json()["name"] == "After"

    def test_not_found(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.patch("/v1/admin/pharmacies/999999", json={"name": "X", "city": "C"})
        assert r.status_code == 404

    def test_owner_forbidden(self, auth_owner) -> None:
        client, _, p = auth_owner
        r = client.patch(f"/v1/admin/pharmacies/{p.id}", json={"name": "X", "city": "C"})
        assert r.status_code == 403


# ── DELETE /admin/pharmacies/{id} (soft) ──────────────────────────────────

class TestArchivePharmacy:
    def test_happy_path_sets_archived_at(self, auth_admin, make_pharmacy, db: Session) -> None:
        from models import Pharmacy
        client, _ = auth_admin
        p = make_pharmacy(name="DoomedPh")
        r = client.delete(f"/v1/admin/pharmacies/{p.id}")
        assert r.status_code == 200
        db.refresh(p)
        assert p.archived_at is not None

    def test_not_found(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.delete("/v1/admin/pharmacies/999999")
        assert r.status_code == 404

    def test_owner_forbidden(self, auth_owner) -> None:
        client, _, p = auth_owner
        r = client.delete(f"/v1/admin/pharmacies/{p.id}")
        assert r.status_code == 403


# ── PUT /admin/pharmacies/{id}/features ───────────────────────────────────

class TestSetPharmacyFeatures:
    def test_happy_path(self, auth_admin, make_pharmacy) -> None:
        client, _ = auth_admin
        p = make_pharmacy(name="FeatPh")
        r = client.put(f"/v1/admin/pharmacies/{p.id}/features", json={
            "features": {"achats": True, "ventes": False, "stock": True},
        })
        assert r.status_code == 200
        feats = set(r.json()["enabled_features"])
        assert "achats" in feats and "stock" in feats
        assert "ventes" not in feats

    def test_owner_forbidden(self, auth_owner) -> None:
        client, _, p = auth_owner
        r = client.put(f"/v1/admin/pharmacies/{p.id}/features", json={"features": {}})
        assert r.status_code == 403

    def test_unknown_pharmacy_404(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.put("/v1/admin/pharmacies/999999/features", json={"features": {}})
        assert r.status_code == 404


# ── PUT /admin/users/{id}/permissions ─────────────────────────────────────

class TestSetUserPermissions:
    def test_owner_permissions_happy_path(self, auth_admin, make_user) -> None:
        client, _ = auth_admin
        owner, _ = make_user(role="owner")
        r = client.put(f"/v1/admin/users/{owner.id}/permissions", json={
            "permissions": {"achats": True, "ventes": True},
        })
        assert r.status_code == 200
        assert {"achats", "ventes"} <= set(r.json()["granted_permissions"])

    def test_employee_permissions_now_allowed(self, auth_admin, make_user, make_pharmacy) -> None:
        # The 400-guard was lifted in the RBAC chunk. Admin can edit employees.
        client, _ = auth_admin
        emp, _ = make_user(role="employee", pharmacy=make_pharmacy())
        r = client.put(f"/v1/admin/users/{emp.id}/permissions", json={
            "permissions": {"stock": True},
        })
        assert r.status_code == 200

    def test_editing_admin_is_400(self, auth_admin, make_user) -> None:
        client, target = auth_admin
        another_admin, _ = make_user(role="admin")
        r = client.put(f"/v1/admin/users/{another_admin.id}/permissions", json={"permissions": {}})
        assert r.status_code == 400

    def test_unknown_user_404(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.put("/v1/admin/users/999999/permissions", json={"permissions": {}})
        assert r.status_code == 404

    def test_owner_forbidden(self, auth_owner, make_user) -> None:
        client, _, _ = auth_owner
        target, _ = make_user(role="owner")
        r = client.put(f"/v1/admin/users/{target.id}/permissions", json={"permissions": {}})
        assert r.status_code == 403


# ── POST /admin/pharmacies/{id}/users (create) ────────────────────────────

class TestCreateUser:
    def test_happy_path_returns_temp_password(self, auth_admin, make_pharmacy) -> None:
        client, _ = auth_admin
        p = make_pharmacy(name="HostPharm")
        r = client.post(f"/v1/admin/pharmacies/{p.id}/users", json={
            "email": "new.owner@example.com",
            "full_name": "New Owner",
            "role": "owner",
            "pharmacy_id": p.id,
        })
        assert r.status_code == 200
        body = r.json()
        assert body["member"]["email"] == "new.owner@example.com"
        assert body["temp_password"] and len(body["temp_password"]) > 0

    def test_pharmacy_id_mismatch_400(self, auth_admin, make_pharmacy) -> None:
        client, _ = auth_admin
        p = make_pharmacy(name="X")
        r = client.post(f"/v1/admin/pharmacies/{p.id}/users", json={
            "email": "ok@example.com", "full_name": "OK", "role": "owner",
            "pharmacy_id": p.id + 999,
        })
        assert r.status_code == 400

    def test_duplicate_email_409(self, auth_admin, make_user, make_pharmacy) -> None:
        client, _ = auth_admin
        existing, _ = make_user(role="owner")
        p = make_pharmacy(name="OtherPh")
        r = client.post(f"/v1/admin/pharmacies/{p.id}/users", json={
            "email": existing.email, "full_name": "Dup", "role": "owner",
            "pharmacy_id": p.id,
        })
        assert r.status_code == 409

    def test_unknown_pharmacy_404(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.post("/v1/admin/pharmacies/999999/users", json={
            "email": "x@example.com", "full_name": "X", "role": "owner", "pharmacy_id": 999999,
        })
        assert r.status_code == 404

    def test_owner_forbidden(self, auth_owner) -> None:
        client, _, p = auth_owner
        r = client.post(f"/v1/admin/pharmacies/{p.id}/users", json={
            "email": "y@example.com", "full_name": "Y", "role": "employee", "pharmacy_id": p.id,
        })
        assert r.status_code == 403


# ── POST /admin/users/{id}/reset-password ─────────────────────────────────

class TestResetUserPassword:
    def test_happy_path_returns_new_temp_pw(self, auth_admin, make_user, db: Session) -> None:
        client, _ = auth_admin
        target, _ = make_user(role="owner")
        old_hash = target.password_hash
        r = client.post(f"/v1/admin/users/{target.id}/reset-password")
        assert r.status_code == 200
        assert r.json()["temp_password"]
        db.refresh(target)
        assert target.password_hash != old_hash
        assert target.token_version == 1   # bumped to invalidate active sessions

    def test_unknown_user_404(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.post("/v1/admin/users/999999/reset-password")
        assert r.status_code == 404

    def test_owner_forbidden(self, auth_owner, make_user) -> None:
        client, _, _ = auth_owner
        target, _ = make_user(role="owner")
        r = client.post(f"/v1/admin/users/{target.id}/reset-password")
        assert r.status_code == 403


# ── PATCH /admin/users/{id}/status ────────────────────────────────────────

class TestPatchUserStatus:
    def test_happy_path_toggle_inactive(self, auth_admin, make_user, db: Session) -> None:
        client, _ = auth_admin
        target, _ = make_user(role="owner")
        r = client.patch(f"/v1/admin/users/{target.id}/status", json={"status": "inactive"})
        assert r.status_code == 200
        assert r.json()["status"] == "inactive"
        db.refresh(target)
        assert target.token_version == 1   # bumped on deactivation

    def test_unknown_user_404(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.patch("/v1/admin/users/999999/status", json={"status": "inactive"})
        assert r.status_code == 404

    def test_validation_bad_status_422(self, auth_admin, make_user) -> None:
        client, _ = auth_admin
        target, _ = make_user(role="owner")
        r = client.patch(f"/v1/admin/users/{target.id}/status", json={"status": "bogus"})
        assert r.status_code == 422

    def test_owner_forbidden(self, auth_owner, make_user) -> None:
        client, _, _ = auth_owner
        target, _ = make_user(role="owner")
        r = client.patch(f"/v1/admin/users/{target.id}/status", json={"status": "inactive"})
        assert r.status_code == 403


# ── DELETE /admin/users/{id} ──────────────────────────────────────────────

class TestDeleteUser:
    def test_happy_path(self, auth_admin, make_user, db: Session) -> None:
        from models import User
        client, _ = auth_admin
        target, _ = make_user(role="owner")
        target_id = target.id
        r = client.delete(f"/v1/admin/users/{target_id}")
        assert r.status_code == 200
        assert db.query(User).filter(User.id == target_id).first() is None

    def test_unknown_user_404(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.delete("/v1/admin/users/999999")
        assert r.status_code == 404

    def test_owner_forbidden(self, auth_owner, make_user) -> None:
        client, _, _ = auth_owner
        target, _ = make_user(role="owner")
        r = client.delete(f"/v1/admin/users/{target.id}")
        assert r.status_code == 403
