"""Pytest infrastructure for the FastAPI backend.

Test DB strategy
----------------
- Tests run against a SEPARATE Postgres database (default: `apcm_test`,
  override via `APCM_TEST_DATABASE_URL`). The dev DB is never touched.
- `apcm_test` is created if missing, then `alembic upgrade head` is run
  once per test session.
- Each test gets its own SAVEPOINT-wrapped session that's rolled back at
  teardown — no row leaks across tests.

Auth fixtures
-------------
- `auth_admin` / `auth_owner` / `auth_employee` log in via `/v1/auth/login`
  and return a `TestClient` with the session cookies set, ready to hit any
  authenticated endpoint.
"""
from __future__ import annotations

import os
import subprocess
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

# ── 1. Resolve test DB URL + create it if missing ──────────────────────────

_DEV_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg2://apcm:apcm@localhost:5432/apcm",
)
TEST_DATABASE_URL = os.environ.get(
    "APCM_TEST_DATABASE_URL",
    _DEV_URL.rsplit("/", 1)[0] + "/apcm_test",
)

# Override BEFORE importing the app so config.Settings picks up the test URL.
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-must-be-long-enough-for-validation-rules")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")


def _ensure_test_db_exists() -> None:
    """Create `apcm_test` if it doesn't exist. Connects to the maintenance
    `postgres` db to issue the CREATE DATABASE, since you can't create the
    DB you're connected to."""
    target_db = TEST_DATABASE_URL.rsplit("/", 1)[1]
    admin_url = TEST_DATABASE_URL.rsplit("/", 1)[0] + "/postgres"
    admin_engine = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        existing = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": target_db}
        ).scalar()
        if not existing:
            conn.execute(text(f'CREATE DATABASE "{target_db}"'))
    admin_engine.dispose()


def _bootstrap_schema() -> None:
    """Mirror `bootstrap.py` for the test DB. The alembic chain alone can't
    seed a fresh DB (early migrations alter pre-existing tables), so the
    create_all + stamp pattern is required. Idempotent: if `pharmacies`
    already exists we just run `alembic upgrade head`."""
    # Import here so the DATABASE_URL override is in effect first.
    from sqlalchemy import create_engine as _ce, inspect as _inspect
    from database import Base
    import models  # noqa: F401 — registers all tables on Base.metadata

    test_engine = _ce(TEST_DATABASE_URL)
    with test_engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS unaccent"))
        conn.commit()

    if _inspect(test_engine).has_table("pharmacies"):
        cmd = "upgrade"
    else:
        Base.metadata.create_all(bind=test_engine)
        cmd = "stamp"
    test_engine.dispose()

    subprocess.run(
        ["uv", "run", "alembic", cmd, "head"],
        cwd=os.path.dirname(__file__),
        env={**os.environ, "DATABASE_URL": TEST_DATABASE_URL},
        check=True,
        capture_output=True,
    )


# ── 2. Session-wide setup ──────────────────────────────────────────────────

@pytest.fixture(scope="session", autouse=True)
def _bootstrap_test_db() -> Iterator[None]:
    _ensure_test_db_exists()
    _bootstrap_schema()
    yield


@pytest.fixture(autouse=True)
def _reset_rate_limit() -> None:
    """slowapi's in-memory limiter persists across tests (same process). The
    auth_owner / auth_employee fixtures each call /login; a few tests that
    create multiple fixtures hit the 5/min cap. Reset between tests."""
    from rate_limit import limiter
    limiter.reset()


# ── 3. Per-test DB session with SAVEPOINT rollback ─────────────────────────

@pytest.fixture(scope="session")
def test_engine() -> Iterator[Engine]:
    engine = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
    yield engine
    engine.dispose()


@pytest.fixture
def db(test_engine: Engine) -> Iterator[Session]:
    """Per-test session wrapped in an outer transaction that's rolled back
    at teardown. Nested SAVEPOINTs let endpoint code that commits still
    have their writes wiped between tests."""
    connection = test_engine.connect()
    transaction = connection.begin()
    SessionFactory = sessionmaker(bind=connection, autocommit=False, autoflush=False)
    session = SessionFactory()

    # Re-open a nested SAVEPOINT each time the inner code commits, so
    # endpoint logic doing `db.commit()` doesn't escape our outer rollback.
    session.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def _restart_savepoint(sess, trans):
        if trans.nested and not trans._parent.nested:
            sess.begin_nested()

    try:
        yield session
    finally:
        session.close()
        # In rare cases (full-suite teardown ordering on the same connection
        # pool), the outer transaction is already detached by the time we
        # rollback. The DB state is still rolled back via SAVEPOINT, so the
        # warning is cosmetic — swallow it to keep test runs clean.
        try:
            transaction.rollback()
        except Exception:
            pass
        connection.close()


# ── 4. App + client with dependency override ───────────────────────────────

@pytest.fixture
def client(db: Session) -> Iterator[TestClient]:
    """TestClient bound to the per-test session via dependency override."""
    from main import app
    from database import get_db

    def _override_get_db() -> Iterator[Session]:
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.pop(get_db, None)


# ── 5. Factories ───────────────────────────────────────────────────────────

@pytest.fixture
def make_pharmacy(db: Session):
    from models import Pharmacy
    counter = {"i": 0}

    def _make(name: str = "Pharmacie Test", city: str = "Bouskoura", code: str | None = None, **extra) -> Pharmacy:
        counter["i"] += 1
        p = Pharmacy(
            name=name,
            city=city,
            code=code or f"TST{counter['i']:04d}",
            **extra,
        )
        db.add(p)
        db.commit()
        db.refresh(p)
        return p

    return _make


@pytest.fixture
def make_user(db: Session, make_pharmacy):
    """Creates a user with a known plaintext password (`"password123"`) and
    a backing session row + token-version of 0 so the JWT issued by /login
    survives the get_current_user check."""
    from models import User
    from security import hash_password

    counter = {"i": 0}

    def _make(
        email: str | None = None,
        role: str = "owner",
        pharmacy=None,
        status: str = "active",
        password: str = "password123",
    ) -> tuple[User, str]:
        counter["i"] += 1
        if email is None:
            email = f"u{counter['i']}@example.com"
        # Admin + developer have no pharmacy; owner/employee need one (auto-create on demand).
        if role in ("owner", "employee") and pharmacy is None:
            pharmacy = make_pharmacy(name=f"Pharmacie {counter['i']}")
        u = User(
            email=email,
            name=email.split("@")[0],
            password_hash=hash_password(password),
            role=role,
            status=status,
            pharmacy_id=pharmacy.id if pharmacy else None,
            token_version=0,
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        return u, password

    return _make


def _login(client: TestClient, email: str, password: str) -> None:
    r = client.post("/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"


@pytest.fixture
def auth_admin(client, make_user):
    """Returns (client, user). The client carries the admin's session cookies."""
    user, password = make_user(role="admin")
    _login(client, user.email, password)
    return client, user


@pytest.fixture
def auth_owner(client, make_user, db):
    """Returns (client, user, pharmacy). The owner gets ALL features on their
    pharmacy by default so most tests don't need to set features manually.
    Override by calling `set_pharmacy_features(pharmacy.id, ...)` from the
    test."""
    user, password = make_user(role="owner")
    from models import ALLOWED_FEATURES, PharmacyFeature, UserPermission
    pharm_id = user.pharmacy_id
    assert pharm_id is not None
    for feat in ALLOWED_FEATURES:
        db.add(PharmacyFeature(pharmacy_id=pharm_id, feature=feat, enabled=True))
        db.add(UserPermission(user_id=user.id, permission=feat, enabled=True))
    db.commit()
    _login(client, user.email, password)
    pharmacy = db.get(__import__("models").Pharmacy, pharm_id)
    return client, user, pharmacy


@pytest.fixture
def auth_employee(client, make_user, auth_owner, db):
    """Employee attached to the owner's pharmacy (so the owner-union ceiling
    is satisfied). Returns (client, employee_user, pharmacy)."""
    _owner_client, _owner_user, pharmacy = auth_owner
    # Need a FRESH client because auth_owner's cookies are for the owner.
    from fastapi.testclient import TestClient
    from main import app
    fresh = TestClient(app)
    employee, password = make_user(role="employee", pharmacy=pharmacy)
    from models import ALLOWED_FEATURES, UserPermission
    for feat in ALLOWED_FEATURES:
        db.add(UserPermission(user_id=employee.id, permission=feat, enabled=True))
    db.commit()
    _login(fresh, employee.email, password)
    return fresh, employee, pharmacy


@pytest.fixture
def auth_developer(client, make_user):
    """APCM developer — no pharmacy, no feature flags. Returns (client, user).

    Uses a fresh TestClient so tests that also request `auth_owner` don't
    have their owner cookies overwritten by the dev's login (both fixtures
    would otherwise share the same `client`). Depends on `client` to pull
    the `db` dependency override into the test's session scope."""
    from fastapi.testclient import TestClient
    from main import app
    _ = client   # ensure the get_db override is active in app.dependency_overrides
    fresh = TestClient(app)
    user, password = make_user(role="developer")
    _login(fresh, user.email, password)
    return fresh, user


@pytest.fixture
def set_pharmacy_features(db: Session):
    """Replace the set of enabled features on a pharmacy. Strips everything
    then inserts the given list. Use to test feature-gate revocations."""
    def _set(pharmacy_id: int, features: tuple[str, ...]) -> None:
        from models import PharmacyFeature
        db.query(PharmacyFeature).filter(PharmacyFeature.pharmacy_id == pharmacy_id).delete()
        for feat in features:
            db.add(PharmacyFeature(pharmacy_id=pharmacy_id, feature=feat, enabled=True))
        db.commit()
    return _set
