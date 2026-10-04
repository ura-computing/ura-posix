# PharmaGest — the plan (everything left, in order)

Updated 2026-10-03. One list, top to bottom. Open items only: a step leaves this file when
`make tests` is green. Rules: `.claude/CLAUDE.md`. App + setup: `README.md`.

**Order:** §1 run → §2 currency → §3 production tools (DO console, yours).

---

## 0. How a step works

| Rule | Why / example |
|---|---|
| One step → `make tests` green → step removed from this file | the oracle (`resources/tests/oracle.py`) pins every number |
| The oracle changes only for a bug fix listed here, in the same step | a refactor never moves a number silently |
| API path / shape changes only when this plan says so (frontend + E2E in the same step) | coverage gate `99-gates.spec.ts` |
| Hidden store website (`backend/app/store_website/`, `frontend/src/pages/store/*`): moved as-is, never rewritten | hidden, must not break |

---

## 1. Waiting for your run

| What | Where |
|---|---|
| B4: `upload_catalog` is a plain `def` (thread) + `file.file.read()`: a big catalogue upload no longer freezes the other requests. B9: « today » = pharmacy date (`app/core/utils.py` `today()`, Africa/Casablanca) in `stats_queries` + `stock_queries` (5 places), and `generate.py --today` defaults to the same date | `14-admin` (catalogue CSV), `03`, `04`, `05` (today-based windows) |
| B8: files saved again by hand (Excel) read like Sobrus files. Dates `23/1/26`, ` 05/02/2026 `, `23.01.2026 14:19` → stored `2026-01-23` (`csv_parse.normalize_date` / `normalize_datetime` / `parse_date`); impossible date (`31/02/2026`) → line not imported, « 1 ligne(s) non importée(s) : date illisible (exemple de date correcte : 23/01/2026) ». Numbers with no-break spaces (`1 234,50`). Migration `0021` rewrites the lines already stored the same way (production: runs at deploy, no manual SQL). `generate.py`: 40 lines per file + 1 stock expiry in 25 written by hand, oracle unchanged | `15-imports` (new test « dates tapées à la main »), `02` to `07` (hand lines inside every number) |
| G2 (decision 2026-10-04: CA = qty × PPV on every screen): Analyses rows Produit / Catégorie / Grossiste / Laboratoire (and Liste) use `ca_sum()` like the KPIs and the Rapport. 10 × 20 DH with 10 % remise → row 200 = KPI 200. Oracle: same `ca(v)` | `08-analyses` (every row) |
| Q1 (decision 2026-10-04): one rule for every average PU, `PRICED_PURCHASE` in `app/analytics/query_parts.py` (price set, qty > 0), applied inside `avg_pu_subquery`. PU 0 (free units, 352 lines in the real files) counts: 10 at 20 + 2 free → 16.67. Real files have no line without price or with qty ≤ 0, test data neither → no number moves | every spec (no change expected) |
| G3 (decision 2026-10-04: share by units bought): Grossiste / Laboratoire tabs split a product's sales between its suppliers by the units bought from each in the period (`_supplier_axis`, window `share`). X bought 60 from GROSSISTE A + 40 from LABO B, 100 sold → A 60, B 40; each margin uses that supplier's own PU; both tabs together = the sales once. Units can show decimals (« 33,33 »). Test data: 1 bought product in 4 also from a 2nd supplier (`add_second_suppliers`, real files: 1 in 2) → many oracle numbers move (avg PU, margins, ABCD, exclusions) | `08-analyses`, `03`, `05`, `07`, `10`, every spec |
| B5: new products created with `INSERT … ON CONFLICT (pid) DO NOTHING RETURNING pid` + one SELECT (`_batch_resolve_medicaments`, `app/ingestion/router.py`): two imports creating the same new PID at once → no 500; « N nouveaux produits » counts only the ones this import created. New test: 2 chunks sent together with the same unknown PID → created once, 2 lines | `15-imports` (new test before the last one), `02-import` |

---

## 2. Next: Q2 currency per pharmacy (decision 2026-10-04, plan — on your « go »)

Pharmacies in Spain / France work in euros. One currency per pharmacy, chosen by the admin.

| Part | Change | Example |
|---|---|---|
| DB | `pharmacies.currency` (`MAD` \| `EUR`, default `MAD`), migration `0022` | every existing pharmacy → `MAD`, nothing moves |
| Admin | « Monnaie » on create / edit pharmacy: « Dirham (MAD) » / « Euro (€) » | Madrid pharmacy → Euro |
| API | `/auth/me` returns the pharmacy `currency` | `{"currency": "EUR"}` |
| Frontend | `formatMAD` → `formatMoney` (currency of the signed-in pharmacy, set once like the language); labels « CA (MAD) » → « CA ({{cur}}) »; Excel headers the same | « 1 234,56 € », header « CA (€) » |
| E2E | owner pharmacy stays MAD (every spec unchanged); 1 new test: admin sets a 2nd pharmacy to Euro → its owner sees « € » on the Rapport + Excel header | `14-admin` |

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

## 7. Blockers for the microservice split

| # | Problem | Example → fix |
|---|---|---|
| B1 | One shared DB | import and stats both read `medicaments` + exclusions → start with workers on the same DB and models (§3); don't split the DB |
| B2 | Auth needs the DB | every request loads user + session + 3 permission layers → a new service needs `JWT_SECRET` + DB, or a gateway |
| B3 | In-memory rate limit (`app/core/rate_limit.py`) | 2 workers → login limit 10/min instead of 5 → `Limiter(storage_uri=<Valkey URL>)` |
| B7 | CA = `qty × Medicament.ppv`, and `ppv` is global and mutable | January sold 100 × 15.00 = 1 500; June import sets PPV 16.50 → January becomes 1 650 for every pharmacy → every cache is cleared on catalogue edits |
| B8 | `Vente.date`, `Achat.delivery_date` are ISO text (`app/core/models.py`) | `cast(date as Date)` can't use the index → real `DATE` columns |

---

## 8. Later

**Last step of all (decision 2026-10-03):** re-check every commit on `dev` and reorganize them (one clear commit per topic, messages that match the content: amended commits mixed topics, e.g. `63e6292` holds G8 + /stock). `dev` is pushed → needs a force push, only on your OK. Then README update (one final docs pass).

| What | Notes |
|---|---|
| Microservices: ingestion + analytics | each = move `backend/app/ingestion/` or `backend/app/analytics/` out; blockers §7; Rapport cache moves to Valkey |
| « Today » per user (pharmacies in Spain / France) | browser sends `X-Timezone`; `app/core/utils.py today()` uses it (Casablanca today). Only near midnight: Péremptions, default ABCD window, trend last point |
| « Ma boutique en ligne » | hidden; add its E2E specs the day it is shown (allowlisted in `99-gates.spec.ts`) |

