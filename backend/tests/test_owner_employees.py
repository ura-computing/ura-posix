"""Tests for /v1/owner/employees/* — Gérer mon équipe surface.

Every endpoint requires the caller to be an active owner and operates within
their own pharmacy. Cross-pharmacy or cross-role access must 403/404."""
from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


# ── GET /owner/employees ──────────────────────────────────────────────────

class TestListEmployees:
    def test_happy_path_returns_shape(self, auth_owner) -> None:
        client, _user, _ = auth_owner
        r = client.get("/v1/owner/employees")
        assert r.status_code == 200
        body = r.json()
        assert "employees" in body and isinstance(body["employees"], list)
        assert "pharmacy_features" in body
        assert "my_permissions" in body

    def test_excludes_other_pharmacies_employees(self, auth_owner, make_user, make_pharmacy) -> None:
        client, _owner, my_pharm = auth_owner
        other_pharm = make_pharmacy(name="OtherPh")
        make_user(role="employee", pharmacy=other_pharm, email="other.emp@example.com")
        r = client.get("/v1/owner/employees")
        emails = [e["email"] for e in r.json()["employees"]]
        assert "other.emp@example.com" not in emails

    def test_unauthenticated(self, client: TestClient) -> None:
        r = client.get("/v1/owner/employees")
        assert r.status_code == 401

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.get("/v1/owner/employees")
        assert r.status_code == 403   # require_pharmacy_owner rejects admin


# ── POST /owner/employees (create employee) ───────────────────────────────

class TestCreateEmployee:
    def test_happy_path(self, auth_owner) -> None:
        client, _owner, pharm = auth_owner
        r = client.post("/v1/owner/employees", json={
            "email": "new.emp@example.com", "full_name": "New Emp",
            "role": "employee", "pharmacy_id": pharm.id,
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["member"]["email"] == "new.emp@example.com"
        assert body["member"]["role"] == "employee"
        assert body["temp_password"]

    def test_role_is_locked_to_employee(self, auth_owner) -> None:
        # Even if client sends role=owner, server hardcodes "employee".
        client, _owner, pharm = auth_owner
        r = client.post("/v1/owner/employees", json={
            "email": "sneaky@example.com", "full_name": "S",
            "role": "owner", "pharmacy_id": pharm.id,
        })
        assert r.status_code == 200, r.text
        assert r.json()["member"]["role"] == "employee"

    def test_duplicate_email_409(self, auth_owner, make_user) -> None:
        client, _owner, pharm = auth_owner
        existing, _ = make_user(role="owner", email="dup@example.com")
        r = client.post("/v1/owner/employees", json={
            "email": "dup@example.com", "full_name": "D",
            "role": "employee", "pharmacy_id": pharm.id,
        })
        assert r.status_code == 409

    def test_admin_forbidden(self, auth_admin, make_pharmacy) -> None:
        client, _ = auth_admin
        pharm = make_pharmacy(name="X")
        r = client.post("/v1/owner/employees", json={
            "email": "x@example.com", "full_name": "X",
            "role": "employee", "pharmacy_id": pharm.id,
        })
        assert r.status_code == 403


# ── PUT /owner/employees/{id}/permissions ─────────────────────────────────

class TestSetEmployeePermissions:
    def test_happy_path(self, auth_owner, make_user, db: Session) -> None:
        client, _owner, pharmacy = auth_owner
        emp, _ = make_user(role="employee", pharmacy=pharmacy)
        r = client.put(f"/v1/owner/employees/{emp.id}/permissions", json={
            "permissions": {"achats": True, "ventes": True, "stock": False},
        })
        assert r.status_code == 200
        granted = set(r.json()["granted_permissions"])
        assert {"achats", "ventes"} <= granted
        assert "stock" not in granted

    def test_cannot_edit_employee_of_another_pharmacy(self, auth_owner, make_user, make_pharmacy) -> None:
        client, _owner, _ = auth_owner
        other_pharm = make_pharmacy(name="OtherPh")
        foreign_emp, _ = make_user(role="employee", pharmacy=other_pharm)
        r = client.put(f"/v1/owner/employees/{foreign_emp.id}/permissions", json={"permissions": {}})
        assert r.status_code == 404

    def test_cannot_edit_an_owner_as_employee(self, auth_owner, make_user) -> None:
        client, _owner, pharmacy = auth_owner
        # Owner role user in the same pharmacy → 404 because the filter requires role='employee'.
        target_owner, _ = make_user(role="owner", pharmacy=pharmacy)
        r = client.put(f"/v1/owner/employees/{target_owner.id}/permissions", json={"permissions": {}})
        assert r.status_code == 404

    def test_unknown_employee_404(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.put("/v1/owner/employees/999999/permissions", json={"permissions": {}})
        assert r.status_code == 404

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.put("/v1/owner/employees/1/permissions", json={"permissions": {}})
        assert r.status_code == 403


# ── PATCH /owner/employees/{id}/status ────────────────────────────────────

class TestPatchEmployeeStatus:
    def test_happy_path_inactive_bumps_token_version(self, auth_owner, make_user, db: Session) -> None:
        client, _owner, pharmacy = auth_owner
        emp, _ = make_user(role="employee", pharmacy=pharmacy)
        version_before = emp.token_version
        r = client.patch(f"/v1/owner/employees/{emp.id}/status", json={"status": "inactive"})
        assert r.status_code == 200
        assert r.json()["status"] == "inactive"
        db.refresh(emp)
        assert emp.token_version == version_before + 1

    def test_invalid_status_422(self, auth_owner, make_user) -> None:
        client, _, pharmacy = auth_owner
        emp, _ = make_user(role="employee", pharmacy=pharmacy)
        r = client.patch(f"/v1/owner/employees/{emp.id}/status", json={"status": "bogus"})
        assert r.status_code == 422

    def test_cross_pharmacy_404(self, auth_owner, make_user, make_pharmacy) -> None:
        client, _, _ = auth_owner
        foreign = make_user(role="employee", pharmacy=make_pharmacy())[0]
        r = client.patch(f"/v1/owner/employees/{foreign.id}/status", json={"status": "inactive"})
        assert r.status_code == 404

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.patch("/v1/owner/employees/1/status", json={"status": "inactive"})
        assert r.status_code == 403


# ── POST /owner/employees/{id}/reset-password ─────────────────────────────

class TestResetEmployeePassword:
    def test_happy_path(self, auth_owner, make_user, db: Session) -> None:
        client, _, pharmacy = auth_owner
        emp, _ = make_user(role="employee", pharmacy=pharmacy)
        old_hash = emp.password_hash
        r = client.post(f"/v1/owner/employees/{emp.id}/reset-password")
        assert r.status_code == 200
        assert r.json()["temp_password"]
        db.refresh(emp)
        assert emp.password_hash != old_hash
        assert emp.token_version == 1

    def test_cross_pharmacy_404(self, auth_owner, make_user, make_pharmacy) -> None:
        client, _, _ = auth_owner
        foreign = make_user(role="employee", pharmacy=make_pharmacy())[0]
        r = client.post(f"/v1/owner/employees/{foreign.id}/reset-password")
        assert r.status_code == 404

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.post("/v1/owner/employees/1/reset-password")
        assert r.status_code == 403


# ── DELETE /owner/employees/{id} ──────────────────────────────────────────

class TestDeleteEmployee:
    def test_happy_path(self, auth_owner, make_user, db: Session) -> None:
        from models import User
        client, _, pharmacy = auth_owner
        emp, _ = make_user(role="employee", pharmacy=pharmacy)
        emp_id = emp.id
        r = client.delete(f"/v1/owner/employees/{emp_id}")
        assert r.status_code == 200
        assert db.query(User).filter(User.id == emp_id).first() is None

    def test_cross_pharmacy_404(self, auth_owner, make_user, make_pharmacy) -> None:
        client, _, _ = auth_owner
        foreign = make_user(role="employee", pharmacy=make_pharmacy())[0]
        r = client.delete(f"/v1/owner/employees/{foreign.id}")
        assert r.status_code == 404

    def test_admin_forbidden(self, auth_admin) -> None:
        client, _ = auth_admin
        r = client.delete("/v1/owner/employees/1")
        assert r.status_code == 403
