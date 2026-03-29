"""
Database clean script for APCM Pharma.

Drops all tables and recreates them (empty schema).
Run `make seed` afterwards to re-populate with default accounts.

Usage:
    # From project root:
    make db-clean

    # Or directly with venv:
    cd backend && .venv/bin/python db_clean.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

from database import engine, Base
import models  # noqa: F401 — registers all models with Base


def clean_database():
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Recreating schema...")
    Base.metadata.create_all(bind=engine)
    print("Done — database is clean. Run `make seed` to repopulate.")


if __name__ == "__main__":
    confirm = input("This will DELETE all data. Type 'yes' to confirm: ").strip().lower()
    if confirm != "yes":
        print("Aborted.")
        sys.exit(0)
    clean_database()
