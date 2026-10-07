# PharmaGest — the plan (everything left, in order)

Updated 2026-10-07. One list, top to bottom. Open items only: a step leaves this file when
`make tests` is green. Rules: `.claude/CLAUDE.md`. App + setup: `README.md`.

**Order:** §1 Produits module → §3 production tools (DO console, yours) → §8 Later.

---

## 0. How a step works

| Rule | Why / example |
|---|---|
| One step → `make tests` green → step removed from this file | the oracle (`resources/tests/oracle.py`) pins every number |
| The oracle changes only for a bug fix listed here, in the same step | a refactor never moves a number silently |
| API path / shape changes only when this plan says so (frontend + E2E in the same step) | coverage gate `99-gates.spec.ts` |
| Hidden store website (`backend/app/store_website/`, `frontend/src/pages/store/*`): moved as-is, never rewritten | hidden, must not break |

---

## 1. Produits module (PO design: the 2 PNGs in `resources/`)

One feature at a time: backend + frontend + its part of `e2e/tests/18-produits.spec.ts` → review → next.

| # | Feature | State |
|---|---|---|
| F1 | « Produits » list: feature `produits` (migration 0024, ON for everyone), `GET /products`, sidebar, search, Mixte / Pharmacie / Parapharmacie, sort, Excel | done |
| F2 | Photos + description from the scraped catalogue (`product_infos`, migration 0025, loaded at every start, matched by PID then barcode) | done |
| F3 | Fiche produit: Général (données, prix, stock, description, mouvements récents) + Codes | done |
| fix | Deleting / cancelling a stock import removes the stock it wrote (`pharmacy_stock.import_batch_id`, migration 0026); found on real data: a deleted les-joyeux stock stayed in Produits / Stock | done |
| F4 | « Ventes et achats par mois » Tableau ⇄ Graphique (per year: a Ventes row + an Achats row; chart: one color per curve, purchases dashed) + Statistiques tab (`GET /products/{id}/stats`) | done, waiting `make tests` |
| F5 | Mouvements tab (achats + ventes, period / type / search, file of each line, pages, Excel, « Voir tout » from Général; `GET /products/{id}/movements`) | done, waiting `make tests` |
| F6 | Owner edit: « Modifier » / « Enregistrer », his pharmacy only, hand edit wins over imports, « Revenir à la valeur importée »; the type (pharmacie / parapharmacie) is NOT editable (user) (`pharmacy_product_edits`, migration 0027, `PUT /products/{id}`) | done, waiting `make tests` |
| F7 | `README.md` | |

---

## 3. Production tools (DigitalOcean)

Production = 3 parts on DigitalOcean: **backend** app, **frontend** app, **managed Postgres 17**.

| When | Tool | What it gives | Watch out |
|---|---|---|---|
| Now (DO console) | Frontend as an App Platform **static site** (build `npm run build`, output `dist`, catch-all → `index.html`) | served from DO's CDN; hashed assets cached 1 year, `index.html` never cached | needs S2 for small chunks |
| Later (decision 2026-10-04), before any row below | `pg_stat_statements`: `CREATE EXTENSION pg_stat_statements;` on the managed DB (DO console, once) | list of the slowest real queries in production | read-only, no app change; the rows below depend on its numbers |
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

| What | Notes |
|---|---|
| Microservices: ingestion + analytics | each = move `backend/app/ingestion/` or `backend/app/analytics/` out; blockers §7; Rapport cache moves to Valkey |
| « Today » per user (pharmacies in Spain / France) | browser sends `X-Timezone`; `app/core/utils.py today()` uses it (Casablanca today). Only near midnight: Péremptions, default ABCD window, trend last point |
| Currency per pharmacy (decision 2026-10-04: MAD only for now) | the day a pharmacy in Spain / France signs up: `pharmacies.currency` (MAD / EUR), admin picks it, `formatMAD` → `formatMoney`, labels and Excel headers « (MAD) » → « (€) » |
| « Ma boutique en ligne » | hidden; add its E2E specs the day it is shown (allowlisted in `99-gates.spec.ts`) |

