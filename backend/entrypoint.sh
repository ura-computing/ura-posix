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
#    `make migrate` — single source of truth in bootstrap.py.
uv run python bootstrap.py

# 4. Seed admin + owner + catalog. Idempotent — checks for admin email before
#    inserting anything.
echo "▸ Seeding accounts + catalogue…"
uv run python seed.py

# 5. Serve.
echo "▸ Starting uvicorn on :${PORT:-8000}"
exec uv run uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
