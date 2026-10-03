# PharmaGest — the plan (everything left, in order)

Updated 2026-10-03. One list, top to bottom. Open items only: a step leaves this file when
`make e2e-tests` is green. Rules: `CLAUDE.md`. App + setup: `README.md`.

**Order:** §1 run → §5 frontend → §2 speed → §3 production tools → §6 backend folders.
(§4 « E2E every page » done: rows in §1 until green.)

---

## 0. How a step works

| Rule | Why / example |
|---|---|
| One step → `make e2e-tests` green → step removed from this file | the oracle (`resources/tests/oracle.py`) pins every number |
| The oracle changes only for a bug fix listed here, in the same step | a refactor never moves a number silently |
| API path / shape changes only when this plan says so (frontend + E2E in the same step) | coverage gate `99-gates.spec.ts` |
| Hidden store website (`routers/store_website.py`, `pages/store/*`): moved as-is, never rewritten | hidden, must not break |

---

## 1. Waiting for your run

| What | Where |
|---|---|
| /équipe: same email invited twice → refused (`emailTaken`), team unchanged | `12-equipe` |
| /mon-compte: profile form errors; password form errors + wrong current one (400, no « Session expirée »); « Se déconnecter » on this session; reset link opened twice → « Lien expiré »; old password → error toast (was API only) | `13-compte` |
| Admin: users / catalogue tiles of « Vue système » after each user change (was API only); users tab « Avec pharmacie » + search; catalogue sort Produit ↓ + next page; ES switch through the header button | `14-admin` |
| Layout (new): FR ⇄ ES on every owner page + 404, kept after reload; theme Sombre / Clair / Système; sidebar Réduire / Étendre (kept); 401 → « Session expirée » → Plus tard / Actualiser → login, refused login in ES | `16-layout` |

---

## 2. Speed (now, not at the microservice split)

Measured at 100 000 rows (2026-10-02): `FLOW ventes/export` 13.3 s (backend 11.9 s),
`FLOW achats/export` 4.3 s, `FLOW rapport/first-load` 1.0 s. Right after an import, Rapport calls take
39 s (`/stats`) and 16 s (margin alerts); the same calls take 0.2–0.5 s once Postgres has table
statistics. Cause: fresh tables have no statistics until autoanalyze (~1 min later) → bad query plans.

| # | Step | Example |
|---|---|---|
| S6 | **Daily pre-aggregates.** Table `daily_sales(pharmacy_id, date, medicament_id, qty, ca)` refreshed after each import (only the touched dates); Rapport trend, Analyses mois / année read it instead of every sale line | 100k lines → ~365 rows per product-year |

---

## 3. Production tools (DigitalOcean)

Production = 3 parts on DigitalOcean: **backend** app, **frontend** app, **managed Postgres 17**.

| When | Tool | What it gives | Watch out |
|---|---|---|---|
| Now (DO console, once) | `pg_stat_statements`: `CREATE EXTENSION pg_stat_statements;` on the managed DB | list of the slowest real queries in production | read-only, no app change |
| Now (DO console) | Frontend as an App Platform **static site** (build `npm run build`, output `dist`, catch-all → `index.html`) | served from DO's CDN; hashed assets cached 1 year, `index.html` never cached | needs S2 for small chunks |
| Later | Rapport server cache keyed by a data version (bumped on import, exclusion, catalogue change) | repeat visits only; first view after an import stays the same | add only if `/stats` is still a problem in production (`pg_stat_statements`) |
| Later | **Valkey** (DO Managed Caching; open-source Redis fork) | shared Rapport cache + shared rate limit (B3) + job queue for all workers | one more paid DO part |
| Later | **RQ worker** (Python job queue on Valkey) | imports / exports run off the request path (B4); the page polls the status | one more DO component |
| Later | **PgBouncer** (DO connection pools) | many workers without hitting the DB connection limit | needed once workers × instances × 30 > DB limit |
| Later | Read replica (DO managed Postgres) | Rapport / Analyses read from it, imports write to the primary | only if DB CPU is high (see `pg_stat_statements`) |
| Later | **SigNoz** (open source, decision 2026-10-02) | errors with stack traces, slow requests, logs, metrics in one place | self-hosted on a DO Droplet (≥ 4 GB RAM, Docker Compose). App sends OpenTelemetry (`opentelemetry-instrumentation-fastapi`, `-sqlalchemy`); same code works with Grafana (Tempo / Loki / Prometheus) |

---

## 5. Frontend consistency

| # | Step | Today | After |
|---|---|---|---|
| FE12 | **One `API` object: urls + query keys + what each write refreshes** (decision 2026-10-03; after the E2E pages) | `URLS` + `QUERIES` in 2 files; each hook lists its own `invalidateQueries` → easy to forget one (product suggestions bug) | `API.specialProducts.list = { url, key }`, `API.specialProducts.exclude = { url, refreshes: [...] }`; entries named by action (same url, GET vs POST = 2 entries); `changedByImport` moves in; a test checks every key has an url |
| FE3b | **One members table** | admin detail + team = 2 tables | `MembersTable` used by both (product rule: same behavior) |
| FE3c | **Shared form / gauge / exclude pieces** | inline Field/Input ×4 (`_components/CreateUserDialog.tsx:400`, `admin/categories/index.tsx:169`, `admin/pharmacies/_components/PharmacyFormDialog.tsx:127`, `accounting/comptabilite/index.tsx:355`); gauge tiles ×2 (achats, ventes); BL / supplier exclude dialogs ×2 | `FormField`, `GaugeTiles`, `TwoStepExcludeDialog` |
| FE4 | **One formatter set** | own `num/mad/fmtMad/fmtPct` (`dashboard/rapport/index.tsx:150,154,252,257`); 15 `toLocaleString` / `toFixed` outside `utils/format.tsx` | only `utils/format.tsx` |
| FE5 | **One hook pattern** | 2 `useMarginAlerts` (`analytics/hooks.ts:193`, `dashboard/rapport/hooks.ts:24`); achats / ventes / catalogue copy the filter state | one hook per query; one `useListFilters`. Date range shared on rapport / achats / ventes / alertes / comptabilité; /stock and /analyses keep their own |
| FE6 | **Same search everywhere** | produits-spéciaux tables filter with a local `norm()` (no `*` grammar) | `matchesFields` |
| FE9 | **One page shell** | widths 920 / 1100 / 1320 / `max-w-3xl` + extra padding over the layout's `p-7` | `PageHeader` + one container |

**Bugs fixed in these steps**

| Bug | Example | Step |
|---|---|---|

**Tooling**

| Today | After |
|---|---|

---

## 6. Backend: one folder per domain (moves only)

Like frontend `pages/<feature>/`: one folder per domain → `router.py` + `schemas.py` + its logic
file(s); subfolders fine when cleaner (`stats/queries/`). Moves + import paths only: same URLs
(OpenAPI diff = empty), E2E green after each domain, one domain per step.

| Folder | Gets |
|---|---|
| `core/` | `config`, `database`, `main`, `bootstrap`, `seed`, `models` (one Base, one Alembic chain), `errors`, `security`, `permissions`, `rate_limit`, `search`, `utils`, `email_service`, router `health`; `Pagination` + text helpers |
| `auth/` | routers + schemas `auth` (login, me, password, sessions) |
| `members/` | routers `admin_pharmacies` + `owner_employees` (one `router.py`), schemas `members`, `members.py` → `service.py` |
| `catalog/` | routers + schemas `catalog` |
| `imports/` | routers + schemas `imports`, Sobrus parsing from `csv_parse` |
| `ledger/` | routers + schemas `transactions` |
| `stats/` | routers + schemas `stats`, `stats_queries`, `analyse_queries`, `stock_queries`, `query_parts` (+ Rapport cache, S6 pre-aggregates) |
| `exclusions/` | routers + schemas `exclusions`, `exclusions.py` → `service.py` |
| `accounting/` | routers + schemas `accounting` |
| `store_website/` | routers + schemas `store_website` |

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
| Microservices: ingestion + analytics | each = move one §6 folder out; blockers §7; Rapport cache moves to Valkey |
| « Ma boutique en ligne » | hidden; add its E2E specs the day it is shown (allowlisted in `99-gates.spec.ts`) |

---

## 9. Open questions (your call)

| # | Question | Example |
|---|---|---|
| Q1 | Average PU: some places skip purchase lines with no price or qty ≤ 0 (ventes ledger, stock, top categories, analyse produit), others keep them (Rapport marge, margin alerts, analyse catégorie). Same filter everywhere? Locked formula | qty 5, PU empty kept → Σqty 15 instead of 10 → avg PU lower. Test data has no such line today |
