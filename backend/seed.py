"""Demo seed for apcm-refactor.

Creates (if missing) an admin user, an owner user with a pharmacy, and imports
the catalogue from resources/catalog.csv. Idempotent — checks for the admin
email up-front and skips everything if it's already there.

Called by the docker entrypoint AFTER `alembic upgrade head`. Safe to run
manually too: `uv run python seed.py`.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Make `from models import …` work when invoked as a script.
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.orm import Session

from csv_parse import classify_product_type, parse_catalog_csv
from database import SessionLocal
from models import ALLOWED_FEATURES, Medicament, Pharmacy, PharmacyFeature, User, UserPermission
from security import hash_password


ROLE_ADMIN  = "admin"
ROLE_OWNER  = "owner"
STATUS_OK   = "active"

SEED_FILE = Path(__file__).parent / "seed.json"
# Two known locations: bundled in the image at backend/catalog.csv, or in the
# checked-out tree at <repo>/resources/catalog.csv.
_CATALOG_PATHS = (
    Path(__file__).resolve().parent / "catalog.csv",
    Path(__file__).resolve().parent.parent / "resources" / "catalog.csv",
)


def _resolve_catalog() -> Path | None:
    for p in _CATALOG_PATHS:
        if p.exists():
            return p
    return None


def _import_catalog(db: Session, csv_path: Path) -> int:
    """Reuse the same parser/upsert that powers POST /v1/uploads/catalog so the
    seeded data is shape-identical to a real catalogue import. Auto-classifies
    product_type per the F19 contract."""
    content = csv_path.read_bytes()
    rows, errors = parse_catalog_csv(content)
    if errors:
        print(f"  ! {len(errors)} ligne(s) du catalogue ignorée(s) (erreurs de parsing)")

    inserted = 0
    for row in rows:
        db.add(Medicament(
            **row,
            product_type=classify_product_type(row.get("category")),
        ))
        inserted += 1
    db.commit()
    return inserted


def seed_database() -> None:
    if not SEED_FILE.exists():
        print(f"✗ seed.json introuvable : {SEED_FILE}")
        sys.exit(1)

    cfg = json.loads(SEED_FILE.read_text())
    admin_cfg = cfg["admin"]
    owner_cfg = cfg.get("owner")

    db: Session = SessionLocal()
    try:
        if db.query(User).filter(User.email == admin_cfg["email"]).first():
            print("✓ Déjà initialisé, rien à faire.")
            return

        # ── Admin ────────────────────────────────────────────────────────────
        db.add(User(
            email=admin_cfg["email"],
            name=admin_cfg["name"],
            password_hash=hash_password(admin_cfg["password"]),
            role=ROLE_ADMIN,
            status=STATUS_OK,
        ))
        db.flush()

        # ── Owner + Pharmacy ─────────────────────────────────────────────────
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
                role=ROLE_OWNER,
                status=STATUS_OK,
                pharmacy_id=pharmacy.id,
            )
            db.add(owner)
            db.flush()

            # ── TEMPORARY: grant the demo owner EVERY feature ───────────────
            # Effective permissions = pharmacy_features ∩ user_permissions, so
            # we have to enable BOTH layers for the owner to do anything.
            #
            # ⚠️  REMOVE THIS BLOCK once the admin "Gérer les permissions"
            #     page lands — then the admin will grant permissions per-user
            #     through the UI, not via the seed script.
            for feature in ALLOWED_FEATURES:
                db.add(PharmacyFeature(pharmacy_id=pharmacy.id, feature=feature, enabled=True))
                db.add(UserPermission(user_id=owner.id, permission=feature, enabled=True))

        db.commit()

        # ── Catalogue (only on first init, only if empty) ───────────────────
        catalog_count = 0
        catalog_path = _resolve_catalog()
        if catalog_path and db.query(Medicament).count() == 0:
            print(f"  Importation du catalogue depuis {catalog_path.name}…")
            catalog_count = _import_catalog(db, catalog_path)

        print("=" * 60)
        print("Initialisation terminée.")
        print(f"  Admin     : {admin_cfg['email']}  (mot de passe dans seed.json)")
        if owner_cfg:
            print(f"  Owner     : {owner_cfg['email']}  (mot de passe dans seed.json)")
            print(f"  Pharmacie : {owner_cfg['pharmacy_name']}")
        if catalog_count:
            print(f"  Catalogue : {catalog_count} médicaments importés")
        print("=" * 60)

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
