"""Shared schema bootstrap — called by docker entrypoint AND `make migrate`.

The 10 alembic migrations assume the base apcm-pharma tables already exist
(0001 adds `pharmacies.version`, 0002 adds user columns, etc.). On a TRULY
FRESH DB this fails — there's no `pharmacies` table to alter. Two paths:

  • DB already has `pharmacies` (old apcm-pharma DB OR refactor DB) →
    `alembic upgrade head` brings it to current head. Idempotent: existing
    tables stay, add_column adds missing columns, has_table guards in 0006
    skip already-created tables.
  • Fresh empty DB → `Base.metadata.create_all()` creates everything at the
    current model shape, then `alembic stamp head` marks the DB as up-to-date
    so future migrations apply correctly.

Also CREATEs `pg_trgm` + `unaccent` extensions (idempotent — IF NOT EXISTS).
Run from the `backend/` directory; relies on database/models imports."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

# Make `from database import …` work when invoked as a script.
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import inspect, text

from database import Base, engine
import models  # noqa: F401 — registers all tables on Base.metadata


def _ensure_extensions() -> None:
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm;"))
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS unaccent;"))
        conn.commit()
    print("  ↳ pg_trgm + unaccent ready")


def _run_alembic(cmd: str) -> None:
    """Invoke alembic via the same uv-managed venv as the caller."""
    result = subprocess.run(
        ["alembic", cmd, "head"],
        cwd=Path(__file__).parent,
        check=False,
    )
    if result.returncode != 0:
        sys.exit(result.returncode)


def main() -> None:
    print("▸ Bootstrapping schema…")
    _ensure_extensions()

    if inspect(engine).has_table("pharmacies"):
        print("  ↳ existing tables detected → alembic upgrade head")
        _run_alembic("upgrade")
    else:
        print("  ↳ empty DB → create_all + stamp head")
        Base.metadata.create_all(bind=engine)
        _run_alembic("stamp")


if __name__ == "__main__":
    main()
