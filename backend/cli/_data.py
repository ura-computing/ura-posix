"""Test data baked into the CLI. Dev-only; not deployed.
Edit the passwords if you've changed them on your local DB."""
from dataclasses import dataclass


@dataclass
class TestAccount:
    label:    str   # human-readable label shown in the picker
    email:    str
    password: str
    role:     str


# Adjust passwords to match what's currently in your local DB.
KNOWN_ACCOUNTS: list[TestAccount] = [
    TestAccount(label="Administrateur · admin@gmail.com",       email="admin@gmail.com",              password="admin@123",        role="admin"),
    TestAccount(label="Propriétaire   · owner@gmail.com",       email="owner@gmail.com",              password="owner@123",        role="owner"),
    TestAccount(label="Employé        · mohammedxhrima@gmail",  email="mohammedxhrima@gmail.com",     password="employee@123",     role="employee"),
    TestAccount(label="Employé        · mohammed.hrima1998",    email="mohammed.hrima1998@gmail.com", password="employee@123",     role="employee"),
]

# Pseudo accounts for negative tests
UNKNOWN_EMAIL = "ghost@nowhere.example"
MALFORMED_EMAIL = "not-an-email"