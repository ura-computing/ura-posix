#!/usr/bin/env sh
# E2E stack, built and run like production (see e2e/docker-compose.e2e.yml): regenerate
# the test data, build the backend + frontend images, start them on a fresh Postgres 17,
# then stream the logs of the backend and of the Sobrus robot (`worker`) to e2e/.logs/backend.log (magic
# links and the « connexion Sobrus » emails are read there).
# Started by Playwright (playwright.config.ts → webServer); when Playwright stops it,
# the containers and their data are removed. Never touches the dev stack.
# E2E_DO=1 (run.sh asks): DigitalOcean's limits (env/do/limits.yml, e2e/docker-compose.do.yml) and every 5 s
# one line in e2e/.logs/resources.log (RAM, DB connections, DB size, backend state) for the DO gate (99-gates).
set -eu

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG="$ROOT/e2e/.logs/backend.log"
RESOURCES="$ROOT/e2e/.logs/resources.log"
COMPOSE="docker compose -f $ROOT/e2e/docker-compose.e2e.yml"
if [ "${E2E_DO:-0}" = 1 ]; then
  COMPOSE="$COMPOSE -f $ROOT/env/do/limits.yml -f $ROOT/e2e/docker-compose.do.yml"
fi
mkdir -p "$(dirname "$LOG")"
: > "$LOG"
: > "$RESOURCES"
cd "$ROOT"

echo "▸ Generating test data (${E2E_ROWS:-100000} vente rows)…"
python3 resources/tests/generate.py --rows "${E2E_ROWS:-100000}"

SAMPLER=""
stop() {
  [ -n "$SAMPLER" ] && kill "$SAMPLER" 2> /dev/null || true
  $COMPOSE down -v --remove-orphans > /dev/null 2>&1 || true
}

# One JSON line every 5 s: docker stats of backend + worker + db, the backend's processes (RAM of each:
# uvicorn), client connections and DB size (or the error when Postgres refuses: « too many clients »),
# backend and worker status + OOM-killed (one of its processes killed for lack of memory).
sample() {
  be="$($COMPOSE ps -aq backend)"
  wk="$($COMPOSE ps -aq worker)"
  db="$($COMPOSE ps -aq db)"
  while :; do
    stats="$(docker stats --no-stream --format '{{json .}}' "$be" "$wk" "$db" 2> /dev/null | paste -sd, -)" || true
    procs="$(docker exec "$be" sh -c 'for d in /proc/[0-9]*; do kb=""; while read -r k v _; do
      [ "$k" = VmRSS: ] && kb=$v; done < "$d/status"; [ -n "$kb" ] && printf "{\"kb\":%s,\"cmd\":\"%s\"}," "$kb" \
      "$(tr "\0\n" "  " < "$d/cmdline" | tr -d "\"\\\\" | cut -c1-80)"; done' 2> /dev/null)" || true
    state="$(docker inspect -f '"backend":"{{.State.Status}}","oom":{{.State.OOMKilled}}' "$be" 2> /dev/null)" ||
      state='"backend":"gone","oom":false'
    wstate="$(docker inspect -f '"worker":"{{.State.Status}}","worker_oom":{{.State.OOMKilled}}' "$wk" 2> /dev/null)" ||
      wstate='"worker":"gone","worker_oom":false'
    pg="$(docker exec "$db" psql -U apcm -d apcm_e2e -tAc \
      "select count(*) filter (where backend_type = 'client backend' and pid <> pg_backend_pid()),
              pg_database_size(current_database()) from pg_stat_activity" 2>&1 | tr -d '\n' | tr '"' "'")"
    case "$pg" in
      *[!0-9\|]* | "") db_part="\"db_error\":\"$pg\"" ;;
      *) db_part="\"connections\":${pg%%|*},\"db_bytes\":${pg#*|}" ;;
    esac
    echo "{\"t\":\"$(date -u +%FT%TZ)\",\"stats\":[$stats],\"procs\":[${procs%,}],$state,$wstate,$db_part}" >> "$RESOURCES"
    sleep 5
  done
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
if [ "${E2E_DO:-0}" = 1 ]; then
  echo "▸ DigitalOcean limits: backend 512 MB, worker 512 MB, Postgres 1 GB / 22 connections → $RESOURCES"
  sample &
  SAMPLER=$!
fi
$COMPOSE logs -f --no-color --no-log-prefix backend worker >> "$LOG"
