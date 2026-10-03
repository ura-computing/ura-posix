# PharmaGest — the plan (everything left, in order)

Updated 2026-10-03. One list, top to bottom. Open items only: a step leaves this file when
`make tests` is green. Rules: `.claude/CLAUDE.md`. App + setup: `README.md`.

**Order:** §1 run → §3 production tools (DO console, yours).

---

## 0. How a step works

| Rule | Why / example |
|---|---|
| One step → `make tests` green → step removed from this file | the oracle (`resources/tests/oracle.py`) pins every number |
| The oracle changes only for a bug fix listed here, in the same step | a refactor never moves a number silently |
| API path / shape changes only when this plan says so (frontend + E2E in the same step) | coverage gate `99-gates.spec.ts` |
| Hidden store website (`routers/store_website.py`, `pages/store/*`): moved as-is, never rewritten | hidden, must not break |

---

## 1. Waiting for your run

| What | Where |
|---|---|
| Backend layout: all code in `backend/app/` (`core/`, `identity/auth` + `identity/members`, `catalog/`, `ingestion/`, `ledger/`, `analytics/`, `accounting/payments` + `accounting/exclusions`, `store_website/`), scripts in `backend/scripts/` (`bootstrap.py`, `seed.py` + `seed.json`, legacy migration). `main.py` stays at the backend root (`uvicorn main:app` unchanged for deployments); scripts: `python scripts/…` (Makefile, `entrypoint.sh`, E2E start script). OpenAPI identical. **Fix**: `entrypoint.sh` still imported `database` / `models` since the `core/` step (Docker + production boot would crash) | every spec; Docker: `make demo` |

---

## 3. Production tools (DigitalOcean)

Production = 3 parts on DigitalOcean: **backend** app, **frontend** app, **managed Postgres 17**.

| When | Tool | What it gives | Watch out |
|---|---|---|---|
| Now (DO console, once) | `pg_stat_statements`: `CREATE EXTENSION pg_stat_statements;` on the managed DB | list of the slowest real queries in production | read-only, no app change |
| Now (DO console) | Frontend as an App Platform **static site** (build `npm run build`, output `dist`, catch-all → `index.html`) | served from DO's CDN; hashed assets cached 1 year, `index.html` never cached | needs S2 for small chunks |
| Later | **S6 daily pre-aggregates**: table `daily_sales(pharmacy_id, date, medicament_id, qty, ca)` refreshed after each import / undo; Rapport trend + Analyses mois / année read it | ~365 rows per product-year instead of every sale line | only if `pg_stat_statements` shows `/stats` / analyse slow: today 248 ms / 88 ms at 100k rows, and a 2nd copy of the sales must stay right after every import, undo, catalogue change |
| Later | Rapport server cache keyed by a data version (bumped on import, exclusion, catalogue change) | repeat visits only; first view after an import stays the same | add only if `/stats` is still a problem in production (`pg_stat_statements`) |
| Later | **Valkey** (DO Managed Caching; open-source Redis fork) | shared Rapport cache + shared rate limit (B3) + job queue for all workers | one more paid DO part |
| Later | **RQ worker** (Python job queue on Valkey) | imports / exports run off the request path (B4); the page polls the status | one more DO component |
| Later | **PgBouncer** (DO connection pools) | many workers without hitting the DB connection limit | needed once workers × instances × 30 > DB limit |
| Later | Read replica (DO managed Postgres) | Rapport / Analyses read from it, imports write to the primary | only if DB CPU is high (see `pg_stat_statements`) |
| Later | **SigNoz** (open source, decision 2026-10-02) | errors with stack traces, slow requests, logs, metrics in one place | self-hosted on a DO Droplet (≥ 4 GB RAM, Docker Compose). App sends OpenTelemetry (`opentelemetry-instrumentation-fastapi`, `-sqlalchemy`); same code works with Grafana (Tempo / Loki / Prometheus) |

---

## 7. Open bugs and blockers

**Bugs**

| # | Bug | Example |
|---|---|---|
| G2 | Analyse row CA = `Vente.total`, KPI CA = `qty × PPV` (`analyse_queries.py`) | 10 × 20 DH with a 10 % discount → row shows 180, KPI shows 200 |
| G3 | Supplier axes join sales once per supplier (`analyse_queries.py`) | product X bought from GROSSISTE A and LABO B, 100 sold → counted 100 in both rows |

**Blockers for the microservice split**

| # | Problem | Example → fix |
|---|---|---|
| B1 | One shared DB | import and stats both read `medicaments` + exclusions → start with workers on the same DB and models (§3); don't split the DB |
| B2 | Auth needs the DB | every request loads user + session + 3 permission layers → a new service needs `JWT_SECRET` + DB, or a gateway |
| B3 | In-memory rate limit (`rate_limit.py`) | 2 workers → login limit 10/min instead of 5 → `Limiter(storage_uri=<Valkey URL>)` |
| B4 | Blocking catalogue upload: `async def upload_catalog` runs sync SQLAlchemy (`routers/imports.py`) | pharmacy A uploads a 50 MB CSV → pharmacy B's Rapport waits → plain `def`, or the RQ worker |
| B5 | Race on a new product insert | 2 chunks insert PID 12345 at once → UniqueViolation → 500 → `ON CONFLICT (pid) DO NOTHING` + re-select (S7) |
| B6 | Batch set to `success` after **every** chunk (`routers/imports.py`) | browser closed after chunk 1/40 → batch « success » with 500 of 20 000 rows → chunks keep `in_progress`, the final `success` PATCH (S3) closes the batch |
| B7 | CA = `qty × Medicament.ppv`, and `ppv` is global and mutable | January sold 100 × 15.00 = 1 500; June import sets PPV 16.50 → January becomes 1 650 for every pharmacy → every cache is cleared on catalogue edits |
| B8 | `Vente.date`, `Achat.delivery_date` are text (`models.py`) | `cast(date as Date)` can't use the index; « 15/01/2024 » → 500 → real `DATE` columns |
| B9 | `date.today()` uses the server timezone (`*_queries.py`) | server UTC, pharmacy at 00:30 Casablanca → « today » is yesterday → `TZ=Africa/Casablanca` in every service |

---

## 8. Later

**Last step of all (decision 2026-10-03):** re-check every commit on `dev` and reorganize them (one clear commit per topic, messages that match the content: amended commits mixed topics, e.g. `63e6292` holds G8 + /stock). `dev` is pushed → needs a force push, only on your OK. Then README update (one final docs pass).

| What | Notes |
|---|---|
| Microservices: ingestion + analytics | each = move `backend/app/ingestion/` or `backend/app/analytics/` out; blockers §7; Rapport cache moves to Valkey |
| « Ma boutique en ligne » | hidden; add its E2E specs the day it is shown (allowlisted in `99-gates.spec.ts`) |

---

## 9. Open questions (your call)

| # | Question | Example |
|---|---|---|
| Q1 | Average PU: some places skip purchase lines with no price or qty ≤ 0 (ventes ledger, stock, top categories, analyse produit), others keep them (Rapport marge, margin alerts, analyse catégorie). Same filter everywhere? Locked formula | qty 5, PU empty kept → Σqty 15 instead of 10 → avg PU lower. Test data has no such line today |
