#!/usr/bin/env sh
# Boot sequence for the backend container. Idempotent: safe to re-run on every
# `docker compose up` regardless of whether the DB is fresh or already populated.
#   entrypoint.sh          the API: migrations, photos, seed, uvicorn (with SERVICE=identity when split)
#   entrypoint.sh serve    one more API service (SERVICE=analytics|ingestion|sobrus): uvicorn only, started once
#                          the one above has migrated (app/core/services.py)
#   entrypoint.sh worker   the Sobrus robot (DigitalOcean « Worker » component): waits for the API's
#                          migrations, never migrates (app/sobrus/worker.py)
set -eu
ROLE="${1:-api}"

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

if [ "$ROLE" = worker ]; then
  echo "▸ Starting the Sobrus robot"
  # One run at a time: 1 session (+ a spare), its LISTEN connection outside the pool (app/core/database.py budget).
  export DB_POOL_SIZE="${DB_POOL_SIZE_WORKER:-2}" DB_MAX_OVERFLOW="${DB_MAX_OVERFLOW_WORKER:-1}"
  export DB_STATEMENT_TIMEOUT_MS=0  # a whole year of a big pharmacy imported in one run: no limit here
  exec uv run python -m app.sobrus.worker
fi

if [ "$ROLE" = serve ]; then
  echo "▸ Starting uvicorn (${SERVICE:-all routers}) on :${PORT:-8000}"
  exec uv run uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers "${WEB_CONCURRENCY:-1}"
fi

# 2. Schema bootstrap (extensions + migrations or stamp). Shared with
#    `make migrate` — single source of truth in scripts/bootstrap.py.
uv run python scripts/bootstrap.py

# 3. Scraped product photos + descriptions (« Produits »): the table = the file, every start.
uv run python scripts/load_product_infos.py

# 3b. The labs' conditions board (« Fournisseurs », D-3): once per lab, never replaces what the admin typed.
uv run python scripts/load_board_conditions.py

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
