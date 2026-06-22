# PharmaGest (apcm-refactor)

Gestion de pharmacie — refonte de apcm-pharma. Backend FastAPI + Postgres,
frontend React + Vite + Tailwind, extension Chrome (séparée).

## Run the demo (one command)

For a client or a teammate testing the app end-to-end:

```bash
git fetch origin
git checkout -B refactoring origin/refactoring   # if not already on this branch
make demo
```

That's it. The demo:
- Builds the backend + frontend Docker images (~60s the first time, faster after)
- Boots Postgres 16, creates extensions (`pg_trgm`, `unaccent`), applies all Alembic migrations
- Seeds two demo users + the sample catalogue (~16 000 produits)
- Opens on:
  - **Frontend** — http://localhost:4173
  - **Backend** — http://localhost:8000 (API at `/v1/...`, health at `/v1/health`)

### Demo accounts

| Rôle    | Email             | Mot de passe |
|---------|-------------------|--------------|
| Admin   | admin@gmail.com   | admin@123    |
| Owner   | owner@gmail.com   | owner@123    |

The owner manages **Pharmacie Demo**. Both accounts are created on first boot
and skipped on subsequent restarts (idempotent seed).

### Switching between old and new code

If you have the old `apcm-pharma` demo running, stop it first to free up
ports 4173 / 8000:

```bash
cd ../apcm-pharma && docker compose down
cd ../apcm-refactor && make demo
```

The Postgres data volume is named `postgres_data` in both projects, so the
new code's `alembic upgrade head` runs **idempotently** against your existing
`apcm_demo` database (the refactor's migrations are designed to skip
already-existing tables — see `backend/alembic/versions/0006_create_data_tables.py`).

Your existing data survives the switch.

### Demo controls

| Command | What it does |
|---|---|
| `make demo`  | Build + start the full stack (idempotent — safe to re-run) |
| `make down`  | Stop containers; **Postgres data volume survives** |
| `make logs`  | Tail container logs |
| `make clean` | **DESTRUCTIVE** — stop and wipe the demo database volume |

## Local dev (without Docker)

```bash
# Backend — terminal 1
cd backend
cp .env.example .env       # set DATABASE_URL, JWT_SECRET, FRONTEND_URL
uv sync
uv run alembic upgrade head

# Frontend — terminal 2
cd frontend
cp .env.example .env       # set VITE_BACKEND_URL=http://localhost:8000

# Then from the repo root:
make dev                   # runs backend (:8000) + frontend (:5173) in parallel
```

Other useful targets:

| Command | What it does |
|---|---|
| `make dev`      | Backend + frontend in parallel (Ctrl+C kills both) |
| `make backend`  | Only the backend (uvicorn :8000, hot reload) |
| `make frontend` | Only the frontend (Vite dev server :5173) |
| `make migrate`  | Apply Alembic migrations against your local DB |
| `make cli`      | Interactive Python CLI to poke the API |
| `make help`     | List every target |

## Project layout

```
apcm-refactor/
├── backend/          FastAPI + SQLAlchemy + Alembic
│   ├── alembic/      DB migrations (0001 → 0010)
│   ├── routers/      HTTP endpoints (auth, transactions, uploads, …)
│   ├── seed.py       Demo seed — runs on Docker boot, idempotent
│   ├── Dockerfile    uv-based, ~150MB image
│   └── entrypoint.sh wait-for-db → extensions → migrate → seed → uvicorn
├── frontend/         React 19 + Vite 8 + Tailwind v4 + TanStack Query
│   ├── src/api/      Single source of truth for `${VITE_BACKEND_URL}/v1/...`
│   ├── src/pages/    /achats, /ventes, /stock, /admin/catalogue, …
│   ├── src/contexts/UploadContext.tsx   Chunked CSV uploads (500 rows / chunk)
│   └── Dockerfile    Multi-stage; serves dist on :4173
├── docker-compose.yml  db + backend + frontend (demo)
├── env/demo/         Demo env files (copied to .env by `make demo`)
└── resources/        Sample Sobrus catalog CSV (~16k rows)
```

## Sobrus CSV imports

Owners import Sobrus exports (Achats / Ventes / Stock) via the `/upload-file`
wizard:

1. Pick the doc type
2. Drop or browse-pick a CSV — filename must match the Sobrus pattern (e.g. `Sobrus - Stock 20260622.csv`)
3. Preview 8 rows, click Importer

All three doc types go through the same chunked JSON upload path (500 rows
per request). The bottom-right progress widget survives navigation; you can
leave `/upload-file` and the upload keeps running.

The Chrome extension (separate repo) hits the same endpoints.

## Notes for tomorrow

- The demo seed currently grants the owner **all 9 features** by inserting `pharmacy_features` + `user_permissions` rows. This is a **temporary workaround** — see the `⚠️ REMOVE THIS BLOCK` comment in `backend/seed.py`. Once the admin "Gérer les permissions" page lands, the seed should only create accounts and let the admin grant features through the UI.
- Concurrent multi-upload (start a stock import + an achat import in parallel) is queued. See the project plan file.
