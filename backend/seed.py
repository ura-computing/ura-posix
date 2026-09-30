"""Demo seed for apcm-refactor.

Creates (if missing) an admin user, an owner user with a pharmacy, and imports
the catalogue from resources/catalog.csv. Idempotent — checks for the admin
email up-front and skips everything if it's already there.

Called by the docker entrypoint AFTER `alembic upgrade head`. Safe to run
manually too: `uv run python seed.py`.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Make `from models import …` work when invoked as a script.
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy.orm import Session

from csv_parse import classify_product_type, parse_catalog_csv
from database import SessionLocal
from members import create_member, generate_pharmacy_code
from models import ALLOWED_FEATURES, Medicament, Pharmacy, PharmacyFeature, User
from security import hash_password


ROLE_ADMIN     = "admin"
ROLE_OWNER     = "owner"
ROLE_DEVELOPER = "developer"
STATUS_OK      = "active"

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


def _user_exists(db: Session, email: str) -> bool:
    return db.query(User).filter(User.email == email).first() is not None


def _seed_simple_user(db: Session, cfg: dict | None, role: str) -> str | None:
    """Insert a pharmacy-less user (admin or developer) if absent."""
    if not cfg or _user_exists(db, cfg["email"]):
        return None
    db.add(User(
        email=cfg["email"],
        name=cfg["name"],
        phone=cfg.get("phone"),
        password_hash=hash_password(cfg["password"]),
        role=role,
        status=STATUS_OK,
    ))
    db.flush()
    return cfg["email"]


def _seed_owner_with_pharmacy(db: Session, cfg: dict | None) -> tuple[str, str] | None:
    """Insert an owner + their pharmacy if the owner is absent — same shape as
    an admin-created one: city → code (e.g. CAS0001), every feature on, owner
    with every permission (members.create_member)."""
    if not cfg or _user_exists(db, cfg["email"]):
        return None
    city = cfg.get("pharmacy_city")
    pharmacy = Pharmacy(
        name=cfg["pharmacy_name"], address=cfg.get("pharmacy_address"), city=city,
        code=generate_pharmacy_code(db, city) if city else None,
    )
    db.add(pharmacy)
    db.flush()
    for feature in ALLOWED_FEATURES:
        db.add(PharmacyFeature(pharmacy_id=pharmacy.id, feature=feature, enabled=True))
    owner = create_member(db, email=cfg["email"], name=cfg["name"], password=cfg["password"],
                          role=ROLE_OWNER, pharmacy_id=pharmacy.id)
    owner.phone = cfg.get("phone")
    db.flush()
    return cfg["email"], cfg["pharmacy_name"]


def seed_database() -> None:
    if not SEED_FILE.exists():
        print(f"✗ seed.json introuvable : {SEED_FILE}")
        sys.exit(1)

    cfg = json.loads(SEED_FILE.read_text())
    db: Session = SessionLocal()
    try:
        inserted: list[str] = []

        admin_email = _seed_simple_user(db, cfg.get("admin"), ROLE_ADMIN)
        if admin_email:
            inserted.append(f"Admin     : {admin_email}")

        owner_pair = _seed_owner_with_pharmacy(db, cfg.get("owner"))
        if owner_pair:
            inserted.append(f"Owner     : {owner_pair[0]}")
            inserted.append(f"Pharmacie : {owner_pair[1]}")

        dev_email = _seed_simple_user(db, cfg.get("developer"), ROLE_DEVELOPER)
        if dev_email:
            inserted.append(f"Developer : {dev_email}")

        db.commit()

        # ── Catalogue (only on first init, only if empty) ───────────────────
        # SEED_CATALOG=0 skips it (E2E: the catalogue must hold only generated
        # products so every expected value is known).
        catalog_count = 0
        catalog_path = _resolve_catalog() if os.environ.get("SEED_CATALOG", "1") != "0" else None
        if catalog_path and db.query(Medicament).count() == 0:
            print(f"  Importation du catalogue depuis {catalog_path.name}…")
            catalog_count = _import_catalog(db, catalog_path)

        print("=" * 60)
        if not inserted and not catalog_count:
            print("Aucune insertion (utilisateurs déjà présents).")
        else:
            print("Initialisation:")
            for line in inserted:
                print(f"  {line}  (mot de passe dans seed.json)")
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
