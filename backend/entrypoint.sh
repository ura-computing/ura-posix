#!/usr/bin/env sh
# Boot sequence for the backend container. Idempotent: safe to re-run on every
# `docker compose up` regardless of whether the DB is fresh or already populated.
set -eu

# 1. Wait for Postgres to be reachable (the db service health-check covers
#    the container, but the network can lag a moment after `service_healthy`).
echo "▸ Waiting for Postgres…"
uv run python - <<'PY'
import os, time, sys
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError

engine = create_engine(os.environ["DATABASE_URL"], isolation_level="AUTOCOMMIT")
for attempt in range(60):
    try:
        engine.connect().close()
        break
    except OperationalError as e:
        if attempt == 59:
            print(f"✗ Postgres unreachable after 60s: {e}", file=sys.stderr)
            raise
        time.sleep(1)
print("✓ Postgres reachable")
PY

# 2. Schema bootstrap (extensions + migrations or stamp). Shared with
#    `make migrate` — single source of truth in scripts/bootstrap.py.
uv run python scripts/bootstrap.py

# 3. Scraped product photos + descriptions (« Produits »): the table = the file, every start.
uv run python scripts/load_product_infos.py

# 4. Seed admin + owner + catalog. Idempotent: seed.py self-skips if the
#    admin user already exists. We short-circuit here too so the container
#    doesn't even open a session when there's clearly nothing to seed —
#    bootstrap.py already touched the DB and proved tables exist.
NEEDS_SEED=$(uv run python <<'PY'
from sqlalchemy import inspect
from app.core.database import engine, SessionLocal
from app.core.models import User

if not inspect(engine).has_table("users"):
    print("yes")
else:
    db = SessionLocal()
    try:
        print("no" if db.query(User).filter(User.role == "admin").first() else "yes")
    finally:
        db.close()
PY
)

if [ "$NEEDS_SEED" = "yes" ]; then
  echo "▸ Seeding accounts + catalogue…"
  uv run python scripts/seed.py
else
  echo "▸ Admin already present — skipping seed (data preserved)."
fi

# 5. Serve.
echo "▸ Starting uvicorn on :${PORT:-8000}"
# WEB_CONCURRENCY processes (default 2): CPU-heavy requests (exports, imports) run in
# parallel instead of sharing one Python process. Login rate limit counts per process.
exec uv run uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers "${WEB_CONCURRENCY:-2}"
