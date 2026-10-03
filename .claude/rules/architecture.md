---
paths:
  - "backend/**"
  - "resources/**"
  - "docker-compose.yml"
---

# Backend architecture

| Piece | Where | Example |
|---|---|---|
| One domain | `routers/<domain>.py` + `schemas/<domain>.py` (one router + one schema per domain) | ventes + achats ledger → `routers/transactions.py` + `schemas/transactions.py` |
| Heavy SQL / aggregates | `*_queries.py` (`stats_queries.py`, `analyse_queries.py`, `stock_queries.py`) | router: read params → call the query function → return the schema |
| Exclusions | `exclusions.py` | special products, BL, suppliers — Comptabilité only |
| Member lifecycle | `members.py` | admin + owner member pages share it |
| Errors | `errors.py`: `raise ApiError(status, ErrorCode.X, "French detail")` | frontend shows `errors.<code>`; codes equal on both sides (gate) |
| Schema changes | Alembic; `bootstrap.py` applies them (`make migrate`) | |

- Stack: FastAPI + SQLAlchemy 2 + Postgres (unaccent) + Alembic.
- API paths / shapes change only when `PLAN.md` says so; frontend + E2E change in the same step.
- Planned (`PLAN.md` §6): one folder per domain, moves + import paths only, same URLs.
- Style: `ruff format`, line length 120 (`make format`).

# Postgres 17 (dev, demo, E2E, production DigitalOcean)

- Never test on another version.
- Index SQL functions schema-qualified: `public.unaccent(...)`. PG 17 runs index expressions with `search_path = pg_catalog, pg_temp`.
- `csv_parse._normalized_name_expr` byte-identical to index `ix_medicaments_normalized_name`, else the index is skipped.
