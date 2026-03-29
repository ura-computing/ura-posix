"""
Database seeding script for APCM Pharma.

Reads seed data from seed.json, then creates:
  - A default admin account  (status: active)

  Owners register themselves via the app; the admin then approves them.
  Employees are invited/managed by their pharmacy owner.

Usage:
    # From project root:
    make seed

    # Or directly with venv:
    cd backend && .venv/bin/python seed.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
from models import User
from utils.auth import hash_password

SEED_FILE = Path(__file__).parent / "seed.json"


def seed_database():
    """Create the default admin account from seed.json."""

    if not SEED_FILE.exists():
        print(f"✗ seed.json not found at {SEED_FILE}")
        sys.exit(1)

    with open(SEED_FILE) as f:
        cfg = json.load(f)

    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()

    try:
        admin_cfg = cfg["admin"]

        # Guard — skip if already seeded
        if db.query(User).filter(User.email == admin_cfg["email"]).first():
            print("✓ Admin account already exists, skipping seed.")
            return

        # Admin — immediately active, not tied to any pharmacy
        admin = User(
            email=admin_cfg["email"],
            name=admin_cfg["name"],
            password_hash=hash_password(admin_cfg["password"]),
            role="admin",
            status="active",
            profile_complete=True,
            pharmacy_id=None,
        )
        db.add(admin)
        db.commit()

        print("\n" + "=" * 60)
        print("Seed complete!")
        print("=" * 60)
        print(f"\n  Admin  :  {admin_cfg['email']}  (password from seed.json)")
        print("\n  Log in as admin to manage pharmacies and approve owners.")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"✗ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
