"""Tests for admin endpoints: pharmacies, users, catalog, analytics."""

from models import Medicament, Pharmacy, User
from utils.auth import hash_password, create_access_token
from utils.constants import Role, Status
from tests.factories import make_medicament


# ── GET /admin/pharmacies ─────────────────────────────────────────────────────


def test_list_pharmacies_admin_success(client, test_admin, test_pharmacy):
    res = client.get("/admin/pharmacies", headers=test_admin["headers"])
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert any(p["name"] == "Pharmacie Test" for p in data)


def test_list_pharmacies_non_admin_403(client, test_owner):
    res = client.get("/admin/pharmacies", headers=test_owner["headers"])
    assert res.status_code == 403


# ── POST /admin/pharmacies ───────────────────────────────────────────────────


def test_create_pharmacy_success(client, test_admin):
    res = client.post("/admin/pharmacies", headers=test_admin["headers"], json={
        "name": "Pharmacie Nouvelle",
        "city": "Bouskoura",
        "address": "456 Rue Neuve",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Pharmacie Nouvelle"
    assert data["city"] == "Bouskoura"
    assert data["code"] == "BOU0001"
    assert data["address"] == "456 Rue Neuve"
    assert data["user_count"] == 0


def test_create_pharmacy_codes_increment_per_city(client, test_admin):
    """Two pharmacies in the same city → BOU0001 then BOU0002."""
    r1 = client.post("/admin/pharmacies", headers=test_admin["headers"], json={
        "name": "Pharmacie A", "city": "Bouskoura",
    })
    r2 = client.post("/admin/pharmacies", headers=test_admin["headers"], json={
        "name": "Pharmacie B", "city": "Bouskoura",
    })
    assert r1.json()["code"] == "BOU0001"
    assert r2.json()["code"] == "BOU0002"


def test_create_pharmacy_strips_accents_for_code(client, test_admin):
    res = client.post("/admin/pharmacies", headers=test_admin["headers"], json={
        "name": "Pharmacie du Centre", "city": "Fès",
    })
    assert res.json()["code"] == "FES0001"


def test_create_pharmacy_city_required_422(client, test_admin):
    res = client.post("/admin/pharmacies", headers=test_admin["headers"], json={
        "name": "Sans Ville",
    })
    assert res.status_code == 422


def test_create_pharmacy_non_admin_403(client, test_owner):
    res = client.post("/admin/pharmacies", headers=test_owner["headers"], json={
        "name": "Should Fail",
        "city": "Casablanca",
    })
    assert res.status_code == 403


# ── PUT /admin/pharmacies/{id} ───────────────────────────────────────────────


def test_update_pharmacy_success(client, test_admin, test_pharmacy):
    res = client.put(
        f"/admin/pharmacies/{test_pharmacy.id}",
        headers=test_admin["headers"],
        json={"name": "Pharmacie Renommee", "address": "789 Rue Autre"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Pharmacie Renommee"
    assert data["address"] == "789 Rue Autre"


def test_update_pharmacy_not_found_404(client, test_admin):
    res = client.put(
        "/admin/pharmacies/99999",
        headers=test_admin["headers"],
        json={"name": "Ghost"},
    )
    assert res.status_code == 404


# ── DELETE /admin/pharmacies/{id} ────────────────────────────────────────────


def test_delete_pharmacy_success(client, db, test_admin):
    pharmacy = Pharmacy(name="To Delete", address="Nowhere")
    db.add(pharmacy)
    db.flush()

    res = client.delete(
        f"/admin/pharmacies/{pharmacy.id}",
        headers=test_admin["headers"],
    )
    assert res.status_code == 200
    assert res.json()["deleted"] is True


def test_delete_pharmacy_not_found_404(client, test_admin):
    res = client.delete(
        "/admin/pharmacies/99999",
        headers=test_admin["headers"],
    )
    assert res.status_code == 404


# ── GET /admin/users ─────────────────────────────────────────────────────────


def test_list_users_admin_success(client, test_admin, test_owner, test_employee):
    res = client.get("/admin/users", headers=test_admin["headers"])
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    emails = [u["email"] for u in data]
    assert "owner@test.com" in emails
    assert "employee@test.com" in emails


def test_list_users_filter_by_pharmacy(client, db, test_admin, test_pharmacy, test_owner):
    res = client.get(
        f"/admin/users?pharmacy_id={test_pharmacy.id}",
        headers=test_admin["headers"],
    )
    assert res.status_code == 200
    data = res.json()
    # All returned users should belong to the test pharmacy
    for u in data:
        assert u["pharmacy_id"] == test_pharmacy.id


def test_list_users_non_admin_403(client, test_owner):
    res = client.get("/admin/users", headers=test_owner["headers"])
    assert res.status_code == 403


# ── PUT /admin/users/{id}/approve ────────────────────────────────────────────


def test_approve_pending_owner(client, db, test_admin):
    user = User(
        email="pendingowner@example.com",
        name="Pending Owner",
        password_hash=hash_password("pass123"),
        role=Role.OWNER,
        status=Status.PENDING,
        pharmacy_name="Pharma Pending",
    )
    db.add(user)
    db.flush()

    res = client.put(
        f"/admin/users/{user.id}/approve",
        headers=test_admin["headers"],
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == Status.ACTIVE
    assert data["pharmacy_id"] is not None  # pharmacy was auto-created


def test_approve_already_active_400(client, test_admin, test_owner):
    res = client.put(
        f"/admin/users/{test_owner['user'].id}/approve",
        headers=test_admin["headers"],
    )
    assert res.status_code == 400


# ── PUT /admin/users/{id}/permissions ────────────────────────────────────────


def test_set_user_permissions(client, test_admin, test_owner):
    perms = {"rapports": True, "import": False, "achat": True, "ventes": True, "stock": False}
    res = client.put(
        f"/admin/users/{test_owner['user'].id}/permissions",
        headers=test_admin["headers"],
        json={"permissions": perms},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["permissions"]["import"] is False
    assert data["permissions"]["rapports"] is True


def test_permissions_pharmacy_ceiling_enforced(client, db, test_admin, test_pharmacy, test_owner):
    """Cannot grant a feature that is disabled at pharmacy level."""
    test_pharmacy.options = {"import": False}
    db.flush()

    res = client.put(
        f"/admin/users/{test_owner['user'].id}/permissions",
        headers=test_admin["headers"],
        json={"permissions": {"import": True}},
    )
    assert res.status_code == 200
    data = res.json()
    # "import" should NOT appear as True because the pharmacy ceiling blocks it
    assert data["permissions"].get("import") is not True


# ── GET /admin/catalog ───────────────────────────────────────────────────────


def test_list_catalog_admin(client, db, test_admin):
    make_medicament(db, pid="CAT-001", product="Doliprane 1000mg")
    make_medicament(db, pid="CAT-002", product="Amoxicilline 500mg")

    res = client.get("/admin/catalog", headers=test_admin["headers"])
    assert res.status_code == 200
    data = res.json()
    assert "data" in data
    assert "pagination" in data
    assert data["pagination"]["total"] >= 2


def test_list_catalog_search(client, db, test_admin):
    make_medicament(db, pid="SRCH-001", product="Ibuprofene 400mg")

    res = client.get(
        "/admin/catalog?search=Ibuprofene",
        headers=test_admin["headers"],
    )
    assert res.status_code == 200
    data = res.json()
    assert data["pagination"]["total"] >= 1
    assert any("Ibuprofene" in m["product"] for m in data["data"])


def test_list_catalog_non_admin_403(client, test_owner):
    res = client.get("/admin/catalog", headers=test_owner["headers"])
    assert res.status_code == 403


# ── POST /admin/catalog ─────────────────────────────────────────────────────


def test_create_medicament_success(client, test_admin):
    res = client.post("/admin/catalog", headers=test_admin["headers"], json={
        "pid": "NEW-001",
        "product": "Vitamine C 1000mg",
        "category": "Complement",
        "ppv": 45.0,
        "pph": 35.0,
    })
    assert res.status_code == 200
    data = res.json()
    assert data["pid"] == "NEW-001"
    assert data["product"] == "Vitamine C 1000mg"


def test_create_medicament_duplicate_pid_400(client, db, test_admin):
    make_medicament(db, pid="DUP-001", product="Already Exists")

    res = client.post("/admin/catalog", headers=test_admin["headers"], json={
        "pid": "DUP-001",
        "product": "Another Product",
    })
    assert res.status_code == 400
    assert "PID" in res.json()["detail"]


# ── GET /admin/analytics ────────────────────────────────────────────────────


def test_analytics_returns_counts(client, test_admin, test_owner, test_employee):
    res = client.get("/admin/analytics", headers=test_admin["headers"])
    assert res.status_code == 200
    data = res.json()
    assert "users_by_role" in data
    assert "users_by_status" in data
    assert "monthly_registrations" in data
    assert data["users_by_role"][Role.OWNER] >= 1
    assert data["users_by_role"][Role.EMPLOYEE] >= 1


def test_analytics_non_admin_403(client, test_owner):
    res = client.get("/admin/analytics", headers=test_owner["headers"])
    assert res.status_code == 403
