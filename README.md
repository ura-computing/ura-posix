# PharmaGest

Web dashboard for Moroccan pharmacies: import Sobrus CSV exports, get reports, margins, stock alerts
and accounting views. Backend FastAPI + Postgres 17, frontend React + Vite + Tailwind.

| File | What |
|---|---|
| `README.md` | this file: the product, repo map, how to run, backend, frontend, formulas, tests, deploy |
| `CLAUDE.md` | rules every agent follows (talk, commands, git, accuracy, product rules, must-knows) |
| `PLAN.md` | everything left to do, open bugs, open questions |

If this file and the code disagree, **the code wins** — then fix this file.

## Contents
1. [The product](#1-the-product)
2. [Repository map](#2-repository-map)
3. [Run it locally](#3-run-it-locally)
4. [Backend](#4-backend)
5. [Frontend](#5-frontend)
6. [Domain rules and locked formulas](#6-domain-rules-and-locked-formulas)
7. [Tests — the Playwright E2E suite](#7-tests--the-playwright-e2e-suite)
8. [Deployment (DigitalOcean)](#8-deployment-digitalocean)
9. [How-to checklists](#9-how-to-checklists)

---

## 1. The product

**PharmaGest** is a web dashboard for **Moroccan pharmacies**. Pharmacists export their data from
**Sobrus** (their pharmacy software) as CSV files, import them here, and get reports, margins, stock
alerts and accounting views. The client is a pharmacy group; users are **not tech-savvy** — every UX
decision favors the simplest path.

**UI languages:** French (default) ⇄ Spanish. No English in the UI. Users are French and Spanish: every message comes from `fr.ts` + `es.ts`, server errors included (backend `code` → `errors.<code>`, `backend/errors.py`).

### Roles (`User.role`)
| Role | Who | Sees |
|---|---|---|
| `admin` | Platform staff | Everything. Manages pharmacies, users, catalogue, category suffixes. Uses `/v1/admin/*` routes; pharmacy pages are blocked for admins. |
| `owner` | Pharmacy owner | Their pharmacy's data. Manages their employees ("Gérer mon équipe"). A pharmacy can have several owners. |
| `employee` | Pharmacy staff | Their pharmacy's data, limited by the owner. |
| `developer` | APCM developer | Only the hidden "Ma boutique en ligne" feature (`PLAN.md` §8). |

### Features (permission keys, `ALLOWED_FEATURES` in `backend/models.py`)
`rapports`, `import`, `achats`, `ventes`, `stock`, `analyse`, `accounting`, `alertes`,
`special_products`. Effective access = 3 layers (see §4.4).

### Pages (French names the client uses)
| Route | Page | Feature |
|---|---|---|
| `/rapport` | Tableau de bord (KPIs, trend, categories, margin alerts, TVA, stock tiles) | `rapports` |
| `/achats` | Purchases ledger (bons de livraison) | `achats` |
| `/ventes` | Sales ledger + "à surveiller" tabs | `ventes` |
| `/stock` | ABCD rotation analysis + péremptions (expiry) | `stock` |
| `/analyses` | Analyse de marge: 8 modes (produit, catégorie, laboratoire, grossistes, client, mois, année, liste) | `analyse` |
| `/alertes` | Margin alerts, ventes sans achat, stock + expiry alerts | `alertes` |
| `/comptabilite` | Accounting KPIs (exclusions applied), payment methods per month, sales journal | `accounting` |
| `/produits-speciaux` | Exclude products / BLs / suppliers from Comptabilité | `special_products` |
| `/upload-file`, `/imports` | CSV import wizard, import history (cancel / delete) | `import` |
| `/owner/employees` | Gérer mon équipe (owner only) | role `owner` |
| `/admin/pharmacies` | « Pharmacies et utilisateurs »: tab Pharmacies + tab Utilisateurs (every account) | role `admin` |
| `/admin/pharmacies/:id` | One pharmacy: info, features, members | role `admin` |
| `/admin/catalogue` | Global medicament catalogue (CRUD + CSV import) | role `admin` |
| `/admin/categories` | Category → reference suffix mapping | role `admin` |
| `/auth/me` | Mon compte: profile, password, sessions | any logged-in user |
| `/login`, `/auth/forgot-password`, `/auth/set-password` | Auth (guests only) | — |

### Glossary (French domain words used in code and UI)
| Term | Meaning |
|---|---|
| Achat | A purchase line (one product on a delivery note) — table `achats` |
| Vente | A sale line (one product on a ticket) — table `ventes` |
| BL (bon de livraison) | Delivery note; `Achat.delivery_ref` |
| Fournisseur / grossiste / laboratoire | Supplier / wholesaler / direct lab (§6) |
| Remise | Discount (percent) |
| PPH | Catalogue purchase price before discount (`Medicament.pph`) |
| PU | Real unit purchase price after discount (`Achat.unit_price`) |
| PPV | Public selling price (`Medicament.ppv`) |
| CA (chiffre d'affaires) | Sales revenue |
| TVA | VAT (0 %, 7 %, 20 % in the data) |
| Marge | Margin (§6) |
| Péremption | Expiry date |
| Produits spéciaux | Products the owner excludes from accounting |
| Pharmacie / Parapharmacie | Medicine vs. non-medicine products (`pharma_expr()`, §6) |
| Mixte | "All" (both types) |

---

## 2. Repository map

```
apcm-pharma/
├── README.md               this file: the app, how to run, test, deploy
├── CLAUDE.md               rules for every agent (and humans)
├── PLAN.md                 everything left to do, open bugs, open questions
├── TODO.md                 owner's personal notes — ignore
├── Makefile                every command (make help)
├── docker-compose.yml      db (Postgres 17) + backend + frontend (demo); db16 = one-time 16→17 copy
├── env/demo/docker.env     demo env, copied to .env by make db / make demo
├── scripts/
│   ├── install-hooks.sh    installs .git/hooks/pre-push
│   ├── pre-push.sh         pre-push hook (still runs the old pytest suite — `PLAN.md` §5)
│   └── pg16-to-17.sh       one-time copy of an old Postgres 16 volume into 17
├── resources/
│   ├── catalog.csv         real Sobrus catalogue sample (~16k products) used by seed
│   └── tests/              E2E data generator + oracle (§7)
├── e2e/                    Playwright E2E suite — the only test suite going forward (§7)
├── backend/                FastAPI app (§4)
│   ├── main.py             app + CORS + rate limiter + router mounting
│   ├── config.py           env settings (pydantic-settings)
│   ├── database.py         engine (pool 10+20), SessionLocal, Base, DbDep
│   ├── models.py           every ORM table + ALLOWED_FEATURES + PAYMENT_METHODS
│   ├── security.py         bcrypt, JWT, cookies, get_current_user / CurrentUserDep
│   ├── permissions.py      3-layer effective permissions + require_* guards
│   ├── rate_limit.py       slowapi limiter (RATE_LIMIT=0 disables — E2E only)
│   ├── members.py          owner/employee lifecycle shared by admin + owner routers
│   ├── exclusions.py       comptabilité exclusion filters
│   ├── search.py           tokenized search with `*` wildcard
│   ├── csv_parse.py        Sobrus CSV parsing, name de-dup, filename regexes
│   ├── stats_queries.py    Rapport / Comptabilité KPIs, trend, margin alerts, stock summary
│   ├── analyse_queries.py  /analyses 8 modes + liste matching
│   ├── stock_queries.py    ABCD classification + péremptions
│   ├── email_service.py    SMTP magic links (stdout when MAIL_USERNAME is empty)
│   ├── utils.py            token helpers, user-agent parsing
│   ├── bootstrap.py        extensions + immutable_unaccent() + self-check + migrate/stamp
│   ├── seed.py / seed.json demo accounts + pharmacy + catalogue
│   ├── entrypoint.sh       container boot: wait DB → bootstrap → seed if no admin → uvicorn
│   ├── Dockerfile          python 3.12-slim + uv
│   ├── routers/            HTTP endpoints, one file per domain (§4.5)
│   ├── schemas/            Pydantic request/response models, one file per domain
│   ├── alembic/versions/   migrations 0001 → 0019 (head)
│   ├── migrations/legacy_to_refactoring.py   one-off upgrade of the old production DB
│   ├── conftest.py + tests/  OLD pytest suite (being removed)
│   └── .env.example        every backend env var, documented
└── frontend/               React app (§5)
    ├── vite.config.ts      React Compiler, Tailwind, `@` alias, /v1 dev proxy
    ├── Dockerfile          build with VITE_BACKEND_URL, serve dist on :4173
    ├── .env.example        VITE_BACKEND_URL
    └── src/
        ├── main.tsx        providers: Query, I18n, Upload, GlobalDateRange, Router, Toaster
        ├── App.tsx         routes + guards
        ├── api/            client.ts (api.get/post/…), urls.ts (every /v1 path), queries.ts (every query key), errors.ts (ErrorCode)
        ├── _components/    FLAT, shared by several features: AppLayout (+ Sidebar, Header, nav
        │                   config inside), Require* guards, DataTable, filterBar, ConfirmDialog,
        │                   KpiTile, TabBar, member dialogs, dialog / button primitives, …
        ├── hooks/          app-wide only: useMe, useLogout, useGlobalDateRange, UploadContext
        ├── pages/          grouped by feature, one folder per route (URLs unchanged):
        │   ├── auth/         login, forgot-password, set-password, me, home, not-found (+ _components/AuthLayout)
        │   ├── dashboard/    rapport (index picks AdminView / OwnerView by role)
        │   ├── operations/   achats, ventes
        │   ├── analytics/    analyses, alertes, stock (+ shared hooks.ts, constants.ts, _components/AlertDetailDialog)
        │   ├── accounting/   comptabilite, produits-speciaux
        │   ├── imports/      upload (/upload-file), history (/imports)
        │   ├── team/         /owner/employees
        │   ├── admin/        pharmacies (+ detail/), catalogue, categories, developers (hidden)
        │   └── store/        hidden « Ma boutique » pages: store-website, dev, preview
        ├── i18n/           I18nProvider (useT), config, locales/fr.ts + es.ts
        ├── types/          index.ts (ROUTES, ROLES, FEATURES) + one file per domain, same names as backend/schemas/; import from "@/types"
        └── utils/          format.tsx, text.ts, dateRange.ts, csv.ts, table.ts, cn.ts
```

---

## 3. Run it locally

Needs: Docker (for Postgres), `uv` (Python 3.12), Node 20+.

| Step | Command | What it does |
|---|---|---|
| 1 | `make install` | `uv sync` + `npm install`; creates `backend/.env` (random `JWT_SECRET`) and `frontend/.env` if missing |
| 2 | `make db` | starts the **Postgres 17** container (volume `pg17_data`), creates dev DB `apcm` |
| 3 | `make migrate` | runs `backend/bootstrap.py` (extensions, function, self-check, create/stamp or upgrade) |
| 4 | `make seed` | seed accounts + « Pharmacie Demo » + catalogue (idempotent) |
| 5 | `make dev` | backend uvicorn **:8000** (reload) + Vite **:5173** |

Other targets: `make backend`, `make frontend`, `make build` (= `build-backend`: backend
Docker image, + `build-frontend`: `tsc -b && vite build`), `make demo` (full Docker stack: frontend
**:4173**, backend :8000), `make down`, `make logs`, `make clean` (**destroys all DB volumes**),
`make e2e-tests`, `make e2e-ui`, `make install-hooks`.

### Seed accounts (`backend/seed.json`)
| Email | Password | Role |
|---|---|---|
| admin@gmail.com | admin@123 | admin |
| owner@gmail.com | owner@123 | owner of « Pharmacie Demo » (Casablanca, CAS0001, all features) |
| dev@gmail.com | dev@123 | developer |

### Environment variables
**Backend** (`backend/.env`, documented in `backend/.env.example`, read by `config.py`):
| Var | Notes |
|---|---|
| `DATABASE_URL` | `postgresql+psycopg2://…` (dev: `apcm:apcm@localhost:5432/apcm`) |
| `JWT_SECRET` | ≥ 32 chars, not a placeholder — the app refuses to boot otherwise |
| `JWT_ACCESS_EXPIRY_MIN` | default 7 days |
| `COOKIE_SECURE` | `true` in production (HTTPS) |
| `FRONTEND_URL` | exact CORS origin + base of magic links |
| `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM`, `MAIL_SERVER`, `MAIL_PORT`, `MAIL_STARTTLS`, `MAIL_SSL_TLS` | SMTP. Empty `MAIL_USERNAME` → magic links are **printed to stdout** |
| `RATE_LIMIT` | `0` disables login / forgot-password limits — **E2E only** |
| `SEED_CATALOG` | `0` skips the catalogue import in `seed.py` — E2E only |
| `PORT` | container listen port (entrypoint), default 8000 |

**Frontend** (`frontend/.env`): `VITE_BACKEND_URL` (dev `http://localhost:8000`). Empty → same-origin
`/v1`; the Vite dev server proxies `/v1` to it.

### Postgres versions
Local Postgres is 17 (same as production). An old Postgres 16 volume (`postgres_data`) can be copied
once with `bash scripts/pg16-to-17.sh` (uses the `db16` compose service, profile `pg16`).

---

## 4. Backend

FastAPI + SQLAlchemy 2 (sync) + Postgres 17 (`pg_trgm`, `unaccent`) + Alembic + slowapi + uv.
Single process (no workers) — every tenant shares one connection pool.

### 4.1 App wiring (`main.py`)
- CORS: exactly `FRONTEND_URL`, `allow_credentials=True` (cookie auth), headers `Content-Type`,
  `X-Requested-With`.
- Every route is under `/v1`. Mount prefixes: `/v1/auth`, `/v1/sessions`, `/v1/special-products`,
  `/v1/bl-exclusions`, `/v1/supplier-exclusions`; everything else is mounted at `/v1` and declares
  its own path (`/stats…`, `/admin/…`, `/ventes`, …).
- API docs: FastAPI serves `/openapi.json` and `/docs` (not under `/v1`). The E2E coverage gate reads
  `/openapi.json`.

### 4.2 Data model (`models.py`)
| Table | Purpose |
|---|---|
| `pharmacies` | name, city, code (unique, city-derived), address, phone, email, `archived_at` (soft delete) |
| `users` | email (unique), name, phone, `password_hash`, role, status (`active` / `inactive`; legacy rows may hold other values), `pharmacy_id`, `token_version`, `last_login_at`, reset token (hashed) + expiry |
| `sessions` | one row per logged-in device (`refresh_token_hash`, device label, IP, dates) |
| `pharmacy_features` | per-pharmacy feature toggles |
| `user_permissions` | per-user feature toggles |
| `medicaments` | **global** catalogue shared by all pharmacies: `pid` (Sobrus product id, unique), product, tva, pph, ppv, category, zone, barcodes, laboratoire, `product_type` (pharmacie / parapharmacie / NULL = unclassified) |
| `import_batches` | one row per imported file: type, filename, rows inserted/skipped, status (`in_progress` / `success` / `cancelled` / `error`), creator, soft delete |
| `achats` | purchase lines: pharmacy, medicament, batch, `delivery_date` + `delivery_ref` (BL), supplier, quantity, unit_price (PU), total, expiry… |
| `ventes` | sale lines: pharmacy, medicament, batch, `date`, `transaction_ref`, client, quantity, discount (%), unit_price, total |
| `pharmacy_stock` | latest stock snapshot per (pharmacy, medicament), UPSERTed by stock imports |
| `pharmacy_medicament_status` | `declared=False` → product is « spécial » (excluded in Comptabilité) |
| `pharmacy_bl_exclusions` | excluded `delivery_ref`s |
| `pharmacy_supplier_exclusions` | excluded supplier names |
| `payment_entries` | manual monthly totals per payment method (tpe, especes, cheques, virement) |
| `category_suffixes` | global category → reference suffix + color (shown on ventes refs) |
| `store_website_requests`, `store_customizations` | hidden "Ma boutique en ligne" |

⚠️ Dates in `achats` / `ventes` are **VARCHAR ISO strings** (`"2026-01-15"`), not `DATE`.

### 4.3 Auth (`security.py`, `routers/auth.py`)
- Login (`POST /v1/auth/login`) → two **httpOnly cookies**: `access_token` (JWT HS256 with
  `sub`, `tv` = token_version, `sid` = session id, 7-day expiry) and `session_token` (30 days) + a
  `sessions` row.
- Every request (`get_current_user`): JWT valid, user active, `token_version` matches, **session row
  still exists** → killing a session logs that device out immediately.
- Password change / reset / deactivation bump `token_version` (all JWTs die). Change-password keeps the
  current device logged in (new cookies).
- Forgot password: always 200 (no account enumeration), 60-min hashed reset token, magic link
  `FRONTEND_URL/auth/set-password?token=…` (stdout when no SMTP).
- Rate limits (slowapi, in-memory): login **5/min**, forgot-password **3/hour** per IP. `RATE_LIMIT=0`
  turns them off (E2E only).

### 4.4 Permissions (`permissions.py`)
- `effective_permissions(user)`:
  - admin → all features;
  - owner → `pharmacy_features ∩ user_permissions`;
  - employee → that `∩` the **union of active owners'** permissions (no active owner → nothing).
- Guards = FastAPI dependencies in `permissions.py`, declared in the signature (no guard code in
  bodies): `pharmacy_id: Annotated[int, member("ventes")]` (owner **or** employee with the
  feature(s); admins/developers → 403), `MemberDep` (no feature), `OwnerDep` (owner only),
  `user: AdminDep` / `DeveloperDep`, `APIRouter(dependencies=[admin_only])` for admin routers.
  Exception: import history in `routers/imports.py` (admin sees every import → role check in the body).
- Frontend mirrors it: `/auth/me` returns `permissions`; `RequireFeature` shows the in-layout 404;
  the sidebar hides entries.

### 4.5 Routers (`backend/routers/`)
| File | Main routes (all under `/v1`) | Guard |
|---|---|---|
| `health.py` | `GET /health` | none |
| `auth.py` | `POST /auth/login`, `GET/PATCH /auth/me`, `POST /auth/change-password`, `/auth/logout`, `/auth/forgot-password`, `GET /auth/validate-token`, `POST /auth/set-password`; `GET /sessions`, `DELETE /sessions/{id}`, `POST /sessions/revoke-others` | cookie |
| `stats.py` | `GET /stats` (Rapport + Comptabilité), `/stats/margin-alerts`, `/stats/ventes-sans-achat`, `/stats/stock-summary`, `/stats/stock-abcd`, `/stats/peremptions`, `/stats/analyse-marge?mode=…`, `POST /stats/analyse-liste`; admin: `GET /admin/stats` (system tiles), `/admin/pharmacy/{id}/stats`, `…/margin-alerts`, `…/stock-summary`, `…/analyse-marge` | rapports / alertes / stock / analyse; admin |
| `transactions.py` | `GET /ventes`, `/ventes/categories`, `/ventes/tva-rates`, `/ventes/suggestions`, `/ventes/surveillance-counts`, `/ventes/discount-summary`; `GET /achats`, `/achats/categories`, `/achats/tva-rates`, `/achats/suggestions`, `/achats/supplier-summary` | ventes / achats |
| `imports.py` | `POST /uploads/achat-json`, `/uploads/vente-json`, `/uploads/stock-json` (500-row chunks), `PATCH /uploads/batches/{id}` (cancel = undo), `POST /uploads/catalog` (admin, multipart); `GET /data/imports`, `DELETE /data/imports/{id}` (soft delete + removes the rows) | import + type feature |
| `accounting.py` | `GET/POST /accounting/payments` (upsert by month+method), `DELETE /accounting/payments/{id}` | accounting |
| `exclusions.py` | `GET/POST /special-products/`, `POST …/reintegrate`, `GET …/suggestions`; `GET/POST /bl-exclusions/`, `GET …/search`, `GET …/detail`, `POST …/reintegrate`; `GET/POST /supplier-exclusions/`, `GET …/search`, `POST …/reintegrate` | special_products |
| `owner_employees.py` | `GET/POST /owner/employees`, `PUT …/{id}/permissions`, `PATCH …/{id}/status`, `POST …/{id}/reset-password`, `DELETE …/{id}` | owner |
| `admin_pharmacies.py` | pharmacies CRUD (`DELETE` = archive), `PUT …/{id}/features`, `POST …/{id}/users`, `GET /admin/users` (every account), `PATCH /admin/users/{id}/pharmacy`, `…/{id}/permissions`, `…/status`, `…/reset-password`, `DELETE /admin/users/{id}` | admin |
| `catalog.py` | `GET/POST /admin/catalog`, `PUT/DELETE /admin/catalog/{id}`, `GET …/categories`, `GET …/unclassified-count`; `GET/POST /category-suffixes`, `PUT/DELETE /category-suffixes/{id}` | admin |
| `store_website.py` | 14 routes `/store-website/*` (hidden feature) | owner / developer |

Conventions: routes return plain dicts / Pydantic models from `schemas/`; errors are
`ApiError(status, ErrorCode.X, "French detail", **params)` (`errors.py`); every DELETE → empty 204 (except the import delete: `{id, deleted_rows, file_type}`); list endpoints return `{data, pagination, summary?}` with
`pagination = {page, limit, total, total_pages}`; export = same list endpoint with `export=true`
(capped at 50 000 rows → 413).

### 4.6 Computation modules
- `stats_queries.py` — dashboard payload (`build_stats_payload` in `routers/stats.py` composes):
  KPIs, previous-year KPIs, marge (+ `reconcile_marge_to_ca`), TVA, type breakdown, adaptive trend
  (week < 2 months, month < 1 year, semester < 4 years, else year), top categories, margin alerts
  (brackets negative / low / medium / high / very_high), ventes sans achat, stock summary.
- `analyse_queries.py` — `compute_analyse_marge` (7 modes) + `compute_analyse_liste` (match an
  uploaded product list by name / PID).
- `stock_queries.py` — ABCD + coverage status + péremptions (§6).
- `exclusions.py` — `excluded_medicaments_select` (one medicament set) + `vente_filter` /
  `achat_filter`, added only when `include_non_declared=False` (§6).
- `search.py` — `tokenize_search`, `product_search_clauses` (name + pid + barcodes + extra columns),
  `supplier_search_clauses`, Python twin `matches_all_tokens`.

### 4.7 Import pipeline
1. Browser parses the Sobrus CSV (`utils/csv.ts`), validates the filename
   (`Sobrus - Achats|Ventes YYYY-MM-DD - YYYY-MM-DD.csv`, `Sobrus - Stock YYYYMMDD.csv`).
2. `UploadContext` queues files (FIFO, one at a time) and POSTs **500-row chunks** to
   `/uploads/{achat|vente|stock}-json`. Chunk 1 creates the `import_batch`; later chunks pass
   `batch_id`.
3. Backend (`_insert_transactions` / `_insert_stock`): resolves PIDs to `medicaments` in one query
   (new PID but same **normalized name** → merges onto the existing row; otherwise creates it with
   `product_type = NULL`), de-dups on `(delivery_ref | transaction_ref, medicament)`, bulk inserts.
   Stock = `ON CONFLICT` UPSERT per (pharmacy, medicament).
4. Cancel mid-upload → `PATCH /uploads/batches/{id} {status:"cancelled"}` deletes that batch's rows.
   `/imports` → delete → same undo, batch kept as history. Stock can't be undone (UPSERT).
5. Admin catalogue CSV (`Nom,Categorie,TVA,PPV,PPH,Code barre 1,Code barre 2,Laboratoire`, comma):
   upsert by barcode-PID / normalized name; sets `product_type` from the category.

### 4.8 Schema bootstrap and migrations
- `bootstrap.py` (run by `make migrate` and by the container entrypoint):
  1. `CREATE EXTENSION pg_trgm, unaccent`;
  2. `CREATE OR REPLACE FUNCTION immutable_unaccent(text)` =
     `SELECT public.unaccent('public.unaccent'::regdictionary, $1)` (IMMUTABLE, schema-qualified);
  3. self-check under `search_path = pg_catalog, pg_temp`;
  4. fresh DB → `create_all` + `alembic stamp head`; legacy DB (no `alembic_version`) → `create_all`
     + stamp; managed DB → `alembic upgrade head`.
- Alembic head: **0019** (`immutable_unaccent` + expression index `ix_medicaments_normalized_name`,
  built `CONCURRENTLY`).
- A new model column needs **both** the model change and a migration (fresh DBs use `create_all`,
  existing ones use migrations — they must converge on the same schema).
- `seed.py` runs in the container only when no admin exists.

---

## 5. Frontend

React 19 + Vite 8 + TypeScript 6 + TanStack Query 5 + Tailwind 4 + react-router 7 + react-hook-form +
zod + sonner (toasts) + lucide-react + xlsx. **React Compiler on.**

### 5.1 Boot and routing
- `main.tsx`: `QueryClientProvider` (no retry, no refetch on focus) → `I18nProvider` →
  `UploadProvider` → `GlobalDateRangeProvider` → `BrowserRouter` → `App`; plus
  `SessionExpiredDialog` and `Toaster`.
- `App.tsx`: guest routes inside `RequireGuest`; app routes inside `AppLayout` (redirects to `/login`
  when `/auth/me` fails); `RequireFeature feature="…"` (404 inside the layout); `RequireRole`
  (admin / owner pages). Hidden store-website + developer routes are **commented out** (since 2026-07-03).
- Sidebar entries: the nav config at the top of `_components/AppLayout.tsx` (roles + feature per item).
  Header title comes from the same config.

### 5.2 API layer
- `api/client.ts` → `api.get/post/put/patch/delete/upload`: base `${VITE_BACKEND_URL}/v1`, `credentials:
  "include"`, JSON (`upload` = one file, multipart), `ApiErr(status, detail)`: `detail` = `errors.<code>`
  translated (backend `{detail, code, params}`, `errors.py`), else the backend's French `detail`. A 401 mid-session opens `SessionExpiredDialog`. Any other failed query / mutation → error toast
  (`main.tsx`), unless the mutation has its own `onError`.
- `api/urls.ts` → `URLS`: every backend path. Calls are written inline in `hooks.ts`, no wrapper functions:
  `api.delete(URLS.admin.catalog.one(id))`, `api.get<Row[]>(URLS.ventes.list, { params: filters })`.
  `params`: arrays → repeated keys, null / undefined / "" skipped, booleans sent as "true" / "false".
- TanStack keys: every key in `QUERIES` (`api/queries.ts`, grouped like `URLS`: `[group, name, ...args]`), no local keys.
  `QUERIES.ventes.all` = every ventes query, `QUERIES.stats.mainAll` = every filter combo of one query.
  After an import / undo: `invalidateQueries({ predicate: changedByImport(docType) })`. Mutations
  invalidate the keys they affect — keep that when adding one.

### 5.3 Page pattern
`pages/<feature>/<route>/index.tsx` (the page + every piece used only by it, pasted in the same file) +
`hooks.ts` beside it (state, queries, mutations). Placement rules: used by 1 file → paste it into that
file; used by several files of 1 route → `<route>/_components/`; several routes of 1 feature →
`<feature>/_components/` (or `<feature>/hooks.ts`); several features or `App.tsx` → `src/_components/`.
Filters go through the shared `FilterBar` (search with debounce, date range,
segment Mixte/Pharmacie/Parapharmacie, multi/single selects, right actions, active-filter chips). Tables
go through `DataTable` (sortable headers, pagination footer, empty/loading states).

### 5.4 Shared pieces worth knowing
- Member dialogs in `_components/` — `CreateUserDialog` (+ `ResetPasswordDialog`, credentials reveal,
  Gmail button), `UserPermissionsDialog` (N ceiling layers), `MemberKebab`, `FeaturePills`,
  `memberConstants.ts` (feature list, labels, `toFeatureRecord`).
- `_components/`: `ConfirmDialog`, `KebabMenu`, `SingleSelectPopover`, `CategorySegment`, `TabBar`,
  `KpiTile`, `AsyncButton`, `PasswordField`, `Switch` (`role="switch"`). `PhoneField` (E.164, default MA)
  lives in `pages/auth/me/index.tsx`.
- `hooks/UploadContext.tsx` — upload queue; success card auto-dismisses after 4 s; survives
  navigation (progress widget bottom-right).
- `hooks/useGlobalDateRange` — the date range is shared across pages (reset on reload).

### 5.5 i18n
- `i18n/I18nProvider.tsx`: `useT()` → `t("section.key", {var})`; fallback French then the key;
  `{{var}}` interpolation; language stored in `localStorage`.
- `locales/fr.ts` is the source; `es.ts` must have **the same keys** (TypeScript type `Dict` enforces
  it at build time).

### 5.6 Formatting
`utils/format.tsx`: `formatMAD` (French, "MAD"), `formatQty`, `formatPct` (2 decimals + comma),
string variants for SVG/attributes. Never call `toFixed` / `toLocaleString` directly in components.
Exports: `utils/table.ts` (`downloadXlsx`, `exportFilename`).

---

## 6. Domain rules and locked formulas

**Ask before changing any of these.** Most past bugs came from here.

### Prices and margins
- `PU = PPH × (1 − remise)` = `Achat.unit_price` (real purchase price).
- **CA (sales revenue) = Σ qty × coalesce(Medicament.ppv, Vente.unit_price)** on Rapport, Comptabilité
  and Analyses KPIs (Vente.total is used for analyse **rows** — `PLAN.md` G2).
- **Marge % = (1 − PU/PPV) × 100.** Never `PPV − PPH` (PPH often equals PPV → fake 0 %).
- Average PU per product = Σ(PU × qty) / Σ qty over achats **in the selected window** (margin alerts,
  ledger « marge » cells). Top categories use all-time PU.
- Products without a PU in the window are left out of the margin (no PPH fallback, "PG-013").
- Marge nette is HT/HT: grouped by TVA, (ppv − pu) / (1 + TVA).
- `reconcile_marge_to_ca`: `marge_brute_dh = CA × marge_pct / 100`, nette scaled by the same ratio →
  every page shows the same margin.

### Pharmacie vs Parapharmacie (`pharma_expr()` in `stats_queries.py`)
`Medicament.product_type` wins; else category contains « médicament », « homéopathie » or
« diététique » (accents optional) → pharmacie; else parapharmacie.

### Exclusions (Produits spéciaux page)
- Three kinds: product (`declared=False`), BL (`delivery_ref`), supplier (unaccent + lower match).
- Applied **only** in Comptabilité (`include_non_declared=false`). Every other page includes all.
- In Comptabilité the three become **one medicament set** (`excluded_medicaments_select`): every
  product on an excluded BL, and every product of an excluded supplier, drops from **both** ventes and
  achats — like a special product.
- NULL BL refs / NULL suppliers are kept (NOT IN + NULL gotcha).
- Manual payment-method amounts are never excluded.
- API default: `/stats` → `include_non_declared=false` (Comptabilité omits the param); Rapport sends
  `true`. `/ventes`, `/achats` default `true`; Comptabilité's journal sends `false`.

### Analyses axes
- **Grossiste** = `Achat.supplier` whose upper-case name starts with `GROSSISTE`.
- **Laboratoire** = every **other** non-null supplier (not `Medicament.laboratoire`).
- Catégorie mode: one row per label — "Médicament (33.930%)" and "Médicament (30.000%)" are one
  « Médicament » row (the "(xx%)" suffix is stripped). Bare codes like "Médicament (300)" stay separate.

### Stock (`stock_queries.py`)
- MIN = round(sales_12m / 300 × 14), MAX = round(sales_12m / 300 × 15).
- Coverage days = stock × 365 / sales_12m: ≤ 45 sous-stock, ≤ 60 idéal, ≤ 99 à surveiller, else
  sur-stock; `negatif` if stock < 0; `inconnu` without 12-month sales.
- ABCD by units sold in 12 months: ≥ 300 A, ≥ 250 A-, ≥ 200 B+, ≥ 48 B, ≥ 6 C, 1–5 C- (C-N if sold
  only in the last 4 months), 0 D.
- Default window: Jan–Jun → previous calendar year; Jul–Dec → Jul (Y-1) → Jun (Y).
- Rapport stock tiles: sous-stock if stock < MIN, sur-stock if > MAX; « santé » = (in band + sur) /
  classified.
- Péremptions: expired, < 6 months, < 12 months, no date.

### Search (every search bar)
Tokens separated by spaces are ANDed. `med` = contains; `med*` = starts with; `*med` = contains;
`a*b` = within one word (regex). Accent/case-insensitive. Product search also matches PID and barcodes.
Backend `search.py`; frontend twin `utils/text.ts` (`matchesText`, `matchesFields`).

### Imports
Product identity = Sobrus PID; a new PID with an existing **normalized name** (unaccent, lower,
collapsed spaces) merges onto that row. Duplicate `(ref, product)` lines are skipped (`PLAN.md` G1).

---

## 7. Tests — the Playwright E2E suite

**The only test suite going forward.** The old vitest suite is gone; the old pytest suite
(`backend/tests/`) is being removed. The idea: generate huge Sobrus-format files with **known answers**, import them through the
real UI, and compare **every field of every API response** with those answers.

### 7.1 Run
- `make e2e-tests` — headless, every spec. Asks: rows to generate (default 100 000, **min 1 000**),
  "Record a new speed baseline? (y/n)".
- `make e2e-ui` — Playwright UI mode: one window (test list, live view, step through every action;
  nothing pops over your other windows). Asks: rows, test file (`06`, `ventes`, or `all`). The
  setup specs (01, 02) always run first.
- First run installs Playwright + Chromium by itself.

### 7.2 What happens (`e2e/playwright.config.ts`, `e2e/scripts/`)
1. `start-backend.sh`: `resources/tests/generate.py --rows N` → drops/creates DB `apcm_e2e` →
   `bootstrap.py` + `seed.py` with `SEED_CATALOG=0`, `MAIL_USERNAME=""`, `RATE_LIMIT=0` → uvicorn
   **:8001** (log: `e2e/.logs/backend.log`, where magic links land).
2. Vite on **:5174** with `VITE_BACKEND_URL=http://localhost:8001`.
3. One worker, specs in file order; each spec reuses saved logins (`e2e/.state/*.json`).

### 7.3 Test data + oracle (`resources/tests/`)
- `generate.py`: deterministic (seed 42) products `E2E PRODUIT 00000…`, achats (≈ rows/3), ventes,
  stock, a « liste » CSV, 600 extra achats (cancel/delete test), 5 catalogue rows. Files are
  git-ignored and regenerated each run.
- `oracle.py`: re-implements every formula in plain Python (never imports app code) → `expected.json`:
  stats × 3 types, margin alerts, ventes sans achat, stock, ABCD, péremptions, ledgers (rows, summaries,
  sorts, searches, suggestions), analyses (7 modes × 3 types + liste), the exclusions scenario, the
  catalogue expectations.
- It pins **today's** behavior. Where today's behavior breaks a business rule, a separate
  `test.fail` names the bug (it passes while the bug exists).

### 7.4 Specs (`e2e/tests/`)
| Spec | Covers |
|---|---|
| 01-admin-setup | health, admin creates « Pharmacie E2E » + its owner |
| 02-import | owner imports achats, ventes, stock through the wizard; counts + FLOW timings |
| 03-rapport | every /stats field × Mixte / Pharmacie / Parapharmacie, margin alerts, stock tiles |
| 04-alertes | margin alerts, ventes sans achat, péremptions, stock |
| 05-stock | ABCD (default + window), filters, péremptions |
| 06-ventes / 07-achats | list, pagination, tabs, every sort, search + suggestions, filters, export |
| 08-analyses | 7 modes × 3 types, liste CSV, catégorie bug (`test.fail`) |
| 10-exclusions | exclude product / BL / supplier, Comptabilité drops them, reintegrate |
| 11-comptabilite | KPIs, sales journal, payment methods CRUD |
| 12-equipe | owner invites / permissions / resets / deactivates / deletes; employee login, 404, logout |
| 13-compte | profile, sessions, change password, forgot → magic link → set password |
| 14-admin | admin rapport, pharmacies lifecycle, users tab + assign, catégories, catalogue + CSV, 2 `test.fail` bugs |
| 15-imports | import history, cancel mid-upload, delete an import, numbers unchanged |
| 99-gates | report time per route; **coverage gate** (every `/openapi.json` route called; only `/v1/store-website/*` allowlisted); **speed gate** vs `e2e/perf-baseline.json` |

### 7.5 Helpers (`e2e/lib/`)
`fixtures.ts` (auto-records every `/v1` call → `.results/calls.jsonl`), `ui.ts` (`setPeriod`,
`pageCall` = wait for the page's own GET, `pageSend` = its POST/PUT/PATCH/DELETE),
`api.ts` (`apiGet/apiPost/apiDelete` — recorded too), `checks.ts` (one checker per payload),
`diff.ts` (field-by-field compare, `TOL = 0.02`, tie-aware picks), `expected.ts`, `auth.ts`
(accounts, `login`, saved state), `mail.ts` (reads magic links from the backend log), `paths.ts`.

### 7.6 Results and debugging
- Failure → `e2e/test-results/<test>/error-context.md` (error + page snapshot), `trace.zip`, video.
- HTML report: `e2e/report/`. Timings per route: `e2e/.results/slowest.txt`.
- Speed gate: median per route (max per import FLOW) ≤ max(baseline × 1.2, baseline + 50 ms); only
  compared when `rows` equals the baseline's. Answer **y** to record a new baseline after an intended
  change.

---

## 8. Deployment (DigitalOcean)

Production = **3 parts** on DigitalOcean: the **backend** app, the **frontend** app and a
**managed Postgres 17** database. Speed / scaling tools planned for it: `PLAN.md` §3.

| Part | Built from | Notes |
|---|---|---|
| Backend | `backend/Dockerfile` | start = `entrypoint.sh`: wait for DB → `bootstrap.py` (extensions, `immutable_unaccent()` + self-check, `alembic upgrade head`) → `seed.py` only if no admin → `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Frontend | `frontend/Dockerfile` | `VITE_BACKEND_URL` is read at **build time** (`frontend/.env.example`) |
| Database | DO managed Postgres **17** | `DATABASE_URL` of the backend points to it |

- Set every var from `backend/.env.example` on the backend (`COOKIE_SECURE=true`, real `JWT_SECRET`,
  `FRONTEND_URL` = the deployed frontend origin, SMTP). Never set `RATE_LIMIT=0` there.
- The exact DO app spec (domains, sizes) is **not in the repo** — ask the owner.
- A failed migration makes the deploy fail; DigitalOcean normally keeps the previous version running.
- Before pushing a migration: replay it locally on Postgres 17 (`alembic downgrade <prev>` then
  `make migrate`).

---

## 9. How-to checklists

**Add a backend endpoint**
1. Route in the right `routers/*.py`; guard in the signature: `Annotated[int, member("…")]`,
   `OwnerDep`, `AdminDep` / `DeveloperDep` (admin routers already have `dependencies=[admin_only]`).
2. Pydantic shapes in `schemas/<router>.py`. Errors: `raise ApiError(404, ErrorCode.X, "French detail", **params)`
   (`errors.py`). New code → same value in `frontend/src/api/errors.ts` + `errors.<code>` in `fr.ts` and `es.ts`
   (build fails without the text; gate 99 fails if the two enums differ).
3. Heavy SQL → a `*_queries.py` helper (pure function: `(db, filters) → dict`).
4. Frontend: path in `api/urls.ts` + type in `types/<domain>.ts` + inline `api.get/post…` in the page's `hooks.ts`
   with invalidations.
5. E2E: call it from the UI in a spec and check every field against the oracle — the coverage gate
   fails otherwise.

**Add a page**: route in `App.tsx` (+ `RequireFeature` / `RequireRole`), nav entry in
`_components/AppLayout.tsx`, page folder pattern (§5.3), labels in `fr.ts` **and** `es.ts`, a spec.

**Add a translation**: key in `fr.ts`, same key in `es.ts`, use `t("section.key")`.

**Add a DB column**: model + Alembic migration (idempotent, `IF NOT EXISTS`); functions used by
indexes must be schema-qualified; test on Postgres 17.

**Change a formula**: ask the owner first → change the backend → change `resources/tests/oracle.py`
the same way → `make e2e-tests`.

**Before handing work back**: say exactly what changed and why, what was run (or not), and give the one
command to verify.
