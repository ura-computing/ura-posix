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
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # backend/ → `import app…`

from sqlalchemy import inspect, text

from app.core.database import Base, engine
from app.core import models  # noqa: F401 — registers all tables on Base.metadata


def _ensure_extensions() -> None:
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm;"))
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS unaccent;"))
        # Postgres's own unaccent() is STABLE, not IMMUTABLE, so it can't back
        # an index (see migration 0019 / models.Medicament's expression
        # index). Created here — not just in that migration — because a
        # FRESH DB takes the create_all()+stamp path below, which skips
        # migrations' raw SQL entirely; create_all() still needs this
        # function to exist to build that index.
        # Schema-qualified body: Postgres 17+ runs index expressions (CREATE
        # INDEX, REINDEX, ANALYZE) with search_path = pg_catalog, pg_temp.
        # Runs on every boot, so it also repairs DBs created with the old body.
        conn.execute(
            text("""
            CREATE OR REPLACE FUNCTION immutable_unaccent(text)
            RETURNS text AS
            $$
                SELECT public.unaccent('public.unaccent'::regdictionary, $1)
            $$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;
        """)
        )
        conn.commit()

        # Self-check under that same restricted search_path — makes a local
        # Postgres 16 fail the way Postgres 17 does in production.
        conn.execute(text("SET LOCAL search_path = pg_catalog, pg_temp"))
        got = conn.execute(text("SELECT public.immutable_unaccent('é')")).scalar()
        conn.rollback()
        if got != "e":
            sys.exit(f"immutable_unaccent() self-check failed: got {got!r} for 'é' (expected 'e')")
    print("  ↳ pg_trgm + unaccent + immutable_unaccent() ready")


def _run_alembic(cmd: str) -> None:
    """Invoke alembic via the same uv-managed venv as the caller."""
    result = subprocess.run(
        ["alembic", cmd, "head"],
        cwd=Path(__file__).resolve().parent.parent,
        check=False,
    )
    if result.returncode != 0:
        sys.exit(result.returncode)


def main() -> None:
    print("▸ Bootstrapping schema…")
    _ensure_extensions()

    insp = inspect(engine)
    has_pharmacies = insp.has_table("pharmacies")
    has_alembic = insp.has_table("alembic_version")

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
