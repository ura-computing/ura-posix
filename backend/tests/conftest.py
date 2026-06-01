"""
Test configuration — sets up an isolated test database and provides fixtures.

IMPORTANT: APP_ENV=test must be set BEFORE any backend module is imported,
so database.py loads env/test/backend.env (pointing to apcm_test DB).
"""

import os

os.environ["APP_ENV"] = "test"

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from database import Base, get_db, DATABASE_URL
from main import app
from models import Pharmacy, User
from utils.auth import hash_password, create_access_token
from utils.constants import Role, Status

# Disable rate-limiting in tests — fast successive calls to /auth/signup etc.
# would otherwise hit the per-IP limiter and break unrelated test cases.
app.state.limiter.enabled = False

# ── Engine + session factory for tests ────────────────────────────────────────

_engine = create_engine(DATABASE_URL)
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


# ── Session-scoped: create/drop tables once per test run ─────────────────────

@pytest.fixture(scope="session", autouse=True)
def _create_tables():
    Base.metadata.create_all(bind=_engine)
    yield
    Base.metadata.drop_all(bind=_engine)


# ── Function-scoped: each test gets a clean session with rollback ────────────

@pytest.fixture()
def db():
    connection = _engine.connect()
    transaction = connection.begin()
    session = TestSession(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db):
    """FastAPI test client with the DB dependency overridden to use the test session."""

    def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    from starlette.testclient import TestClient

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


# ── Auth fixtures ────────────────────────────────────────────────────────────

@pytest.fixture()
def test_pharmacy(db) -> Pharmacy:
    from utils.pharmacy_code import generate_pharmacy_code
    pharmacy = Pharmacy(
        name="Pharmacie Test",
        address="123 Rue Test",
        city="Casablanca",
        code=generate_pharmacy_code(db, "Casablanca"),
    )
    db.add(pharmacy)
    db.flush()
    return pharmacy


@pytest.fixture()
def test_admin(db) -> dict:
    """Creates an admin user and returns { user, token, headers }."""
    user = User(
        email="admin@test.com",
        name="Admin Test",
        password_hash=hash_password("admin123"),
        role=Role.ADMIN,
        status=Status.ACTIVE,
    )
    db.add(user)
    db.flush()
    token = create_access_token({"sub": str(user.id)})
    return {
        "user": user,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }


@pytest.fixture()
def test_owner(db, test_pharmacy) -> dict:
    """Creates an owner user with a pharmacy and returns { user, token, headers, pharmacy }."""
    user = User(
        email="owner@test.com",
        name="Owner Test",
        phone="0600000001",
        password_hash=hash_password("owner123"),
        role=Role.OWNER,
        status=Status.ACTIVE,
        pharmacy_id=test_pharmacy.id,
        pharmacy_name=test_pharmacy.name,
    )
    db.add(user)
    db.flush()
    token = create_access_token({"sub": str(user.id)})
    return {
        "user": user,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
        "pharmacy": test_pharmacy,
    }


@pytest.fixture()
def test_employee(db, test_pharmacy) -> dict:
    """Creates an employee user under the test pharmacy."""
    user = User(
        email="employee@test.com",
        name="Employee Test",
        phone="0600000002",
        password_hash=hash_password("employee123"),
        role=Role.EMPLOYEE,
        status=Status.ACTIVE,
        pharmacy_id=test_pharmacy.id,
    )
    db.add(user)
    db.flush()
    token = create_access_token({"sub": str(user.id)})
    return {
        "user": user,
        "token": token,
        "headers": {"Authorization": f"Bearer {token}"},
    }
