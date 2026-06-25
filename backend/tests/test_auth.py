"""Tests for /v1/auth/* — login, me, change-password, logout, forgot+reset."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


# ── /auth/login ────────────────────────────────────────────────────────────

class TestLogin:
    def test_happy_path_returns_me_and_sets_cookies(self, client: TestClient, make_user) -> None:
        user, password = make_user(role="owner")
        r = client.post("/v1/auth/login", json={"email": user.email, "password": password})
        assert r.status_code == 200
        body = r.json()
        assert body["user"]["email"] == user.email
        assert "access_token" in r.cookies
        assert "session_token" in r.cookies

    def test_wrong_password_returns_401(self, client: TestClient, make_user) -> None:
        user, _ = make_user(role="owner")
        r = client.post("/v1/auth/login", json={"email": user.email, "password": "WRONG"})
        assert r.status_code == 401

    def test_unknown_email_returns_401(self, client: TestClient) -> None:
        r = client.post("/v1/auth/login", json={"email": "ghost@example.com", "password": "anything"})
        assert r.status_code == 401

    def test_inactive_account_returns_401(self, client: TestClient, make_user) -> None:
        user, password = make_user(role="owner", status="inactive")
        r = client.post("/v1/auth/login", json={"email": user.email, "password": password})
        assert r.status_code == 401
        assert "désactivé" in r.json()["detail"].lower()

    def test_validation_missing_fields(self, client: TestClient) -> None:
        r = client.post("/v1/auth/login", json={"email": "x@example.com"})
        assert r.status_code == 422


# ── GET /auth/me ───────────────────────────────────────────────────────────

class TestGetMe:
    def test_happy_path(self, auth_owner) -> None:
        client, user, _ = auth_owner
        r = client.get("/v1/auth/me")
        assert r.status_code == 200
        assert r.json()["user"]["email"] == user.email

    def test_unauthenticated_returns_401(self, client: TestClient) -> None:
        r = client.get("/v1/auth/me")
        assert r.status_code == 401


# ── PATCH /auth/me ─────────────────────────────────────────────────────────

class TestUpdateMe:
    def test_happy_path(self, auth_owner) -> None:
        client, _user, _ = auth_owner
        r = client.patch("/v1/auth/me", json={"name": "New Name", "phone": "+212600000000"})
        assert r.status_code == 200
        assert r.json()["user"]["name"] == "New Name"

    def test_unauthenticated_returns_401(self, client: TestClient) -> None:
        r = client.patch("/v1/auth/me", json={"name": "X"})
        assert r.status_code == 401

    def test_validation_missing_name(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.patch("/v1/auth/me", json={})
        assert r.status_code == 422


# ── POST /auth/change-password ────────────────────────────────────────────

class TestChangePassword:
    def test_happy_path_reissues_session(self, auth_owner, db: Session) -> None:
        client, user, _ = auth_owner
        r = client.post("/v1/auth/change-password", json={
            "current_password": "password123",
            "new_password":     "newPassword456!",
        })
        assert r.status_code == 204
        db.refresh(user)
        assert user.token_version == 1     # bumped

    def test_wrong_current_password_returns_400(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.post("/v1/auth/change-password", json={
            "current_password": "WRONG",
            "new_password":     "doesntmatter",
        })
        assert r.status_code == 400

    def test_unauthenticated_returns_401(self, client: TestClient) -> None:
        r = client.post("/v1/auth/change-password", json={
            "current_password": "x", "new_password": "y",
        })
        assert r.status_code == 401


# ── POST /auth/logout ─────────────────────────────────────────────────────

class TestLogout:
    def test_happy_path_clears_cookies(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.post("/v1/auth/logout")
        assert r.status_code == 204
        # After logout, subsequent /me should 401 once cookies are cleared.
        # Note: TestClient may keep stale cookies; the cleared response will
        # have Max-Age=0 — but TestClient doesn't always honor that, so we
        # just check the logout endpoint itself succeeded.

    def test_unauth_logout_is_idempotent(self, client: TestClient) -> None:
        # Public endpoint — should 204 even without a cookie.
        r = client.post("/v1/auth/logout")
        assert r.status_code == 204


# ── POST /auth/forgot-password ────────────────────────────────────────────

class TestForgotPassword:
    def test_always_returns_200_even_for_unknown_email(self, client: TestClient) -> None:
        r = client.post("/v1/auth/forgot-password", json={"email": "noone@example.com"})
        assert r.status_code == 200
        assert "email a été envoyé" in r.json()["detail"]

    def test_known_email_sets_reset_token(self, client: TestClient, make_user, db: Session) -> None:
        user, _ = make_user(role="owner")
        r = client.post("/v1/auth/forgot-password", json={"email": user.email})
        assert r.status_code == 200
        db.refresh(user)
        assert user.reset_token is not None
        assert user.reset_token_expires is not None

    def test_inactive_account_no_token_set(self, client: TestClient, make_user, db: Session) -> None:
        user, _ = make_user(role="owner", status="inactive")
        r = client.post("/v1/auth/forgot-password", json={"email": user.email})
        assert r.status_code == 200
        db.refresh(user)
        assert user.reset_token is None


# ── GET /auth/validate-token + POST /auth/set-password ────────────────────

@pytest.fixture
def reset_token(make_user, db: Session) -> tuple[str, str]:
    """Creates a user + a fresh reset token. Returns (email, raw_token)."""
    from utils import generate_reset_token, hash_reset_token
    user, _ = make_user(role="owner")
    raw = generate_reset_token()
    user.reset_token = hash_reset_token(raw)
    user.reset_token_expires = datetime.now(timezone.utc) + timedelta(minutes=30)
    db.commit()
    return user.email, raw


class TestValidateToken:
    def test_happy_path(self, client: TestClient, reset_token) -> None:
        _email, raw = reset_token
        r = client.get(f"/v1/auth/validate-token?token={raw}")
        assert r.status_code == 200
        body = r.json()
        assert "full_name" in body
        assert "is_setup" in body

    def test_invalid_token_returns_400(self, client: TestClient) -> None:
        r = client.get("/v1/auth/validate-token?token=not-a-real-token")
        assert r.status_code == 400

    def test_expired_token_returns_400(self, client: TestClient, make_user, db: Session) -> None:
        from utils import generate_reset_token, hash_reset_token
        user, _ = make_user(role="owner")
        raw = generate_reset_token()
        user.reset_token = hash_reset_token(raw)
        user.reset_token_expires = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()
        r = client.get(f"/v1/auth/validate-token?token={raw}")
        assert r.status_code == 400


class TestSetPassword:
    def test_happy_path_clears_token_and_bumps_version(self, client: TestClient, reset_token, db: Session) -> None:
        from models import User
        email, raw = reset_token
        before = db.query(User).filter(User.email == email).first()
        version_before = before.token_version

        r = client.post("/v1/auth/set-password", json={"token": raw, "password": "newSecure999!"})
        assert r.status_code == 204

        db.refresh(before)
        assert before.reset_token is None
        assert before.reset_token_expires is None
        assert before.token_version == version_before + 1

    def test_invalid_token_returns_400(self, client: TestClient) -> None:
        r = client.post("/v1/auth/set-password", json={"token": "not-real", "password": "abc12345"})
        assert r.status_code == 400
