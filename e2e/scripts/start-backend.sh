#!/usr/bin/env sh
# Backend for the E2E suite: regenerate the test data, reset the `apcm_e2e`
# database, bootstrap + seed it, then serve on :8001. Started by Playwright
# (playwright.config.ts → webServer); never touches the dev DB `apcm`.
# Output is also written to e2e/.logs/backend.log (email magic links land there).
set -eu

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG="$ROOT/e2e/.logs/backend.log"
mkdir -p "$(dirname "$LOG")"
: > "$LOG"
cd "$ROOT"

echo "▸ Generating test data (${E2E_ROWS:-100000} vente rows)…"
python3 resources/tests/generate.py --rows "${E2E_ROWS:-100000}"

echo "▸ Resetting database apcm_e2e…"
make -s db
docker compose exec -T db psql -U apcm -d postgres -q \
  -c "DROP DATABASE IF EXISTS apcm_e2e WITH (FORCE);" \
  -c "CREATE DATABASE apcm_e2e;"

cd backend
export DATABASE_URL="postgresql+psycopg2://apcm:apcm@localhost:5432/apcm_e2e"
export FRONTEND_URL="http://localhost:5174"
export COOKIE_SECURE=false
export MAIL_USERNAME=""          # no SMTP: emails (magic links) are printed to the log
export PYTHONUNBUFFERED=1
export SEED_CATALOG=0            # catalogue = generated products only (every value known)
export RATE_LIMIT=0              # the suite logs in more than 5 times a minute
uv run python scripts/bootstrap.py
uv run python scripts/seed.py
uv run uvicorn main:app --port 8001 2>&1 | tee -a "$LOG"
