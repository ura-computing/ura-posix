#!/usr/bin/env bash
# One-time: copy every local database from the old Postgres 16 volume
# (`postgres_data`) into the Postgres 17 one (`pg17_data`) — see
# docker-compose.yml. The old volume is left untouched (backup) and the SQL
# dump is kept too. Refuses to run if Postgres 17 already holds app tables.
#   bash scripts/pg16-to-17.sh
set -euo pipefail
cd "$(dirname "$0")/.."

cp env/demo/docker.env .env 2>/dev/null || true      # same .env as `make db`
DUMP="$(mktemp -t pg16-dump-XXXXXX.sql)"
psql17() { docker compose exec -T db psql -U apcm "$@"; }

echo "▸ Stopping the current db container (its volume stays)…"
docker compose rm -sf db

echo "▸ Reading Postgres 16 (volume postgres_data)…"
docker compose --profile pg16 up -d --wait db16
docker compose exec -T db16 pg_dumpall -U apcm > "$DUMP"
docker compose --profile pg16 rm -sf db16
echo "  ↳ dump: $DUMP ($(du -h "$DUMP" | cut -f1))"

echo "▸ Starting Postgres 17 (volume pg17_data)…"
docker compose up -d --wait db
for db in apcm apcm_demo; do
  if psql17 -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" | grep -q 1 &&
     psql17 -d "$db" -tAc "SELECT to_regclass('public.pharmacies') IS NOT NULL" | grep -q t; then
    echo "✗ Postgres 17 already has data in '$db' — nothing restored. Dump kept: $DUMP"
    exit 1
  fi
done

echo "▸ Restoring into Postgres 17…"
# The role and the empty apcm_demo DB already exist in a fresh 17 → hide those
# « already exists » errors; any other error is shown.
psql17 -d postgres -q < "$DUMP" 2> >(grep -v "already exists" >&2)

echo "▸ Databases now in Postgres 17:"
psql17 -d postgres -tAc "SELECT datname FROM pg_database WHERE NOT datistemplate AND datname <> 'postgres' ORDER BY 1"
echo "✓ Done. Old Postgres 16 volume kept (postgres_data). Dump kept: $DUMP"
