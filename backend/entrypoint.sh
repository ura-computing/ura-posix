#!/usr/bin/env sh
# Boot sequence for the backend container. Idempotent: safe to re-run on every
# `docker compose up` regardless of whether the DB is fresh or already populated.
set -eu

# 1. Wait for Postgres + enable required extensions. Uses SQLAlchemy (the same
#    URL the app uses, including the `+psycopg2` driver suffix — psycopg2's own
#    libpq client doesn't accept that suffix, so we go through SQLAlchemy).
#    The extension CREATEs are idempotent (`IF NOT EXISTS`).
echo "▸ Waiting for Postgres + enabling extensions…"
uv run python - <<'PY'
import os, time, sys
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError

url = os.environ["DATABASE_URL"]
engine = create_engine(url, isolation_level="AUTOCOMMIT")
for attempt in range(60):
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm;"))
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS unaccent;"))
        break
    except OperationalError as e:
        if attempt == 59:
            print(f"✗ Postgres unreachable after 60s: {e}", file=sys.stderr)
            raise
        time.sleep(1)
print("✓ Postgres ready + extensions enabled")
PY

# 3. Schema bootstrap + migrations. The 10 alembic migrations assume the base
#    apcm-pharma tables already exist (0001 adds `pharmacies.version`, 0002 adds
#    user columns, etc.). On a TRULY FRESH DB this fails — there's no `pharmacies`
#    table to alter. Two paths:
#      • DB already has `pharmacies` (old apcm-pharma DB OR refactor DB) →
#        `alembic upgrade head` brings it to revision 0010. Idempotent: existing
#        tables stay, add_column adds missing columns, has_table guards in 0006
#        skip already-created tables.
#      • Fresh empty DB → `Base.metadata.create_all()` creates everything at the
#        current model shape, then `alembic stamp head` marks the DB as up-to-date
#        so future migrations apply correctly.
echo "▸ Bootstrapping schema…"
uv run python - <<'PY'
from sqlalchemy import inspect
from database import Base, engine
import models  # noqa: F401 — registers all tables on Base.metadata

if inspect(engine).has_table("pharmacies"):
    print("  ↳ existing tables detected → alembic upgrade head")
    bootstrap_mode = "upgrade"
else:
    print("  ↳ empty DB → create_all + stamp head")
    Base.metadata.create_all(bind=engine)
    bootstrap_mode = "stamp"

# Write mode to a tmpfile the shell can read.
import pathlib; pathlib.Path("/tmp/.bootstrap_mode").write_text(bootstrap_mode)
PY

if [ "$(cat /tmp/.bootstrap_mode)" = "stamp" ]; then
  uv run alembic stamp head
else
  uv run alembic upgrade head
fi

# 4. Seed admin + owner + catalog. Idempotent — checks for admin email before
#    inserting anything.
echo "▸ Seeding accounts + catalogue…"
uv run python seed.py

# 5. Serve.
echo "▸ Starting uvicorn on :${PORT:-8000}"
exec uv run uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
