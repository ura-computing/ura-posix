"""Tests for owner endpoints (routers/owner.py)."""

from models import Pharmacy, User
from utils.auth import hash_password, create_access_token
from utils.constants import Role, Status


# ── Helpers ──────────────────────────────────────────────────────────────────


def _make_employee(db, pharmacy_id, email, status=Status.PENDING, **kwargs):
    """Create an employee user in the given pharmacy."""
    user = User(
        email=email,
        name=f"Employee {email}",
        phone="0600000099",
        password_hash=hash_password("pass123"),
        role=Role.EMPLOYEE,
        status=status,
        pharmacy_id=pharmacy_id,
        **kwargs,
    )
    db.add(user)
    db.flush()
    return user


def _other_pharmacy(db):
    """Create a second, unrelated pharmacy + owner for cross-pharmacy tests."""
    pharmacy = Pharmacy(name="Pharmacie Autre", address="456 Rue Autre")
    db.add(pharmacy)
    db.flush()
    owner = User(
        email="other_owner@test.com",
        name="Other Owner",
        password_hash=hash_password("other123"),
        role=Role.OWNER,
        status=Status.ACTIVE,
        pharmacy_id=pharmacy.id,
    )
    db.add(owner)
    db.flush()
    token = create_access_token({"sub": str(owner.id)})
    return {
        "pharmacy": pharmacy,
        "owner": owner,
        "headers": {"Authorization": f"Bearer {token}"},
    }


# ── GET /owner/employees ────────────────────────────────────────────────────


class TestListEmployees:
    def test_returns_employees_in_own_pharmacy(self, client, db, test_owner):
        _make_employee(db, test_owner["pharmacy"].id, "emp1@test.com", status=Status.ACTIVE)
        _make_employee(db, test_owner["pharmacy"].id, "emp2@test.com", status=Status.PENDING)

        res = client.get("/owner/employees", headers=test_owner["headers"])
        assert res.status_code == 200
        data = res.json()
        emails = {e["email"] for e in data}
        # The fixture also creates test_employee in conftest, but we check our two
        assert "emp1@test.com" in emails
        assert "emp2@test.com" in emails

    def test_excludes_employees_from_other_pharmacy(self, client, db, test_owner):
        other = _other_pharmacy(db)
        _make_employee(db, other["pharmacy"].id, "foreign@test.com")

        res = client.get("/owner/employees", headers=test_owner["headers"])
        assert res.status_code == 200
        emails = {e["email"] for e in res.json()}
        assert "foreign@test.com" not in emails

    def test_requires_owner_role(self, client, test_employee):
        res = client.get("/owner/employees", headers=test_employee["headers"])
        assert res.status_code == 403


# ── PUT /owner/employees/{id}/approve ────────────────────────────────────────


class TestApproveEmployee:
    def test_approve_pending_employee(self, client, db, test_owner):
        emp = _make_employee(db, test_owner["pharmacy"].id, "pending@test.com")
        assert emp.status == Status.PENDING

        res = client.put(
            f"/owner/employees/{emp.id}/approve",
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        assert res.json()["status"] == Status.ACTIVE

    def test_approve_wrong_pharmacy_returns_403(self, client, db, test_owner):
        other = _other_pharmacy(db)
        emp = _make_employee(db, other["pharmacy"].id, "foreign_pending@test.com")

        res = client.put(
            f"/owner/employees/{emp.id}/approve",
            headers=test_owner["headers"],
        )
        assert res.status_code == 403

    def test_approve_non_pending_returns_400(self, client, db, test_owner):
        emp = _make_employee(
            db, test_owner["pharmacy"].id, "active@test.com", status=Status.ACTIVE,
        )

        res = client.put(
            f"/owner/employees/{emp.id}/approve",
            headers=test_owner["headers"],
        )
        assert res.status_code == 400

    def test_approve_nonexistent_user_returns_404(self, client, test_owner):
        res = client.put(
            "/owner/employees/99999/approve",
            headers=test_owner["headers"],
        )
        assert res.status_code == 404


# ── PUT /owner/employees/{id}/reject ─────────────────────────────────────────


class TestRejectEmployee:
    def test_reject_employee(self, client, db, test_owner):
        emp = _make_employee(db, test_owner["pharmacy"].id, "to_reject@test.com")

        res = client.put(
            f"/owner/employees/{emp.id}/reject",
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        assert res.json()["status"] == Status.REJECTED

    def test_reject_wrong_pharmacy_returns_403(self, client, db, test_owner):
        other = _other_pharmacy(db)
        emp = _make_employee(db, other["pharmacy"].id, "other_reject@test.com")

        res = client.put(
            f"/owner/employees/{emp.id}/reject",
            headers=test_owner["headers"],
        )
        assert res.status_code == 403


# ── PUT /owner/employees/{id}/permissions ────────────────────────────────────


class TestUpdatePermissions:
    def test_set_permissions_on_employee(self, client, db, test_owner):
        emp = _make_employee(
            db, test_owner["pharmacy"].id, "perm_emp@test.com", status=Status.ACTIVE,
        )

        res = client.put(
            f"/owner/employees/{emp.id}/permissions",
            headers=test_owner["headers"],
            json={"permissions": {"import": True, "rapports": False}},
        )
        assert res.status_code == 200
        perms = res.json()["permissions"]
        assert perms["import"] is True
        assert perms["rapports"] is False

    def test_cannot_grant_beyond_own_permissions(self, client, db, test_pharmacy):
        """Owner with restricted permissions cannot grant those features to employees."""
        # Create an owner who has 'import' explicitly disabled
        restricted_owner = User(
            email="restricted_owner@test.com",
            name="Restricted Owner",
            phone="0600000010",
            password_hash=hash_password("owner123"),
            role=Role.OWNER,
            status=Status.ACTIVE,
            pharmacy_id=test_pharmacy.id,
            permissions={"import": False},
        )
        db.add(restricted_owner)
        db.flush()
        token = create_access_token({"sub": str(restricted_owner.id)})
        headers = {"Authorization": f"Bearer {token}"}

        emp = _make_employee(
            db, test_pharmacy.id, "limit_emp@test.com", status=Status.ACTIVE,
        )

        res = client.put(
            f"/owner/employees/{emp.id}/permissions",
            headers=headers,
            json={"permissions": {"import": True, "rapports": True}},
        )
        assert res.status_code == 200
        perms = res.json()["permissions"]
        # 'import: True' should have been stripped because the owner has import=False
        assert "import" not in perms or perms.get("import") is not True
        # 'rapports: True' should be allowed
        assert perms["rapports"] is True

    def test_cannot_grant_beyond_pharmacy_options(self, client, db):
        """When pharmacy options disable a feature, owner cannot grant it."""
        pharmacy = Pharmacy(
            name="Pharmacie Limitee",
            address="789 Rue Limitee",
            options={"stock": False},
        )
        db.add(pharmacy)
        db.flush()

        owner = User(
            email="pharm_limit_owner@test.com",
            name="Pharm Limit Owner",
            phone="0600000020",
            password_hash=hash_password("owner123"),
            role=Role.OWNER,
            status=Status.ACTIVE,
            pharmacy_id=pharmacy.id,
            permissions={},
        )
        db.add(owner)
        db.flush()
        token = create_access_token({"sub": str(owner.id)})
        headers = {"Authorization": f"Bearer {token}"}

        emp = _make_employee(
            db, pharmacy.id, "pharm_limit_emp@test.com", status=Status.ACTIVE,
        )

        res = client.put(
            f"/owner/employees/{emp.id}/permissions",
            headers=headers,
            json={"permissions": {"stock": True, "rapports": True}},
        )
        assert res.status_code == 200
        perms = res.json()["permissions"]
        # 'stock: True' should be stripped because pharmacy options has stock=False
        assert "stock" not in perms or perms.get("stock") is not True
        assert perms["rapports"] is True

    def test_permissions_rejects_non_employee_target(self, client, db, test_owner):
        """Setting permissions on a non-employee user returns 400."""
        other_owner = User(
            email="another_owner@test.com",
            name="Another Owner",
            password_hash=hash_password("owner123"),
            role=Role.OWNER,
            status=Status.ACTIVE,
            pharmacy_id=test_owner["pharmacy"].id,
        )
        db.add(other_owner)
        db.flush()

        res = client.put(
            f"/owner/employees/{other_owner.id}/permissions",
            headers=test_owner["headers"],
            json={"permissions": {"import": True}},
        )
        assert res.status_code == 400


# ── GET /owner/notifications ─────────────────────────────────────────────────


class TestOwnerNotifications:
    def test_returns_pending_employees(self, client, db, test_owner):
        _make_employee(db, test_owner["pharmacy"].id, "notif1@test.com", status=Status.PENDING)
        _make_employee(db, test_owner["pharmacy"].id, "notif2@test.com", status=Status.ACTIVE)

        res = client.get("/owner/notifications", headers=test_owner["headers"])
        assert res.status_code == 200
        data = res.json()
        pending = data["pending_employees"]
        emails = {e["email"] for e in pending}
        assert "notif1@test.com" in emails
        # Active employee should not appear in notifications
        assert "notif2@test.com" not in emails

    def test_empty_when_no_pending(self, client, db, test_owner):
        # No pending employees created — just the owner
        res = client.get("/owner/notifications", headers=test_owner["headers"])
        assert res.status_code == 200
        assert res.json()["pending_employees"] == []


# ── PUT /owner/employees/{id}/revoke ─────────────────────────────────────────


class TestRevokeEmployee:
    def test_revoke_active_employee(self, client, db, test_owner):
        emp = _make_employee(
            db, test_owner["pharmacy"].id, "revoke@test.com", status=Status.ACTIVE,
        )

        res = client.put(
            f"/owner/employees/{emp.id}/revoke",
            headers=test_owner["headers"],
        )
        assert res.status_code == 200
        assert res.json()["status"] == Status.PENDING

    def test_revoke_non_active_returns_400(self, client, db, test_owner):
        emp = _make_employee(
            db, test_owner["pharmacy"].id, "revoke_pending@test.com", status=Status.PENDING,
        )

        res = client.put(
            f"/owner/employees/{emp.id}/revoke",
            headers=test_owner["headers"],
        )
        assert res.status_code == 400

    def test_revoke_wrong_pharmacy_returns_403(self, client, db, test_owner):
        other = _other_pharmacy(db)
        emp = _make_employee(
            db, other["pharmacy"].id, "other_revoke@test.com", status=Status.ACTIVE,
        )

        res = client.put(
            f"/owner/employees/{emp.id}/revoke",
            headers=test_owner["headers"],
        )
        assert res.status_code == 403


class TestInviteEmployee:
    """POST /owner/employees/invite — owner creates an ACTIVE employee
    without a password and the backend emails an invitation link."""

    def test_owner_invites_new_employee(self, client, db, test_owner, monkeypatch):
        sent: list = []

        async def _fake(to_email, token, inviter_name, pharmacy_name):
            sent.append((to_email, token))

        monkeypatch.setattr("routers.owner.send_invite_email", _fake)

        res = client.post(
            "/owner/employees/invite",
            json={"email": "new.emp@example.com", "name": "Karim"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 201
        data = res.json()
        assert data["email"] == "new.emp@example.com"
        assert data["role"] == Role.EMPLOYEE
        assert data["status"] == Status.ACTIVE
        assert data["pharmacy_id"] == test_owner["pharmacy"].id

        created = db.query(User).filter(User.email == "new.emp@example.com").first()
        assert created is not None
        # No password set yet — invitee will set one via the email link.
        assert created.password_hash is None
        assert created.reset_token is not None
        assert created.reset_token_expires is not None

    def test_invite_duplicate_email_400(self, client, test_owner, monkeypatch):
        async def _noop(*args, **kwargs):
            pass

        monkeypatch.setattr("routers.owner.send_invite_email", _noop)
        client.post(
            "/owner/employees/invite",
            json={"email": "dup.invite@example.com"},
            headers=test_owner["headers"],
        )
        res = client.post(
            "/owner/employees/invite",
            json={"email": "dup.invite@example.com"},
            headers=test_owner["headers"],
        )
        assert res.status_code == 400
        assert "déjà enregistré" in res.json()["detail"]

    def test_employee_cannot_invite_403(self, client, test_employee):
        res = client.post(
            "/owner/employees/invite",
            json={"email": "should.not@example.com"},
            headers=test_employee["headers"],
        )
        # Ticket 4b: employees cannot create accounts.
        assert res.status_code == 403
