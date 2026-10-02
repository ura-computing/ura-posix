# PharmaGest — the plan (everything left, in order)

Updated 2026-10-02. One list, top to bottom. Open items only: a step leaves this file when
`make e2e-tests` is green. Rules: `CLAUDE.md`. App + setup: `README.md`.

**Budget order (2026-10-02):** §2 speed → §3 production tools → §5 frontend → §6 backend folders
if budget is left; §4 (E2E every page) next budget.

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

## 4. E2E: every page, every control, through the UI

**E2E1 — still checked through the API only → needs a UI step**

| Check | Today | UI step |
|---|---|---|
| Product suggestions after exclusion | `10-exclusions:74` | type the product in « Exclure des produits » → no suggestion |
| BL search by reference after exclusion | `10-exclusions:110` | type the ref in « Exclure un BL » → « déjà exclu » |
| Supplier search « grossiste », then after exclusion | `10-exclusions:139-140` | type in « Exclure un fournisseur » → list, then « déjà exclu » |
| Comptabilité with special products, Mixte | `10-exclusions:172` | tick the box + Mixte on the page |
| Numbers back after réintégrer / after undoing imports | `10-exclusions:212`, `15-imports:107-108` | open Comptabilité / Rapport / Achats |
| Employee can't manage the team | `12-equipe:135` (403) | employee opens /owner/employees → 404 in the layout (keep the 403 as extra) |
| Reset link used twice / old password | `13-compte:136-137` | open the link again → invalid-link page; old password → error toast |
| Admin system tiles after user changes | `14-admin:89` | Rapport admin « Vue système » tile |
| Admin drill-down margin alerts + stock summary | `14-admin:73-74` | no page calls these 2 routes (G8): **your call** (Q2) |

Kept: `01:10` /health (Docker only), `01:26,44`, `12:132`, `13:55,102` (extra check after a UI step);
`10:38-43`, `14:308` (cleanup); `12:113`, `13:36`, `14:197-200` (setup).

**E2E2 — page by page** (one page per run; for each: list every button, input, tab, filter, chip,
sort, pagination, dialog, export file and value shown; test each against the oracle).

| Order | Page | Known gaps |
|---|---|---|
| 1 | /stock | class circles A–D → table, status filter, sort, pagination, péremption card → dialog, Excel |
| 2 | /alertes | alert card → detail dialog (sort, Excel — FE7 header bug) |
| 3 | /comptabilité | Excel, payment dialog fields |
| 4 | /rapport | every tile + chart value on screen, CTA, admin view |
| 5 | /ventes, /achats | values shown per column, gauges, chips, reset |
| 6 | /produits-spéciaux | 3 tabs, table filters, dialogs (with E2E1 rows) |
| 7 | /imports + /upload-file | wrong file name / type, empty file, closing the error (FE5 bug), history actions |
| 8 | /équipe, /mon-compte | every dialog / tab / button |
| 9 | admin pages | pharmacies, users tab, catalogue (filters, sort, pagination), catégories |
| 10 | login / password pages, layout | FR ⇄ ES on every page, theme, sidebar collapse, 401 → « Session expirée » dialog |

---

## 5. Frontend consistency

| # | Step | Today | After |
|---|---|---|---|
| FE3b | **One members table** | admin detail + team = 2 tables | `MembersTable` used by both (product rule: same behavior) |
| FE3c | **Shared form / gauge / exclude pieces** | inline Field/Input ×4 (`_components/CreateUserDialog.tsx:400`, `admin/categories/index.tsx:169`, `admin/pharmacies/_components/PharmacyFormDialog.tsx:127`, `accounting/comptabilite/index.tsx:355`); gauge tiles ×2 (achats, ventes); BL / supplier exclude dialogs ×2 | `FormField`, `GaugeTiles`, `TwoStepExcludeDialog` |
| FE4 | **One formatter set** | own `num/mad/fmtMad/fmtPct` (`dashboard/rapport/index.tsx:150,154,252,257`); 15 `toLocaleString` / `toFixed` outside `utils/format.tsx` | only `utils/format.tsx` |
| FE5 | **One hook pattern** | 2 `useMarginAlerts` (`analytics/hooks.ts:193`, `dashboard/rapport/hooks.ts:24`); achats / ventes / catalogue copy the filter state | one hook per query; one `useListFilters`. Date range shared on rapport / achats / ventes / alertes / comptabilité; /stock and /analyses keep their own |
| FE6 | **Same search everywhere** | produits-spéciaux tables filter with a local `norm()` (no `*` grammar) | `matchesFields` |
| FE7 | **i18n gaps** (toasts done) | hardcoded French labels: upload preview / stepper / type cards / filename error, stock statuses, comptabilité payment dialog + ledger headers, produits-spéciaux dialogs, AsyncButton / ConfirmDialog / KebabMenu / PasswordField defaults, AuthLayout brand panel, rapport admin strip + donut | keys in `fr.ts` + `es.ts` |
| FE8 | **404 in the layout for roles too** | `RequireRole` redirects to `/` (`_components/RequireRole.tsx:23`) | same in-layout 404 as `RequireFeature` |
| FE9 | **One page shell** | widths 920 / 1100 / 1320 / `max-w-3xl` + extra padding over the layout's `p-7` | `PageHeader` + one container |
| FE10 | **Dead code** | `ROUTES.RAPPORTS`, `STATUSES` (revoked/pending/rejected), admin margin-alerts / stock-summary hooks (with G8) | removed |

**Bugs fixed in these steps**

| Bug | Example | Step |
|---|---|---|
| Alert Excel headers are i18n keys | header « col.produit » (`analytics/_components/AlertDetailDialog.tsx:157`) | FE7 |
| Achats tile says « unités » | shows `achats_count` = number of lines (`dashboard/rapport/index.tsx:821`) | FE7 |
| Admin marge table: PPV column = avg purchase price + G7 | `mad(r["prix_avg"])` (`dashboard/rapport/index.tsx:170`); reads `ventes_total`, `supplier` | FE4 |
| Upload error can't be closed | `onClearError={() => {}}` (`imports/upload/index.tsx:733`) | FE5 |

**Tooling**

| Today | After |
|---|---|
| `make cli` → `python -m cli`: no `backend/cli` | target removed |
| `make test` + `scripts/pre-push.sh` run the old pytest suite (broken: it imports merged files) | old pytest suite, `make test`, `make install-hooks`, `scripts/pre-push.sh` removed |
| Fresh DB (`create_all` + stamp) has no CHECK on feature / permission; migrated DB has it (0009, 0016) | same CHECK in `models.py` |
| `docker-compose.yml` `db16` service (one-time Postgres 16 → 17 copy) | removed once no old volume is left |

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
| G1 | Import de-dup key = (BL, product) (`routers/imports.py`) | BL-123 has DOLIPRANE lot A ×10 and lot B ×5 → the second line is skipped → 10 stored instead of 15 |
| G2 | Analyse row CA = `Vente.total`, KPI CA = `qty × PPV` (`analyse_queries.py`) | 10 × 20 DH with a 10 % discount → row shows 180, KPI shows 200 |
| G3 | Supplier axes join sales once per supplier (`analyse_queries.py`) | product X bought from GROSSISTE A and LABO B, 100 sold → counted 100 in both rows |
| G4 | Liste mode loads the **whole** catalogue and loops on substrings (`compute_analyse_liste`) | a 200-item list × a 30k-product catalogue ≈ 6M comparisons per request |
| G7 | Admin Rapport « Analyse de marge » table reads fields the API doesn't send | reads `ventes_total`, `supplier`; API sends `ca`, `grossiste` → « — » shown. E2E: `test.fail` in `14-admin.spec.ts` (fixed in FE4) |
| G8 | 2 routes no page calls (`routers/stats.py`) | `/admin/pharmacy/{id}/stats/margin-alerts` and `/stock-summary` (Q2) |

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

| What | Notes |
|---|---|
| Microservices: ingestion + analytics | each = move one §6 folder out; blockers §7; Rapport cache moves to Valkey |
| « Ma boutique en ligne » | hidden; add its E2E specs the day it is shown (allowlisted in `99-gates.spec.ts`) |

---

## 9. Open questions (your call)

| # | Question | Example |
|---|---|---|
| Q1 | Average PU: some places skip purchase lines with no price or qty ≤ 0 (ventes ledger, stock, top categories, analyse produit), others keep them (Rapport marge, margin alerts, analyse catégorie). Same filter everywhere? Locked formula | qty 5, PU empty kept → Σqty 15 instead of 10 → avg PU lower. Test data has no such line today |
| Q2 | Admin drill-down margin alerts + stock summary (G8): show them in the drill-down, or delete the 2 routes? | `GET /admin/pharmacy/{id}/stats/margin-alerts` |
| Q3 | Rapport first load without dates = whole history. Keep, or default to the last 12 months? | /stats on the whole history ≈ 0.2 s now (S5) |
