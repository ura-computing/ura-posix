"""Tests for /v1/sessions/* — list + kill + revoke-others."""
from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session


class TestListSessions:
    def test_happy_path_returns_login_session(self, auth_owner) -> None:
        client, _user, _ = auth_owner
        r = client.get("/v1/sessions")
        assert r.status_code == 200
        sessions = r.json()
        assert len(sessions) >= 1
        # The current session should be marked.
        assert any(s["is_current"] for s in sessions)

    def test_unauthenticated_returns_401(self, client: TestClient) -> None:
        r = client.get("/v1/sessions")
        assert r.status_code == 401

    def test_two_logins_show_two_sessions(self, auth_owner, make_user, db: Session) -> None:
        # auth_owner already logged in once. Log in again with a fresh client →
        # second UserSession row.
        from fastapi.testclient import TestClient as _TC
        from main import app
        c1, user, _ = auth_owner
        c2 = _TC(app)
        c2.post("/v1/auth/login", json={"email": user.email, "password": "password123"})

        r = c1.get("/v1/sessions")
        assert r.status_code == 200
        assert len(r.json()) >= 2


class TestKillSession:
    def test_happy_path_kills_other_session(self, auth_owner, db: Session) -> None:
        from fastapi.testclient import TestClient as _TC
        from main import app
        from models import Session as UserSession

        c1, user, _ = auth_owner
        c2 = _TC(app)
        c2.post("/v1/auth/login", json={"email": user.email, "password": "password123"})

        # Find a session other than c1's current — pick the one c1 marks as not current.
        sessions = c1.get("/v1/sessions").json()
        other = next(s for s in sessions if not s["is_current"])

        r = c1.delete(f"/v1/sessions/{other['id']}")
        assert r.status_code == 204
        assert db.query(UserSession).filter(UserSession.id == int(other["id"])).first() is None

    def test_unauthenticated_returns_401(self, client: TestClient) -> None:
        r = client.delete("/v1/sessions/1")
        assert r.status_code == 401

    def test_not_found_returns_404(self, auth_owner) -> None:
        client, _, _ = auth_owner
        r = client.delete("/v1/sessions/999999")
        assert r.status_code == 404

    def test_other_users_session_returns_404(self, auth_owner, make_user, db: Session) -> None:
        # Login as a different user → get their session id → c1 (auth_owner)
        # must NOT be able to kill it (route filters by user_id).
        from fastapi.testclient import TestClient as _TC
        from main import app
        from models import Session as UserSession
        from utils import generate_token, hash_token
        from datetime import datetime, timedelta, timezone

        c1, _, _ = auth_owner
        other_user, _ = make_user(role="owner")
        # Insert a session row for the other user directly.
        now = datetime.now(timezone.utc)
        sess = UserSession(
            user_id=other_user.id,
            refresh_token_hash=hash_token(generate_token()),
            created_at=now,
            last_used_at=now,
            expires_at=now + timedelta(days=30),
        )
        db.add(sess)
        db.commit()

        r = c1.delete(f"/v1/sessions/{sess.id}")
        assert r.status_code == 404


class TestRevokeOthers:
    def test_happy_path_keeps_current_session(self, auth_owner, db: Session) -> None:
        from fastapi.testclient import TestClient as _TC
        from main import app
        from models import Session as UserSession

        c1, user, _ = auth_owner
        # Spin up 2 more sessions.
        for _ in range(2):
            c = _TC(app)
            c.post("/v1/auth/login", json={"email": user.email, "password": "password123"})

        before = db.query(UserSession).filter(UserSession.user_id == user.id).count()
        assert before >= 3

        r = c1.post("/v1/sessions/revoke-others")
        assert r.status_code == 204

        after = db.query(UserSession).filter(UserSession.user_id == user.id).count()
        assert after == 1                 # only the current device survives

    def test_unauthenticated_returns_401(self, client: TestClient) -> None:
        r = client.post("/v1/sessions/revoke-others")
        assert r.status_code == 401
