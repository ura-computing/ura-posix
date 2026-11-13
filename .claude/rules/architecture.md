---
paths:
  - "backend/**"
  - "resources/**"
  - "docker-compose.yml"
---

# Backend architecture

All code in `backend/app/`, one folder per business area (like `frontend/src/pages/<group>/<page>/`). An area with
2+ parts nests them (`identity/auth`, `accounting/payments`). Backend root = `main.py`, `app/`, `scripts/`, `alembic/`, config files.

| Folder | Holds |
|---|---|
| `main.py` (backend root, deployments run `main:app`) | FastAPI app; includes the routers of its `SERVICE` (`app/core/services.py`: identity · analytics · ingestion · sobrus; unset = all). New router → add it to `ROUTER_MODULES` + one service, then `uv run python scripts/gateway_routes.py` (writes `gateway/Caddyfile`) |
| `app/core/` | config, database, models, errors, security, permissions, rate_limit, search, utils, email_service, `/health` |
| `app/identity/auth/` · `app/identity/members/` | login, me, sessions · admin pharmacies + owner team (`admin_router.py`, `owner_router.py`, `service.py`) |
| `app/catalog/` | médicaments + category suffixes (admin) |
| `app/ingestion/` | CSV imports (achats, ventes, stock) + « Gestion des imports » list / undo, `csv_parse.py` |
| `app/sobrus/` | Sobrus robot: `router.py` (queues runs, reads what the worker stored), `worker.py` + `sync.py` (every Sobrus call: run modes full / new / range / check / products, cash closing), `sobrus_client.py`, `catalog_import.py` |
| `app/products/` | Produits list + product sheet, owner edits, « Observations » (`product_queries.py`, `notes_queries.py`) |
| `app/history/` | « Historique des modifications » (`audit_logs`, read-only) |
| `app/ledger/` | ventes + achats lists, suggestions, exports |
| `app/analytics/` | stats, alerts, stock, analyse: `router.py` + `*_queries.py` + `query_parts.py` |
| `app/accounting/payments/` · `app/accounting/exclusions/` | payments · special products / BL / suppliers (`service.py`), Comptabilité only |
| `app/store_website/` | hidden feature, moved as-is |
| `scripts/` | `bootstrap.py` (schema, `make migrate`), `seed.py` + `seed.json`, one-time legacy migration |

| Rule | Example |
|---|---|
| One area folder = `router.py` + `schemas.py` (+ `service.py` / `*_queries.py`) | `app/catalog/router.py`, `app/catalog/schemas.py` |
| Heavy SQL / aggregates in `*_queries.py`; router = read params → call → return the schema | `app/analytics/stats_queries.py` |
| Imports always absolute from `app` | `from app.core.models import User` |
| Errors: `raise ApiError(status, ErrorCode.X, "French detail")` (`app/core/errors.py`) | frontend shows `errors.<code>`; codes equal on both sides (gate) |
| Run: `uv run uvicorn main:app`; scripts: `uv run python scripts/seed.py` | Makefile (`make dev`), `entrypoint.sh` (Docker: demo, E2E, production) |
| Import dates: always `csv_parse.normalize_date` / `normalize_datetime` / `parse_date` (files saved by hand: `23/1/26`) | stored as ISO text `2026-01-23`: period filters compare text |
| Schema changes: Alembic (`alembic/versions/`), applied by `scripts/bootstrap.py` | `make migrate` |

- Stack: FastAPI + SQLAlchemy 2 + Postgres (unaccent) + Alembic.
- API paths / shapes change only when `PLAN.md` says so; frontend + E2E change in the same step.
- Style: `ruff format`, line length 120 (`make format`).

# Postgres 17 (dev, demo, E2E, production DigitalOcean)

- Never test on another version.
- Index SQL functions schema-qualified: `public.unaccent(...)`. PG 17 runs index expressions with `search_path = pg_catalog, pg_temp`.
- `csv_parse._normalized_name_expr` byte-identical to index `ix_medicaments_normalized_name`, else the index is skipped.
