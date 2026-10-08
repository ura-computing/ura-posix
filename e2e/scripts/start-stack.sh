#!/usr/bin/env sh
# E2E stack, built and run like production (see e2e/docker-compose.e2e.yml): regenerate
# the test data, build the backend + frontend images, start them on a fresh Postgres 17,
# then stream the backend log to e2e/.logs/backend.log (magic links are read there).
# Started by Playwright (playwright.config.ts → webServer); when Playwright stops it,
# the containers and their data are removed. Never touches the dev stack.
set -eu

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG="$ROOT/e2e/.logs/backend.log"
COMPOSE="docker compose -f $ROOT/e2e/docker-compose.e2e.yml"
mkdir -p "$(dirname "$LOG")"
: > "$LOG"
cd "$ROOT"

echo "▸ Generating test data (${E2E_ROWS:-100000} vente rows)…"
python3 resources/tests/generate.py --rows "${E2E_ROWS:-100000}"

stop() {
  $COMPOSE down -v --remove-orphans > /dev/null 2>&1 || true
}
stop # leftovers of a run that was killed
trap 'stop; exit 0' INT TERM
trap stop EXIT

echo "▸ Building + starting the production images (backend, frontend) on Postgres 17…"
# Not up (e.g. « backend is unhealthy »): print why before the containers are removed.
if ! $COMPOSE up --build --wait; then
  echo "▸ Backend log (the stack did not start):"
  $COMPOSE logs --no-color --no-log-prefix backend 2>&1 | tail -n 80
  exit 1
fi

echo "▸ Stack ready: API http://localhost:8001, app http://localhost:5174"
$COMPOSE logs -f --no-color --no-log-prefix backend >> "$LOG"
