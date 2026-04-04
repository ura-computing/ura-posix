"""
Database seeding script for APCM Pharma.

Reads seed data from seed.json, then creates:
  - A default admin account (status: active)
  - A demo owner account with a pharmacy (status: active)
  - Imports the product catalog from resources/catalog.csv

Usage:
    make seed
    cd backend && .venv/bin/python seed.py
"""

import csv
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
_env_name = os.getenv("APP_ENV", "dev")
_env_file = Path(__file__).resolve().parent.parent / "env" / _env_name / "backend.env"
if _env_file.exists():
    load_dotenv(_env_file)

from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
from models import Medicament, Pharmacy, User
from utils.auth import hash_password
from utils.constants import Role, Status

SEED_FILE = Path(__file__).parent / "seed.json"
# Look in resources/ (local) or backend/ (Docker copies it there)
_catalog_local = Path(__file__).resolve().parent.parent / "resources" / "catalog.csv"
_catalog_docker = Path(__file__).resolve().parent / "catalog.csv"
CATALOG_FILE = _catalog_local if _catalog_local.exists() else _catalog_docker


def _parse_float(s: str) -> float | None:
    try:
        return float(s.replace(",", ".").strip()) if s.strip() else None
    except (ValueError, AttributeError):
        return None


def seed_database():
    """Create accounts, pharmacy, and import catalog."""

    if not SEED_FILE.exists():
        print(f"✗ seed.json not found at {SEED_FILE}")
        sys.exit(1)

    with open(SEED_FILE) as f:
        cfg = json.load(f)

    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()

    try:
        admin_cfg = cfg["admin"]

        # Guard — skip if already seeded
        if db.query(User).filter(User.email == admin_cfg["email"]).first():
            print("✓ Déjà initialisé, rien à faire.")
            return

        # ── Admin ────────────────────────────────────────────────────────
        admin = User(
            email=admin_cfg["email"],
            name=admin_cfg["name"],
            password_hash=hash_password(admin_cfg["password"]),
            role=Role.ADMIN,
            status=Status.ACTIVE,
            profile_complete=True,
        )
        db.add(admin)
        db.flush()

        # ── Owner + Pharmacy ─────────────────────────────────────────────
        owner_cfg = cfg.get("owner")
        if owner_cfg:
            pharmacy = Pharmacy(
                name=owner_cfg["pharmacy_name"],
                address=owner_cfg.get("pharmacy_address"),
            )
            db.add(pharmacy)
            db.flush()

            owner = User(
                email=owner_cfg["email"],
                name=owner_cfg["name"],
                phone=owner_cfg.get("phone"),
                password_hash=hash_password(owner_cfg["password"]),
                role=Role.OWNER,
                status=Status.ACTIVE,
                profile_complete=True,
                pharmacy_id=pharmacy.id,
                pharmacy_name=owner_cfg["pharmacy_name"],
            )
            db.add(owner)
            db.flush()

        db.commit()

        # ── Catalog import ───────────────────────────────────────────────
        catalog_count = 0
        if CATALOG_FILE.exists() and db.query(Medicament).count() == 0:
            print("  Importation du catalogue...")
            with open(CATALOG_FILE, encoding="utf-8") as f:
                reader = csv.DictReader(f)
                meds = []
                for i, row in enumerate(reader):
                    product = (row.get("Nom") or "").strip()
                    if not product:
                        continue
                    meds.append(Medicament(
                        pid=f"CAT-{i+1:05d}",
                        product=product,
                        category=(row.get("Categorie") or "").strip() or None,
                        tva=(row.get("TVA") or "").strip() or None,
                        ppv=_parse_float(row.get("PPV", "")),
                        pph=_parse_float(row.get("PPH", "")),
                        barcode1=(row.get("Code barre 1") or "").strip() or None,
                        barcode2=(row.get("Code barre 2") or "").strip() or None,
                        laboratoire=(row.get("Laboratoire") or "").strip() or None,
                    ))
                db.bulk_save_objects(meds)
                db.commit()
                catalog_count = len(meds)

        print("\n" + "=" * 60)
        print("Initialisation terminée !")
        print("=" * 60)
        print(f"\n  Admin     :  {admin_cfg['email']}  (mot de passe dans seed.json)")
        if owner_cfg:
            print(f"  Owner     :  {owner_cfg['email']}  (mot de passe dans seed.json)")
            print(f"  Pharmacie :  {owner_cfg['pharmacy_name']}")
        if catalog_count:
            print(f"  Catalogue :  {catalog_count} médicaments importés")
        print("\n" + "=" * 60)

    except Exception as e:
        db.rollback()
        print(f"✗ Échec : {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
