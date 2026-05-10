"""Tests for auth endpoints: signup, login, me, profile update, password reset, WhatsApp OTP."""

import secrets
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

from models import User
from utils.auth import hash_password
from utils.constants import Role, Status


# ── POST /auth/signup ─────────────────────────────────────────────────────────


def test_signup_owner_success(client):
    res = client.post("/auth/signup", json={
        "email": "newowner@example.com",
        "password": "secret123",
        "name": "New Owner",
        "phone": "0611111111",
        "role": "owner",
        "pharmacy_name": "Pharmacie Nouvelle",
        "pharmacy_city": "Bouskoura",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["access_token"]
    assert data["user"]["email"] == "newowner@example.com"
    assert data["user"]["role"] == Role.OWNER
    assert data["user"]["status"] == Status.PENDING
    # The Pharmacy row should be created with an auto-generated code.
    assert data["user"]["pharmacy_id"] is not None


def test_signup_owner_missing_city_400(client):
    res = client.post("/auth/signup", json={
        "email": "owner-no-city@example.com",
        "password": "secret123",
        "name": "No City",
        "role": "owner",
        "pharmacy_name": "Pharma X",
    })
    assert res.status_code == 400
    assert "ville" in res.json()["detail"].lower()


def test_signup_employee_success(client, test_pharmacy):
    res = client.post("/auth/signup", json={
        "email": "newemp@example.com",
        "password": "secret123",
        "name": "New Employee",
        "role": "employee",
        "pharmacy_id": test_pharmacy.id,
    })
    assert res.status_code == 200
    data = res.json()
    assert data["user"]["role"] == Role.EMPLOYEE
    assert data["user"]["pharmacy_id"] == test_pharmacy.id


def test_signup_duplicate_email_400(client):
    payload = {
        "email": "dup@example.com",
        "password": "secret123",
        "name": "First",
        "role": "owner",
        "pharmacy_name": "Pharma A",
        "pharmacy_city": "Casablanca",
    }
    client.post("/auth/signup", json=payload)
    res = client.post("/auth/signup", json=payload)
    assert res.status_code == 400
    assert "déjà enregistré" in res.json()["detail"]


def test_signup_owner_missing_pharmacy_name_400(client):
    res = client.post("/auth/signup", json={
        "email": "nopharm@example.com",
        "password": "secret123",
        "name": "No Pharma",
        "role": "owner",
        # no pharmacy_name and no pharmacy_id
    })
    assert res.status_code == 400
    assert "Nom de pharmacie" in res.json()["detail"]


# ── POST /auth/login ─────────────────────────────────────────────────────────


def test_login_success(client, test_owner):
    res = client.post("/auth/login", json={
        "email": "owner@test.com",
        "password": "owner123",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["access_token"]
    assert data["user"]["email"] == "owner@test.com"


def test_login_wrong_password_401(client, test_owner):
    res = client.post("/auth/login", json={
        "email": "owner@test.com",
        "password": "wrongpassword",
    })
    assert res.status_code == 401


def test_login_nonexistent_email_401(client):
    res = client.post("/auth/login", json={
        "email": "ghost@example.com",
        "password": "anything",
    })
    assert res.status_code == 401


# ── GET /auth/me ──────────────────────────────────────────────────────────────


def test_get_me_returns_user(client, test_owner):
    res = client.get("/auth/me", headers=test_owner["headers"])
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "owner@test.com"
    assert data["role"] == Role.OWNER


def test_get_me_works_for_pending_user(client, db):
    """A user with status=pending can still call /auth/me."""
    from utils.auth import create_access_token

    user = User(
        email="pending@example.com",
        name="Pending User",
        password_hash=hash_password("pass123"),
        role=Role.OWNER,
        status=Status.PENDING,
        pharmacy_name="Pharma Pending",
    )
    db.add(user)
    db.flush()
    token = create_access_token({"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/auth/me", headers=headers)
    assert res.status_code == 200
    assert res.json()["status"] == Status.PENDING


# ── PUT /auth/me ──────────────────────────────────────────────────────────────


def test_update_me_name_and_phone(client, test_owner):
    res = client.put("/auth/me", headers=test_owner["headers"], json={
        "name": "Updated Name",
        "phone": "0699999999",
    })
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Updated Name"
    assert data["phone"] == "0699999999"


def test_update_me_email(client, test_owner):
    res = client.put("/auth/me", headers=test_owner["headers"], json={
        "email": "newemail@example.com",
    })
    assert res.status_code == 200
    assert res.json()["email"] == "newemail@example.com"


def test_update_me_duplicate_email_400(client, test_owner, test_employee):
    res = client.put("/auth/me", headers=test_owner["headers"], json={
        "email": "employee@test.com",  # already taken by test_employee
    })
    assert res.status_code == 400
    assert "déjà utilisé" in res.json()["detail"]


# ── POST /auth/forgot-password ───────────────────────────────────────────────


def test_forgot_password_existing_email_204(client, test_owner):
    with patch("routers.auth.send_reset_email", new_callable=AsyncMock) as mock_send:
        res = client.post("/auth/forgot-password", json={
            "email": "owner@test.com",
        })
        assert res.status_code == 204
        mock_send.assert_called_once()


def test_forgot_password_nonexistent_email_silent_204(client):
    with patch("routers.auth.send_reset_email", new_callable=AsyncMock) as mock_send:
        res = client.post("/auth/forgot-password", json={
            "email": "nobody@example.com",
        })
        assert res.status_code == 204
        mock_send.assert_not_called()


# ── POST /auth/reset-password ────────────────────────────────────────────────


def test_reset_password_valid_token(client, db, test_owner):
    user = test_owner["user"]
    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)
    db.flush()

    res = client.post("/auth/reset-password", json={
        "token": token,
        "new_password": "newpassword123",
    })
    assert res.status_code == 204

    # Verify new password works
    login_res = client.post("/auth/login", json={
        "email": "owner@test.com",
        "password": "newpassword123",
    })
    assert login_res.status_code == 200


def test_reset_password_expired_token_400(client, db, test_owner):
    user = test_owner["user"]
    token = secrets.token_urlsafe(32)
    user.reset_token = token
    user.reset_token_expires = datetime.now(timezone.utc) - timedelta(hours=1)
    db.flush()

    res = client.post("/auth/reset-password", json={
        "token": token,
        "new_password": "newpassword123",
    })
    assert res.status_code == 400
    assert "expiré" in res.json()["detail"].lower()


def test_reset_password_invalid_token_400(client):
    res = client.post("/auth/reset-password", json={
        "token": "completely-bogus-token",
        "new_password": "newpassword123",
    })
    assert res.status_code == 400


# ── POST /auth/forgot-password-whatsapp ──────────────────────────────────────


def test_forgot_password_whatsapp_existing_phone_204(client, test_owner):
    with patch("routers.auth.send_whatsapp_otp", new_callable=AsyncMock) as mock_wa:
        res = client.post("/auth/forgot-password-whatsapp", json={
            "phone": "0600000001",
        })
        assert res.status_code == 204
        mock_wa.assert_called_once()


def test_forgot_password_whatsapp_nonexistent_phone_silent_204(client):
    with patch("routers.auth.send_whatsapp_otp", new_callable=AsyncMock) as mock_wa:
        res = client.post("/auth/forgot-password-whatsapp", json={
            "phone": "0699999999",
        })
        assert res.status_code == 204
        mock_wa.assert_not_called()


# ── POST /auth/verify-otp ────────────────────────────────────────────────────


def test_verify_otp_valid_returns_reset_token(client, db, test_owner):
    user = test_owner["user"]
    user.reset_token = "123456"
    user.reset_token_expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    db.flush()

    res = client.post("/auth/verify-otp", json={
        "phone": "0600000001",
        "otp": "123456",
    })
    assert res.status_code == 200
    data = res.json()
    assert "reset_token" in data
    assert len(data["reset_token"]) > 0


def test_verify_otp_wrong_otp_400(client, db, test_owner):
    user = test_owner["user"]
    user.reset_token = "123456"
    user.reset_token_expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    db.flush()

    res = client.post("/auth/verify-otp", json={
        "phone": "0600000001",
        "otp": "999999",
    })
    assert res.status_code == 400
    assert "invalide" in res.json()["detail"].lower()
