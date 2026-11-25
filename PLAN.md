# PharmaGest — the plan (everything left, in order)

Updated 2026-11-12. One list, top to bottom. Open items only: a step leaves this file when
`make tests` is green. Rules: `.claude/CLAUDE.md`. App + setup: `README.md`.

**Now (2026-11-13): split into services** — plan `.claude/plans/microservices.md`, progress `.claude/HANDOFF.md` §2.

**Order:** §3 production tools (DO console, yours) → §8 Later.

---

## 0. How a step works

| Rule | Why / example |
|---|---|
| One step → `make tests` green → step removed from this file | the oracle (`resources/tests/oracle.py`) pins every number |
| The oracle changes only for a bug fix listed here, in the same step | a refactor never moves a number silently |
| API path / shape changes only when this plan says so (frontend + E2E in the same step) | coverage gate `99-gates.spec.ts` |
| Online store (`backend/app/store_website/`, `frontend/src/pages/store/*`): built (Support queue + editor, owner page, download + deploy) | E2E `09-boutique`, `27-support` |

---

## 1. Frontend by role + clean code (2026-11-24)

Detail: `.claude/plans/frontend-by-role.md`

```
1.1 folders ✓   →   1.2 routes ✓   →   1.3 no abstractions ✓   →   1.4 store models ✓   →   1.5 tests (last) → commit + push
```

```
src/
├── pages/
│   ├── owner/      owner-only pages (sobrus, equipe, historique, ma-boutique)
│   ├── support/    Support-only pages (boutiques, boutique, editeur)
│   └── common/     home · login · sign-up · compte · 404 · store preview
├── _components/
│   ├── pages/      page bodies shared by 2+ roles (Ventes, Catalogue…)
│   └── atoms · molecules · organisms · templates
├── routes.ts       ROLE_ROUTES: public · guest · signedIn · admin · support · owner · employee (full paths)
└── storefront/     ui/ = the 4 store pages (one design system) · templates/<model>/ = look + hero · kit/ = the downloaded site
```

| Role | Prefix | Example |
|---|---|---|
| admin | `/admin/…` | `/admin/catalogue` |
| support | `/support/…` | `/support/catalogue`, `/support/boutiques` |
| owner | `/owner/…` | `/owner/ventes`, `/owner/ma-boutique` |
| employee | `/employee/…` | `/employee/ventes` |
| common | none | `/login`, `/compte` |

| Remove | Use |
|---|---|
| `STAFF`, `isStaff`, `STAFF_ROLES`, `is_staff` | `ROLES.ADMIN` · `ROLES.SUPPORT` · `ROLES.OWNER` · `ROLES.EMPLOYEE` |

**Review the whole codebase: remove over-complication** (asked 2026-11-24)

| Look for | Do |
|---|---|
| helpers that only rename / group / re-export | write the plain value |
| layers between a page and its data / route | read the source directly |
| unused files, exports, i18n keys, endpoints | delete |

---

## 2. Sobrus tickets → stock abîmé → Promis → Commandes (planned 2026-11-24)

Full plan + every decision: `.claude/plans/commandes-promis.md`.

```
A. Sobrus (products .xlsx, suppliers, avoirs by date) ✓  →  B. stock abîmé ✓  →  C. Promis  →  D. Commandes 01–12 + AI document reader  →  F. UI review of the whole app (« ⋮ » + plain pop-ups, approved 2026-11-25)  →  E. tests
```

---

## 3. Production tools (DigitalOcean)

Production = 3 parts on DigitalOcean: **backend** app, **frontend** app, **managed Postgres 17**.

| When | Tool | What it gives | Watch out |
|---|---|---|---|
| Now (DO console) | Frontend as an App Platform **static site** (build `npm run build`, output `dist`, catch-all → `index.html`) | served from DO's CDN; hashed assets cached 1 year, `index.html` never cached | needs S2 for small chunks |
| Later (decision 2026-10-04), before any row below | `pg_stat_statements`: `CREATE EXTENSION pg_stat_statements;` on the managed DB (DO console, once) | list of the slowest real queries in production | read-only, no app change; the rows below depend on its numbers |
| Later | **S6 daily pre-aggregates**: table `daily_sales(pharmacy_id, date, medicament_id, qty, ca)` refreshed after each import / undo; Rapport trend + Analyses mois / année read it | ~365 rows per product-year instead of every sale line | only if `pg_stat_statements` shows `/stats` / analyse slow: today 248 ms / 88 ms at 100k rows, and a 2nd copy of the sales must stay right after every import, undo, catalogue change |
| Later | Rapport server cache keyed by a data version (bumped on import, exclusion, catalogue change) | repeat visits only; first view after an import stays the same | add only if `/stats` is still a problem in production (`pg_stat_statements`) |
| Later | **Valkey** (DO Managed Caching; open-source Redis fork) | shared Rapport cache + shared rate limit (B3) (jobs: Postgres queue, done) | one more paid DO part |
| Later | Big file imports + Excel exports as jobs | same pattern as the Sobrus robot: Postgres queue + the DO « Worker » component (no RQ / Valkey needed); the page polls the status (B4) | no new DO part |
| Later | **PgBouncer** (DO connection pools) | many workers without hitting the DB connection limit | needed before one more backend instance or worker: today API 2 processes × (4 + 4) + worker 2 + 1 + its LISTEN = 20 of the 22 connections |
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
| « Étiquette » (`labels`) · « Commander » (`orders`) | premium switches + « Fonction Premium » window exist; what each screen does = your decisions first |
| « Ma boutique en ligne » | hidden; add its E2E specs the day it is shown (allowlisted in `99-gates.spec.ts`) |

