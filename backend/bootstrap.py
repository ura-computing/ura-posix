"""Shared schema bootstrap — called by docker entrypoint AND `make migrate`.

The 16 alembic migrations assume the base apcm-pharma tables already exist
(0001 adds `pharmacies.version`, 0002 adds user columns, etc.). On a TRULY
FRESH DB this fails — there's no `pharmacies` table to alter. Three paths:

  • FRESH (no `pharmacies` table) → `Base.metadata.create_all()` creates
    everything at the current model shape, then `alembic stamp head` marks
    the DB as up-to-date so future migrations apply correctly.
  • LEGACY (tables exist but no `alembic_version` table — old volumes from
    before alembic was wired) → `create_all()` is idempotent for existing
    tables; we use it to add any tables that are new in the current models,
    then `alembic stamp head` to enroll the volume in the migration system.
    No data loss.
  • MANAGED (alembic_version present) → `alembic upgrade head` applies only
    pending migrations. Idempotent. No data loss.

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

    insp = inspect(engine)
    has_pharmacies = insp.has_table("pharmacies")
    has_alembic    = insp.has_table("alembic_version")

    # 3-way classification — all branches are NON-DESTRUCTIVE; data persists
    # across container restarts.
    if not has_pharmacies:
        # FRESH DB. Create from current models then mark caught up so future
        # migrations apply normally.
        print("  ↳ empty DB → create_all + stamp head")
        Base.metadata.create_all(bind=engine)
        _run_alembic("stamp")
    elif not has_alembic:
        # LEGACY DB — tables exist but alembic was never wired (or the volume
        # predates alembic adoption). Aligning additively (create_all is a
        # no-op for existing tables) + stamping head lets FUTURE migrations
        # apply cleanly without re-running old ones. Data preserved.
        print("  ↳ legacy DB (no alembic_version) → align + stamp head")
        Base.metadata.create_all(bind=engine)
        _run_alembic("stamp")
    else:
        # MANAGED DB — alembic_version present. Apply pending migrations only.
        # Idempotent: alembic skips revisions already in alembic_version.
        print("  ↳ managed DB → alembic upgrade head")
        _run_alembic("upgrade")


if __name__ == "__main__":
    main()
