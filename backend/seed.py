"""
Database seeding script for PharmaGest.

Reads seed data from seed.json, then creates:
  - A default admin account  (status: active)
  - A default pharmacy + owner account (status: pending — must be approved by admin)

  Employees are NOT seeded — they register via the owner's invite/management flow.

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
from models import User, Pharmacy
from utils.auth import hash_password

SEED_FILE = Path(__file__).parent / "seed.json"


def seed_database():
    """Create default pharmacy, admin, and owner from seed.json."""

    if not SEED_FILE.exists():
        print(f"✗ seed.json not found at {SEED_FILE}")
        sys.exit(1)

    with open(SEED_FILE) as f:
        cfg = json.load(f)

    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()

    try:
        admin_cfg    = cfg["admin"]
        owner_cfg    = cfg["owner"]
        pharmacy_cfg = owner_cfg["pharmacy"]

        # Guard — skip if already seeded
        if db.query(User).filter(User.email == admin_cfg["email"]).first():
            print("✓ Admin account already exists, skipping seed.")
            return

        # 1. Pharmacy
        pharmacy = Pharmacy(
            name=pharmacy_cfg["name"],
            address=pharmacy_cfg.get("address"),
            phone=pharmacy_cfg.get("phone"),
            email=pharmacy_cfg.get("email"),
        )
        db.add(pharmacy)
        db.flush()
        print(f"✓ Pharmacy  : {pharmacy.name} (id={pharmacy.id})")

        # 2. Admin — immediately active, not tied to any pharmacy
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
        print(f"✓ Admin     : {admin.email}  (status=active)")

        # 3. Owner — pending until approved by admin
        owner = User(
            email=owner_cfg["email"],
            name=owner_cfg["name"],
            password_hash=hash_password(owner_cfg["password"]),
            role="owner",
            status="pending",
            profile_complete=True,
            pharmacy_id=pharmacy.id,
            pharmacy_name=pharmacy.name,
        )
        db.add(owner)
        print(f"✓ Owner     : {owner.email}  (status=pending — requires admin approval)")

        # Employees are NOT seeded — they register via the owner's invite/management flow.

        db.commit()

        print("\n" + "=" * 60)
        print("Seed complete!")
        print("=" * 60)
        print(f"\n  Admin  :  {admin_cfg['email']}  /  {admin_cfg['password']}")
        print(f"  Owner  :  {owner_cfg['email']}  /  {owner_cfg['password']}  (pending)")
        print(f"\n  Pharmacy  :  {pharmacy.name}")
        print("\n  Log in as admin to approve the owner account.")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"✗ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
