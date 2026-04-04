# PharmaGest -- Gestion avancee de votre Pharmacie

Full-stack pharmacy management dashboard + Chrome extension for Moroccan pharmacies using the **Sobrus** POS system. Imports CSV exports from Sobrus, provides analytics, margin analysis, accounting tools, and stock management with ABCD classification.

---

## Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, Vite, TypeScript, React Router v7, TanStack Query + Table, shadcn/ui, Tailwind CSS 4, Recharts, Zod, react-hook-form |
| **Backend** | FastAPI, SQLAlchemy 2, PostgreSQL 16, Pydantic v2, JWT (python-jose), bcrypt, WhatsApp Cloud API (OTP) |
| **Extension** | Chrome MV3, CRXJS Vite plugin, React 19, TanStack Query, Chrome Storage API |
| **Testing** | pytest (187 tests), vitest (84 frontend + 27 extension) |

---

## Project Structure

```
pharmagest/
├── backend/          FastAPI server
│   ├── main.py           App entry, CORS, router registration
│   ├── models/           SQLAlchemy models (auth, catalog, transactions)
│   ├── schemas/          Pydantic request/response schemas
│   ├── routers/          API routers (auth, admin, owner, uploads, stats, ...)
│   │   └── stats/        Analytics engine (queries, marge, stock, excel)
│   └── utils/            JWT, permissions, email, string helpers
├── frontend/         React dashboard (Vite)
│   ├── api/              Typed API layer (one file per domain)
│   ├── hooks/            TanStack Query/Mutation logic
│   ├── pages/            Route pages
│   ├── components/       UI components (layout, form, data-table, shared, ui)
│   ├── schemas/          Zod validation schemas
│   └── utils/            Formatting, session, CSV export
├── extension/        Chrome extension (CRXJS)
│   ├── background/       Token storage, upload orchestration
│   ├── content/          Auth relay, CSV intercept, upload banner
│   ├── popup/            Auth status + import history panel
│   └── hooks/            Token, notifications, upload status
├── env/              Environment configs
│   ├── dev/              Development (docker.env, backend.env, frontend.env, extension.env)
│   ├── demo/             Demo / Docker (docker.env, backend.env, frontend.env, extension.env)
│   ├── test/             Test suite (backend.env)
│   └── prod/             Production (docker.env, backend.env, frontend.env, extension.env)
├── resources/        Sample CSVs, catalog, screenshots
└── Makefile          All commands
```

---

## Database Design

```
┌──────────────────────┐
│   pharmacies         │
├──────────────────────┤
│ id          (PK)     │◄─────┐
│ name                 │      │
│ address              │      │
│ phone, email         │      │
│ options     (JSON)   │  ← feature toggles (ceiling for users)
│ created_at           │      │
└──────────────────────┘      │
           │ 1:N              │ 1:N
           ▼                  │
┌────────────────────────────┐│
│      users                 ││
├────────────────────────────┤│
│ id          (PK)           ││
│ email       (UQ)           ││
│ password_hash              ││
│ pharmacy_id (FK, nullable) │┘
│ role                       │  ← admin | owner | employee
│ status                     │  ← pending | active | rejected
│ name, phone                │
│ pharmacy_name              │
│ permissions (JSON)         │  ← { rapports, import, achat, ventes, stock }
│ reset_token, reset_token_  │
│   expires                  │  ← password reset (email link or WhatsApp OTP)
│ created_at, updated_at     │
└────────────────────────────┘

┌──────────────────────────────────────┐
│         medicaments                  │  (Catalogue produits)
├──────────────────────────────────────┤
│ id           (PK)                    │
│ pid          (UQ)                    │  ← Sobrus product ID
│ product                              │
│ category                             │  ← e.g. "Medicament"
│ product_type                         │  ← "pharmacie" | "parapharmacie" | null
│ pph, ppv, tva                        │  ← Prix catalogue + TVA
│ laboratoire, zone                    │
│ barcode1, barcode2                   │
└──────────┬───────────────────────────┘
           │ 1:N                1:N
           ▼                    ▼
┌────────────────────────────┐  ┌───────────────────────────────────┐
│          achats            │  │            ventes                 │
│       (Achats)             │  │           (Ventes)                │
├────────────────────────────┤  ├───────────────────────────────────┤
│ id              (PK)       │  │ id              (PK)              │
│ pharmacy_id     (FK)       │  │ pharmacy_id     (FK)              │
│ medicament_id   (FK)       │  │ medicament_id   (FK)              │
│ import_batch_id (FK)       │  │ import_batch_id (FK)              │
│ delivery_date              │  │ date                              │
│ delivery_ref               │  │ transaction_ref                   │
│ supplier                   │  │ client                            │
│ quantity, unit_price       │  │ quantity, unit_price              │
│ expiry_date, total         │  │ discount, total                   │
│ stock_min, stock_max       │  │ uploaded_at                       │
│ uploaded_at                │  └───────────────────────────────────┘
└────────────────────────────┘

┌──────────────────────────────────────┐
│      import_batches                  │  (Suivi des imports CSV)
├──────────────────────────────────────┤
│ id              (PK)                 │
│ pharmacy_id     (FK)                 │
│ file_type                            │  ← "achat" | "vente"
│ filename                             │  ← ex: "Sobrus - Achats 2025-03-29..."
│ rows_inserted, rows_skipped          │
│ imported_at                          │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│      catalog_requests                │  (Demandes d'exclusion/annulation)
├──────────────────────────────────────┤
│ id              (PK)                 │
│ requested_by    (FK → users)         │
│ pharmacy_id     (FK)                 │
│ request_type                         │  ← new_product | non_declare | annulation
│ medicament_id   (FK, nullable)       │
│ status                               │  ← pending | approved | rejected
│ reject_reason, notes                 │
│ product, tva, pph, ppv, ...         │
│ created_at, reviewed_at              │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  pharmacy_medicament_status          │  (Exclusions par pharmacie)
├──────────────────────────────────────┤
│ pharmacy_id + medicament_id (UQ)     │
│ declared (bool)                      │  ← False = exclu des rapports
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│      payment_entries                 │  (Saisie manuelle des paiements)
├──────────────────────────────────────┤
│ id              (PK)                 │
│ pharmacy_id     (FK)                 │
│ month                                │  ← "2026-03"
│ method                               │  ← tpe | especes | cheques | virement
│ pharmacie_amount                     │
│ parapharmacie_amount                 │
│ count                                │
│ created_at, updated_at               │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│      category_suffixes               │  (Suffixes référence BL)
├──────────────────────────────────────┤
│ category (UQ), suffix, color         │
└──────────────────────────────────────┘

Clés de déduplication :
  achats  → (delivery_ref, medicament_id, pharmacy_id)
  ventes  → (transaction_ref, medicament_id, pharmacy_id)
```

---

## Quick Start

### Requirements

- Python 3.10+, Node.js 18+, Docker, Chrome

### Commands

```bash
make start    # Full setup: install deps -> env -> db -> seed -> dev
make dev      # Start backend + frontend
make demo     # Docker demo (clean DB, auto-seed)
make test     # Run all 298 tests
make prod     # Production build + serve
```

Additional commands:

```bash
make install  # Install all dependencies (backend + frontend + extension)
make db       # Start PostgreSQL container
make seed     # Create default admin account
make build    # Build frontend + extension for production
```

### Default Admin Account

After running `make seed`:

| Role  | Email           | Password  |
|-------|-----------------|-----------|
| Admin | admin@gmail.com | admin@123 |

Owners register via `/signup`. The admin approves them from the Pharmacies panel.

---

## Pages and Features

### Authentication (public)

| Route | Page | Description |
|-------|------|-------------|
| `/login` | Connexion | Email/password login |
| `/signup` | Inscription | Register as owner or employee (select pharmacy from list) |
| `/forgot-password` | Mot de passe oublie | Reset via email link or WhatsApp OTP (6-digit code) |
| `/reset-password` | Nouveau mot de passe | Set new password using reset token |

### Owner and Employee Pages (authenticated)

| Route | Page | Access | Description |
|-------|------|--------|-------------|
| `/rapports` | Tableau de bord | Owner, Employee | Main dashboard: KPIs (CA, marge, ticket moyen), sante financiere grade, margin alerts, monthly trend charts, category breakdown |
| `/analyse` | Analyse des marges | Owner, Employee | Margin analysis with 7 grouping modes: Produit, Categorie, Fournisseur, BL, Laboratoire, Operateur, Mois. Row selection, live KPI cards, CSV export |
| `/comptabilite` | Comptabilite | Owner, Employee | Accounting: manual entry for payment methods (TPE, Especes, Cheques, Virement), bilan financier with date range filter |
| `/achat` | Achats | Owner, Employee | Purchase ledger with Mixte/Pharmacie/Parapharmacie type filters, supplier summary, column visibility toggle, CSV export |
| `/ventes` | Ventes | Owner, Employee | Sales ledger with same type filters, quick-access badges for remises and price anomalies |
| `/stock` | Stock ABCD | Owner, Employee | Stock analysis: ABCD distribution chart, stock min/max recommendations, sortable product table with status badges |
| `/dashboard/upload-file` | Import CSV | Owner, Employee | Manual CSV import wizard (drag-and-drop, file type selection) |
| `/parametres` | Parametres | Owner, Employee | Profile settings + danger zone (view import history, batch deletion of data) |
| `/catalog-requests` | Produits speciaux | Owner, Employee | Submit product exclusion (non-declare) or annulation requests |
| `/owner/employees` | Employes | Owner only | Manage employees: approve/reject pending accounts, set feature permissions, revoke access |

### Admin Pages

| Route | Page | Description |
|-------|------|-------------|
| `/admin/pharmacies` | Pharmacies | Pharmacy management with tabbed panel: Membres (user management), Produits speciaux (non-declared products), Options (feature toggles) |
| `/admin/catalog-requests` | Demandes catalogue | Approve or reject product exclusion and annulation requests |
| `/admin/catalog` | Catalogue | Product catalog CRUD + XLSM bulk import, category normalization, deduplication |

---

## Math Formulas

### Revenue

**CA (Chiffre d'affaires)** = `PPV x quantite vendue`

> Example: PPV = 162.00 MAD, qty = 5 -> CA = 810.00 MAD

### Purchase Price

**PU (Prix Unitaire d'achat)** = weighted average of all purchases in the selected date range:

```
PU = Sum(PU_achat x qty_achat) / Sum(qty_achat)
```

> Example: 1 x 124.23 + 1 x 129.20 + 2 x 129.20 = 511.83, total qty = 4 -> PU = 127.96 MAD

Falls back to PPH (catalog reference price) if no purchases exist in the selected period.

### Margins

**Marge %** = `(1 - PU / PPV) x 100`

> Example: PU = 127.96, PPV = 162.00 -> (1 - 0.7899) x 100 = **21.0%**

**Marge brute (DH)** = `PPV - PU`

> Example: 162.00 - 127.96 = **34.04 MAD** per unit

**Marge nette (DH)** = `PPV_HT - PU_HT` where HT = `/ (1 + taux_TVA)`

> Example: TVA = 20% -> 162/1.2 - 127.96/1.2 = 135.00 - 106.63 = **28.37 MAD**

**Marge moyenne** = quantity-weighted average:

```
Marge moyenne = Sum(qty x marge%) / Sum(qty)
```

### TVA

| Metric | Formula |
|--------|---------|
| TVA encaissee (ventes) | `Sum(PPV x qty x taux_TVA)` |
| TVA payee (achats) | `Sum(PU x qty x taux_TVA)` |
| TVA a declarer | `encaissee - payee` (estimation) |

### KPIs

| KPI | Formula |
|-----|---------|
| Ticket moyen | `CA total / nombre de transactions` |
| Vente moyenne / jour | `CA total / nombre de jours avec ventes` |

**Sante financiere** -- letter grade based on marge moyenne:

| Grade | Marge moyenne |
|-------|---------------|
| A+ | > 30% |
| A | > 25% |
| B+ | > 20% |
| B | > 15% |
| C | > 10% |
| D | > 5% |
| F | <= 5% |

### Stock ABCD Classification

**Ratio** = `total_unites_vendues_12_mois / 300`

| Class | Criteria |
|-------|----------|
| A | ratio >= 1.0 (300+ unites/an) |
| A- | 0.833 -- 0.997 (250 -- 299 unites) |
| B+ | 0.667 -- 0.833 (200 -- 249 unites) |
| B | 0.16 -- 0.667 (48 -- 199 unites) |
| C | 0.02 -- 0.157 (6 -- 47 unites) |
| C- | 1 -- 5 unites en 12 mois |
| C-N | 1 -- 5 unites uniquement sur les 4 derniers mois (nouveautes) |
| D | 0 unite en 12 mois |

**Stock MIN** = `floor(ratio x 14)` -- securite 2 semaines

**Stock MAX** = `ceil(ratio x 15)`

Exceptions:
- C / C- / C-N: min = 0, max = 1
- D: min = 0, max = 0

---

## API Reference

### Auth (`/auth`) -- 8 endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/signup` | Create account (owner or employee) |
| POST | `/auth/login` | Authenticate and get JWT token |
| GET | `/auth/me` | Get current user profile |
| PUT | `/auth/me` | Update profile (name, phone, password) |
| POST | `/auth/forgot-password` | Send password reset email |
| POST | `/auth/reset-password` | Reset password with email token |
| POST | `/auth/forgot-password-whatsapp` | Send OTP via WhatsApp |
| POST | `/auth/verify-otp` | Verify WhatsApp OTP |

### Admin (`/admin`) -- 28 endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/pharmacies` | List all pharmacies |
| POST | `/admin/pharmacies` | Create pharmacy |
| PUT | `/admin/pharmacies/{id}` | Update pharmacy |
| DELETE | `/admin/pharmacies/{id}` | Delete pharmacy |
| GET | `/admin/pharmacy/{id}/non-declared` | Non-declared products for a pharmacy |
| GET | `/admin/pharmacies/{id}/options` | Get pharmacy feature options |
| PUT | `/admin/pharmacies/{id}/options` | Update pharmacy feature options |
| GET | `/admin/users` | List all users |
| GET | `/admin/users/pending` | List pending owner accounts |
| GET | `/admin/notifications` | Pending users + pending catalog requests count |
| PUT | `/admin/users/{id}/approve` | Approve pending account |
| PUT | `/admin/users/{id}/reject` | Reject pending account |
| PUT | `/admin/users/{id}/revoke` | Revoke active account |
| PUT | `/admin/users/{id}/role` | Change user role |
| PUT | `/admin/users/{id}/pharmacy` | Assign user to pharmacy |
| PUT | `/admin/users/{id}/permissions` | Update user feature permissions |
| GET | `/admin/catalog/categories` | List distinct catalog categories |
| POST | `/admin/catalog/deduplicate` | Remove duplicate catalog entries |
| GET | `/admin/catalog` | List catalog products (paginated) |
| POST | `/admin/catalog` | Create catalog product |
| PUT | `/admin/catalog/{id}` | Update catalog product |
| POST | `/admin/catalog/normalize-categories` | Normalize category strings |
| DELETE | `/admin/catalog/{id}` | Delete catalog product |
| GET | `/admin/category-suffixes` | List delivery ref suffixes |
| POST | `/admin/category-suffixes` | Create suffix mapping |
| PUT | `/admin/category-suffixes/{id}` | Update suffix mapping |
| DELETE | `/admin/category-suffixes/{id}` | Delete suffix mapping |
| GET | `/admin/analytics` | Platform-wide analytics |

### Owner (`/owner`) -- 6 endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/owner/employees` | List pharmacy employees |
| PUT | `/owner/employees/{id}/approve` | Approve employee |
| PUT | `/owner/employees/{id}/reject` | Reject employee |
| PUT | `/owner/employees/{id}/revoke` | Revoke employee access |
| PUT | `/owner/employees/{id}/permissions` | Update employee permissions |
| GET | `/owner/notifications` | Pending employee count |

### Uploads (`/uploads`) -- 5 endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/uploads/achat` | Upload purchase CSV (supports chunked uploads with batch_id) |
| POST | `/uploads/vente` | Upload sales CSV (supports chunked uploads with batch_id) |
| POST | `/uploads/achat-json` | Upload purchases from JSON array |
| POST | `/uploads/vente-json` | Upload sales from JSON array |
| POST | `/uploads/catalog` | Upload product catalog from XLSM file |

### Data (`/data`) -- 4 endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| DELETE | `/data/achats` | Clear purchase data (with optional date/category filters) |
| DELETE | `/data/ventes` | Clear sales data (with optional date/category filters) |
| GET | `/data/imports` | List import batches with metadata |
| DELETE | `/data/imports/{batch_id}` | Delete a specific import batch |

### Transactions -- 8 endpoints

**Achats (`/achat`)** -- 4 endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/achat` | Purchases -- paginated, filterable, exportable |
| GET | `/achat/categories` | Distinct purchase categories |
| GET | `/achat/tva-rates` | Distinct purchase TVA rates |
| GET | `/achat/suggestions` | Autocomplete suggestions for search |

**Ventes (`/ventes`)** -- 4 endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/ventes` | Sales -- paginated, filterable, exportable |
| GET | `/ventes/categories` | Distinct sales categories |
| GET | `/ventes/tva-rates` | Distinct sales TVA rates |
| GET | `/ventes/suggestions` | Autocomplete suggestions for search |

**Common query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | int | Page number (default 1) |
| `limit` | int | Items per page (default 10, max 200) |
| `search` | string | Search product, supplier, ref |
| `category` | string[] | Filter by category (multi-select) |
| `tva` | string[] | Filter by TVA rate (multi-select) |
| `date_from` | YYYY-MM-DD | Start date |
| `date_to` | YYYY-MM-DD | End date |
| `export` | bool | Return all rows (no pagination) |

### Catalog Requests (`/catalog-requests`) -- 6 endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/catalog-requests` | List requests (filtered by role) |
| POST | `/catalog-requests` | Submit new product request |
| POST | `/catalog-requests/non-declare` | Request product exclusion |
| POST | `/catalog-requests/annulation` | Request to cancel an exclusion |
| PUT | `/catalog-requests/{id}/approve` | Admin approves request |
| PUT | `/catalog-requests/{id}/reject` | Admin rejects request |

### Stats -- 12 endpoints

**Pharmacy stats (`/stats`)**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stats` | KPIs, TVA, marge, trends, category breakdown |
| GET | `/stats/analyse-marge` | Margin analysis (7 grouping modes) |
| GET | `/stats/margin-alerts` | Products with margin below threshold |
| GET | `/stats/stock-abcd` | Stock ABCD classification |
| GET | `/stats/export-excel` | Excel report export |
| GET | `/stats/products` | Pharmacy products with declared status |

**Admin pharmacy stats (`/admin/pharmacy/{id}/stats`)**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/pharmacy/{id}/stats` | Stats for a specific pharmacy |
| GET | `/admin/pharmacy/{id}/stats/export-excel` | Excel export for a pharmacy |
| GET | `/admin/pharmacy/{id}/stats/analyse-marge` | Margin analysis for a pharmacy |
| GET | `/admin/pharmacy/{id}/stats/margin-alerts` | Margin alerts for a pharmacy |
| GET | `/admin/pharmacy/{id}/stats/stock-abcd` | Stock ABCD for a pharmacy |

**Platform stats**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/stats` | Platform-wide system statistics |

### Accounting (`/accounting`) -- 3 endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/accounting/payments` | List payment entries for a date range |
| POST | `/accounting/payments` | Create payment entry (TPE, Especes, Cheques, Virement) |
| DELETE | `/accounting/payments/{id}` | Delete a payment entry |

### Public (`/public`) -- 1 endpoint

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/public/pharmacies` | List pharmacies (unauthenticated, used in signup) |

**Total: 81 endpoints across 10 routers**

---

## Environment

```
env/
├── dev/       docker.env, backend.env, frontend.env, extension.env
├── demo/      docker.env, backend.env, frontend.env, extension.env
├── test/      backend.env
└── prod/      docker.env, backend.env, frontend.env, extension.env
```

Key backend environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SECRET_KEY` | Recommended | JWT signing key |
| `MAIL_USERNAME` | Yes | SMTP username for password reset emails |
| `MAIL_PASSWORD` | Yes | SMTP password |
| `WHATSAPP_PHONE_NUMBER_ID` | Optional | Meta WhatsApp Business phone number ID |
| `WHATSAPP_ACCESS_TOKEN` | Optional | Meta WhatsApp Business API token |
| `FRONTEND_URL` | Optional | Frontend URL for CORS and email links |
| `CORS_ORIGINS` | Recommended | Allowed origins (comma-separated) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Optional | JWT expiry (default: 10080 = 7 days) |

---

## Testing

```bash
make test        # Run all 298 tests
make test-back   # 187 pytest tests (9 files, covers all 81 endpoints)
make test-front  # 84 vitest tests (5 files, all API modules)
make test-ext    # 27 vitest tests (3 files, extension modules)
```

- Backend tests use a separate test database (`apcm_test`)
- Frontend and extension tests mock API calls via vitest
- Test environment config in `env/test/backend.env`

---

## Chrome Extension

The extension integrates with the Sobrus pharmacy management interface to automate data import.

**How it works:**

1. User logs into the PharmaGest dashboard -- auth token is relayed to the extension via `postMessage`
2. Extension injects a connection indicator on Sobrus pages (green = connected, red = not connected)
3. When the user clicks "Telecharger en CSV" on Sobrus, the extension intercepts the download
4. CSV is fetched via same-domain Sobrus API (session cookies included)
5. Data is split into 500-row chunks and uploaded sequentially to the backend
6. Progress banner shows per-chunk status on the Sobrus page
7. On completion, a notification is saved and the dashboard tab is focused

**Key features:**

- Intercepts Sobrus CSV downloads automatically
- Queues multiple exports for sequential processing
- Upload progress banner with per-job status
- Batch tracking: one import = one batch_id (not per chunk)
- Cancel support during upload

---

## Security

- **JWT authentication** with configurable expiry (default 7 days)
- **bcrypt password hashing** with cost factor 12
- **Security headers**: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Strict-Transport-Security
- **CORS restricted** to configured origins (not wildcard in production)
- **File upload size limit**: 10 MB
- **Required env validation** on startup (DATABASE_URL, MAIL_USERNAME, MAIL_PASSWORD)
- **SQL injection prevention** via SQLAlchemy parameterized queries
- **Non-root Docker containers** in demo and production
- **Extension token storage** in `chrome.storage.local` (encrypted at rest by Chrome)
- **Auto-logout** on 401 responses via `auth:unauthorized` event

---

(c) 2026 PharmaGest. All rights reserved.
