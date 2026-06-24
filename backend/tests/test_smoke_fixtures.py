"""Smoke that conftest's auth fixtures actually issue valid sessions.
Kept tiny on purpose; per-router tests cover real behaviour."""


def test_auth_admin_can_hit_admin_endpoint(auth_admin) -> None:
    client, _user = auth_admin
    r = client.get("/v1/admin/stats")
    assert r.status_code == 200, r.text
    body = r.json()
    assert {"total_pharmacies", "total_active_users", "total_catalog_items", "pending_catalog_requests"} <= set(body)


def test_auth_owner_can_hit_owner_endpoint(auth_owner) -> None:
    client, _user, _pharm = auth_owner
    r = client.get("/v1/stats")
    assert r.status_code == 200, r.text
    assert "kpis" in r.json()


def test_auth_employee_has_separate_session(auth_employee) -> None:
    client, employee, _pharm = auth_employee
    r = client.get("/v1/auth/me")
    assert r.status_code == 200, r.text
    assert r.json()["user"]["email"] == employee.email
