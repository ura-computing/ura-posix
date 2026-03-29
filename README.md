# APCM Pharma

A pharmacy management dashboard for Moroccan pharmacies using Sobrus POS. The Chrome extension automatically intercepts CSV exports from Sobrus and uploads them directly to the backend — no manual file handling required.

---

## System Architecture

```
┌─────────────────────┐
│   Sobrus Web UI     │  (app.pharma.sobrus.com)
│                     │
│  [Télécharger CSV]──┼──► content script intercepts click
└─────────────────────┘
           │
           │ CSV fetched via same-domain Sobrus API
           │ Split into 500-row chunks
           ▼
┌─────────────────────┐
│  Chrome Extension   │  (Data Capture Layer)
│                     │
│  content/index.ts   │  • Auth token relay (dashboard → extension)
│  sobrus-export.ts   │  • CSV intercept + chunked upload
│  background/        │  • Upload orchestration (can reach localhost)
│  popup/             │  • Auth status + import history panel
│                     │
│  ┌─────────────────┐│
│  │  [A] APCM  ●    ││  ← Draggable status indicator on Sobrus
│  └─────────────────┘│    (teal = connected, red = not connected)
└──────────┬──────────┘
           │
           │ HTTP POST /uploads/achat  (CSV chunks, JWT auth)
           │ Chunk progress synced via chrome.storage
           ▼
┌─────────────────────┐      HTTP/REST      ┌──────────────────┐
│   React Dashboard   │ ◄─────────────────► │  FastAPI Backend │
│   (localhost:5173)  │   JSON + JWT Auth   │  (localhost:8000)│
│                     │                     │                  │
│  Achats / Ventes    │                     │  /uploads/*      │
│  Rapports / Stats   │                     │  /achat, /ventes │
│  Catalog Requests   │                     │  /auth, /admin   │
│  Employee Mgmt      │                     │  /owner, /stats  │
│  Notification bell  │                     │  /catalog-requests│
└─────────────────────┘                     └────────┬─────────┘
           ▲                                         │
           │ Notifications + upload progress         │ SQLAlchemy ORM
           │ (chrome.storage → content script        ▼
           │  → window.postMessage → React)  ┌──────────────────┐
           └─────────────────────────────────│   PostgreSQL     │
                                             │   Database       │
                                             └──────────────────┘
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
│ phone                │      │
│ email                │      │
│ created_at           │      │
└──────────────────────┘      │
           │                  │
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
│ permissions (JSON)         │  ← { import, achat, ventes, rapports, stock }
│ created_at, updated_at     │
└────────────────────────────┘


┌──────────────────────────────────────┐
│         medicaments                  │  (Product Catalog — source of truth)
├──────────────────────────────────────┤
│ id           (PK)                    │
│ pid          (UQ)                    │  ← Sobrus product ID (or barcode fallback)
│ product                              │  ← Product name
│ category                             │  ← e.g. "Medicaments (7.0%)"
│ product_type                         │  ← "pharmacie" | "parapharmacie" | null
│ zone, laboratoire                    │
│ pph, ppv, tva                        │  ← Prices + tax rate
│ barcode1, barcode2                   │
│ created_at, updated_at               │
└──────────┬───────────────────────────┘
           │ 1
           ├────────────────────────────────────────────────────┐
           │ N                                                  │ N
           ▼                                                    ▼
┌────────────────────────────┐            ┌───────────────────────────────────┐
│          achats            │            │            ventes                 │
│       (Purchases)          │            │            (Sales)                │
├────────────────────────────┤            ├───────────────────────────────────┤
│ id              (PK)       │            │ id              (PK)              │
│ pharmacy_id     (FK)       │            │ pharmacy_id     (FK)              │
│ medicament_id   (FK)       │            │ medicament_id   (FK)              │
│ delivery_date              │            │ date                              │
│ delivery_ref               │            │ transaction_ref                   │
│ delivery_ref_final         │            │ transaction_ref_final             │
│ supplier                   │            │ client                            │
│ quantity, unit_price       │            │ quantity, unit_price              │
│ expiry_date, total         │            │ discount, total                   │
│ uploaded_at                │            │ uploaded_at                       │
└────────────────────────────┘            └───────────────────────────────────┘


┌──────────────────────────────────────┐
│      catalog_requests                │  (Exclusion & annulation requests)
├──────────────────────────────────────┤
│ id              (PK)                 │
│ requested_by    (FK → users)         │
│ pharmacy_id     (FK → pharmacies)    │
│ request_type                         │  ← new_product | non_declare | annulation
│ medicament_id   (FK, nullable)       │
│ status                               │  ← pending | approved | rejected
│ reject_reason, notes                 │
│ product, tva, pph, ppv, ...         │
│ created_at, reviewed_at              │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│  pharmacy_medicament_status          │  (Per-pharmacy product exclusions)
├──────────────────────────────────────┤
│ pharmacy_id + medicament_id (UQ)     │
│ declared (bool)                      │  ← False = excluded from reports
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│      category_suffixes               │  (Delivery ref suffix mappings)
├──────────────────────────────────────┤
│ category (UQ), suffix, color         │
└──────────────────────────────────────┘

Deduplication keys:
  achats  → (delivery_ref, medicament_id, pharmacy_id)
  ventes  → (transaction_ref, medicament_id, pharmacy_id)
```

---

## Technology Stack

**Backend:** FastAPI, SQLAlchemy 2, PostgreSQL 16, Pydantic v2, python-jose, bcrypt

**Frontend:** React 19 + TypeScript, React Router 7, TanStack Query + Table, shadcn/ui, Tailwind CSS 4, Zod + react-hook-form, Recharts

**Extension:** Chrome MV3, React 19 + TypeScript, TanStack Query, Chrome Storage API

---

## Data Flows

### 1. Authentication
```
User login → POST /auth/login
           → bcrypt verify → JWT generated
           → token stored in sessionStorage (dashboard)
           → content script picks up postMessage(APCM_AUTH_TOKEN)
           → token stored in chrome.storage.local (extension)
           → Sobrus indicator updates to green ●
```

### 2. Extension CSV Auto-Capture (Primary)
```
User clicks "Télécharger en CSV" on Sobrus
→ content script intercepts click
→ fetches CSV via same-domain Sobrus API (session cookies included)
→ splits CSV into 500-row chunks
→ sends each chunk to background service worker
→ background uploads chunk → POST /uploads/achat or /uploads/vente
→ updates chrome.storage (apcm_upload_status) after each chunk
→ content script reads storage change → shows progress banner
→ on completion → saves notification to chrome.storage
→ opens / focuses dashboard tab on relevant page
```

### 3. Manual CSV Import (Dashboard)
```
User drops file on dashboard upload wizard
→ POST /uploads/achat or /uploads/vente (multipart)
→ backend parses CSV (semicolon-delimited, UTF-8 / Latin-1)
→ for each row: upsert Medicament by PID → insert Achat/Vente
→ returns { inserted: N, skipped: M }
```

### 4. Catalog Request Flow
```
Owner submits exclusion request (non_declare) for a product
→ Admin approves → product marked as excluded (PharmacyMedicamentStatus.declared = false)
→ Product excluded from reports and stats

Owner wants to reverse → submits annulation request
→ Admin approves → exclusion removed (product declared again)
→ Admin rejects → product stays excluded
```

---

## API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/signup` | Create account (owner/employee) |
| POST | `/auth/login` | Get JWT token |
| GET | `/auth/me` | Current user profile |
| PUT | `/auth/me` | Update profile |
| POST | `/auth/forgot-password` | Send password reset email |
| POST | `/auth/forgot-password-whatsapp` | Send OTP via WhatsApp |
| POST | `/auth/verify-otp` | Verify WhatsApp OTP and reset password |
| POST | `/auth/reset-password` | Reset password with email token |

### Uploads
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/uploads/achat` | Sobrus purchase CSV (chunked from extension) |
| POST | `/uploads/vente` | Sobrus sales CSV (chunked from extension) |
| POST | `/uploads/achat-json` | Purchases from JSON array |
| POST | `/uploads/vente-json` | Sales from JSON array |
| POST | `/uploads/catalog` | Product catalog from XLSM |

### Data Query
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/achat` | Purchases — paginated, filterable |
| GET | `/achat/categories` | Distinct categories |
| GET | `/achat/tva-rates` | Distinct TVA rates |
| GET | `/ventes` | Sales — paginated, filterable |
| GET | `/ventes/categories` | Distinct categories |
| GET | `/ventes/tva-rates` | Distinct TVA rates |
| DELETE | `/data/achats` | Clear purchase data (with filters) |
| DELETE | `/data/ventes` | Clear sales data (with filters) |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/admin/pharmacies` | List / create pharmacies |
| PUT/DELETE | `/admin/pharmacies/{id}` | Update / delete pharmacy |
| GET | `/admin/users` | List all users |
| GET | `/admin/users/pending` | List pending owner accounts |
| PUT | `/admin/users/{id}/approve` | Approve a pending account |
| PUT | `/admin/users/{id}/reject` | Reject a pending account |
| PUT | `/admin/users/{id}/revoke` | Revoke an active account |
| PUT | `/admin/users/{id}/role` | Change user role |
| PUT | `/admin/users/{id}/pharmacy` | Assign pharmacy |
| PUT | `/admin/users/{id}/permissions` | Update feature permissions |
| GET/POST | `/admin/catalog` | List / create catalog products |
| PUT/DELETE | `/admin/catalog/{id}` | Update / delete product |
| GET/POST | `/admin/category-suffixes` | Manage delivery ref suffixes |
| PUT/DELETE | `/admin/category-suffixes/{id}` | Update / delete suffix |
| GET | `/admin/notifications` | Pending users + pending catalog requests |
| GET | `/admin/stats` | Platform-wide system stats |
| GET | `/admin/pharmacy-stats/{id}` | Detailed stats for a pharmacy |

### Owner
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/owner/employees` | List pharmacy employees |
| PUT | `/owner/employees/{id}/approve` | Approve employee |
| PUT | `/owner/employees/{id}/reject` | Reject employee |
| PUT | `/owner/employees/{id}/revoke` | Revoke employee access |
| PUT | `/owner/employees/{id}/permissions` | Update employee permissions |
| GET | `/owner/notifications` | Pending employees |

### Catalog Requests
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/catalog-requests` | List requests (filtered by role) |
| POST | `/catalog-requests` | Submit new product request |
| POST | `/catalog-requests/non-declare` | Request product exclusion |
| POST | `/catalog-requests/annulation` | Request to cancel an exclusion |
| PUT | `/catalog-requests/{id}/approve` | Admin approves request |
| PUT | `/catalog-requests/{id}/reject` | Admin rejects request |

### Stats
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stats` | Pharmacy stats (KPIs, TVA, marge, trends) |
| GET | `/stats/products` | Pharmacy products with declared status |
| GET | `/stats/analyse-marge` | Margin analysis by product |
| GET | `/stats/export-excel` | Excel report export |

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/public/pharmacies` | List pharmacies (unauthenticated, for signup) |

### Query Parameters (GET /achat, GET /ventes)
| Param | Type | Description |
|-------|------|-------------|
| `page` | int | Page number (default 1) |
| `limit` | int | Items per page (default 10, max 200) |
| `search` | string | Search product, supplier, ref |
| `category` | string[] | Filter by category (multi) |
| `tva` | string[] | Filter by TVA rate (multi) |
| `date_from` | YYYY-MM-DD | Start date |
| `date_to` | YYYY-MM-DD | End date |
| `export` | bool | Return all rows (no pagination) |

---

## Project Structure

```
apcm-pharma/
├── backend/
│   ├── main.py                  # FastAPI app, CORS, router registration
│   ├── database.py              # SQLAlchemy engine + session
│   ├── seed.py                  # Admin account seeder
│   ├── models/
│   │   ├── auth.py              # User, Pharmacy
│   │   ├── catalog.py           # Medicament, CatalogRequest, PharmacyMedicamentStatus, CategorySuffix
│   │   └── transactions.py      # Achat, Vente
│   ├── schemas/
│   │   ├── auth.py              # UserSignup, UserLogin, ProfileUpdate
│   │   ├── catalog.py           # MedicamentCreate/Out, CatalogRequestCreate/Out, NonDeclareRequestCreate
│   │   └── pharmacy.py          # Pharmacy schemas
│   ├── routers/
│   │   ├── auth.py              # Login, signup, profile, password reset
│   │   ├── uploads.py           # CSV/JSON/XLSM ingestion + upsert logic
│   │   ├── transactions.py      # GET /achat, GET /ventes (paginated, filterable)
│   │   ├── data.py              # DELETE /data/achats, DELETE /data/ventes
│   │   ├── admin.py             # Pharmacy + user management, catalog CRUD, suffixes
│   │   ├── owner.py             # Employee management + permissions
│   │   ├── catalog_requests.py  # Non-declare + annulation request workflow
│   │   ├── public.py            # Unauthenticated endpoints (pharmacy list for signup)
│   │   └── stats/               # Analytics engine
│   │       ├── router.py        # Stats endpoints
│   │       ├── queries.py       # KPI, TVA, trend queries
│   │       ├── marge.py         # Margin analysis
│   │       └── excel.py         # Excel export generation
│   └── utils/
│       ├── auth.py              # JWT encode/decode, bcrypt helpers
│       ├── permissions.py       # get_current_owner, get_current_admin
│       ├── email.py             # Password reset email
│       └── strings.py           # Accent stripping for categories
│
├── frontend/src/
│   ├── App.tsx                  # Route guards (Protected, Guest, Pending, Role)
│   ├── routes.tsx               # RouteConfig[] + ResourceConfig[] for sidebar
│   ├── api/                     # Typed API layer (one file per domain)
│   │   ├── client.ts            # Base request<T>(), uploadFile<T>(), fetchBlob()
│   │   ├── auth.ts              # login, signup, me, updateMe, forgotPassword, resetPassword
│   │   ├── admin.ts             # Admin API + CatalogRequestOut type
│   │   ├── owner.ts             # Employee management
│   │   ├── transactions.ts      # Achat/vente list, categories, export
│   │   ├── catalogRequests.ts   # Non-declare + annulation requests
│   │   ├── uploads.ts           # CSV upload
│   │   ├── stats.ts             # Stats + Excel export
│   │   └── public.ts            # Public pharmacy list
│   ├── hooks/                   # All TanStack Query/Mutation logic (no TanStack in pages)
│   │   ├── useAuthenticate.ts   # login, signup, logout, forgotPassword, resetPassword
│   │   ├── useMe.ts             # Current user query
│   │   ├── useUpdateMe.ts       # Profile update mutation
│   │   ├── useAchatList.ts      # Paginated achat query
│   │   ├── useVentesList.ts     # Paginated ventes query
│   │   ├── useClearData.ts      # Clear achats/ventes mutations
│   │   ├── useUpload.ts         # Upload mutations
│   │   ├── useCatalogRequests.ts       # Owner catalog request hooks
│   │   ├── useAdminCatalogRequests.ts  # Admin catalog request hooks
│   │   ├── useAdminCatalog.ts          # Admin catalog CRUD hooks
│   │   ├── useAdminPharmacies.ts       # Admin pharmacy management hooks
│   │   ├── useAdminRapports.ts         # Admin report queries
│   │   ├── usePharmacyRapports.ts      # Pharmacy report queries
│   │   ├── useOwnerEmployees.ts        # Owner employee management hooks
│   │   ├── useAdminOwnerNotifications.ts # Notification queries
│   │   ├── useCategoryOptions.ts       # Catalog category list
│   │   ├── useNotifications.ts         # Extension import notifications
│   │   ├── useStatusPoller.ts          # Pending account status poller
│   │   └── useMobile.ts               # Mobile breakpoint detection
│   ├── schemas/                 # Zod schemas + useForm hooks
│   │   ├── loginForm.ts
│   │   ├── signupForm.ts
│   │   ├── resetPassword.ts
│   │   └── profile.ts
│   ├── pages/
│   │   ├── welcome.tsx          # Landing page (role-aware)
│   │   ├── login/, signup/      # Auth pages
│   │   ├── forgotPassword/, resetPassword/
│   │   ├── pending.tsx          # Pending account screen
│   │   ├── achat/, ventes/      # Paginated data tables with filters
│   │   ├── rapports/            # Analytics (admin + pharmacy views)
│   │   ├── dashboard/           # Upload wizard
│   │   ├── stock/               # Stock alerts
│   │   ├── parametres/          # Danger zone: clear data
│   │   ├── profile/             # User profile
│   │   ├── catalogRequests/     # Owner: product exclusion requests
│   │   ├── owner/employees/     # Owner: employee management
│   │   └── admin/               # Admin: pharmacies, catalog, catalog requests
│   ├── components/
│   │   ├── layout/              # header, sidebar, layout, breadcrumb, userAvatar
│   │   ├── form/                # loginForm, signupForm, inputPassword
│   │   ├── data-table/          # dataTable, dataTablePagination
│   │   ├── theme/               # themeProvider, themeToggle, themeSelect
│   │   ├── shared/              # listView, reusable UI pieces
│   │   ├── tableToolbar.tsx     # 2-row filter toolbar (search, date, cat, TVA, type)
│   │   ├── categoryMultiSelect.tsx
│   │   ├── searchAutocomplete.tsx
│   │   ├── columnVisibilityToggle.tsx
│   │   ├── monthlyTrendChart.tsx
│   │   └── suffixBadge.tsx
│   ├── utils/                   # Helpers
│   │   ├── session.ts           # Token storage (sessionStorage)
│   │   ├── format.ts            # Number formatting (MAD currency)
│   │   ├── table.ts             # CSV export helper
│   │   └── cn.ts                # Tailwind class merger
│   ├── types/index.ts           # User, eUserRole, payload types
│   └── constants/index.ts       # TOKEN_KEY, API_URL, QUERY_KEYS, ENDPOINTS
│
└── extension/src/
    ├── background/index.ts      # Token storage, CSV chunk upload, notifications
    ├── content/index.ts         # Auth relay, notification bridge, draggable Sobrus indicator
    ├── content/sobrus-export.ts # Intercepts CSV download click, chunks + uploads
    ├── content/sobrus-ui.ts     # Upload progress banner on Sobrus
    ├── content/upload-banner.ts # Upload banner component
    ├── popup/app.tsx            # Auth status + recent import history
    ├── hooks/
    │   ├── use-token.ts         # Token read/write via chrome.storage
    │   ├── use-notifications.ts # Import history from chrome.storage
    │   └── use-upload-status.ts # Upload progress tracking
    └── constants.ts             # ACTIONS, ENDPOINTS, keys
```

---

## Setup

### Requirements
- Python 3.10+, Node.js 18+, Docker, Chrome

### Install
```bash
make          # install all deps, start DB, seed admin, start dev servers
# — or step by step —
make install  # install all deps
make db       # start PostgreSQL container
make seed     # create default admin account
make dev      # start backend + frontend
```

### Default Account

After running `make seed`:

| Role  | Email              | Password   |
|-------|--------------------|------------|
| Admin | admin@gmail.com    | admin@123  |

Owners register via `/signup`. The admin approves them from the Pharmacies panel.

### Environment (`backend/.env`)
```env
DATABASE_URL=postgresql://apcm:apcm@localhost:5432/apcm
SECRET_KEY=<generate-secure-key>
ACCESS_TOKEN_EXPIRE_MINUTES=10080
CORS_ORIGINS=http://localhost:5173
```

### Chrome Extension
```bash
cd extension && npm run build
# Chrome → chrome://extensions/ → Load unpacked → select extension/dist/
```

### WhatsApp OTP Setup (Password Reset via WhatsApp)

The app supports password reset via WhatsApp OTP using Meta's Cloud API.

#### 1. Create Meta Business & Developer Accounts

- Create a business account at [business.facebook.com](https://business.facebook.com)
- Create a developer account at [developers.facebook.com](https://developers.facebook.com)

#### 2. Create a Meta App

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps) → **Create App**
2. Choose **"Business"** type
3. Name it (e.g. "APCM Pharma"), select your business account
4. On the app dashboard, find **WhatsApp** and click **Set Up**

#### 3. Add a Phone Number

1. In WhatsApp → **Getting Started**, Meta provides a test phone number (free)
2. To use your own: go to **Phone Numbers** → **Add Phone Number** and verify via SMS/call
3. Note your **Phone Number ID** (displayed on the page)

#### 4. Create the Authentication Template

1. Go to **WhatsApp** → **Message Templates** → **Create Template**
2. Configure:
   - **Category**: `Authentication`
   - **Name**: `password_reset_otp`
   - **Language**: `French (fr)`
   - **OTP type**: Copy code
   - **Security disclaimer**: Yes
   - **Expiry warning**: 10 minutes
3. Submit for review (usually approved within minutes)

#### 5. Generate a Permanent Access Token

1. Go to [business.facebook.com/settings/system-users](https://business.facebook.com/settings/system-users)
2. Create a **System User** with Admin role
3. Click **Generate Token** → select your app → grant `whatsapp_business_messaging` permission
4. Copy the token (shown only once)

#### 6. Set Environment Variables

Add to `backend/.env`:

```env
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_permanent_access_token
```

#### Important Notes

- **Test mode**: The test phone number can only send to numbers manually added in WhatsApp → Getting Started → "To" field
- **Production**: Verify your business and get your phone number approved to send to any number
- **Phone format**: Numbers must be in E.164 format (e.g. `212600000000` for Morocco — country code + number without leading 0)
- **Cost**: ~$0.03 per authentication message to Morocco

---

## Key Design Decisions

| Decision | Reason |
|----------|--------|
| **Chunked CSV upload (500 rows)** | Prevents timeout and memory overflow on 10k+ row exports |
| **Background SW handles uploads** | Content scripts can't reach localhost; background can |
| **chrome.storage for sync** | Upload progress persists across tabs without WebSocket |
| **Token relay via postMessage** | Extension can't read dashboard's sessionStorage; dashboard fires a message on login |
| **Medicament upsert by PID** | Same product across multiple imports; PID is stable |
| **All TanStack in hooks** | Pages/components never call useQuery/useMutation directly |
| **Zod schemas in /schemas** | Form validation separate from UI; useForm in schema files |
| **No Refine framework** | Removed in favor of plain React Router + custom hooks |
| **PharmacyMedicamentStatus** | Per-pharmacy product exclusions without modifying the shared catalog |
| **Annulation requests** | Owners can reverse approved exclusions through admin approval |

---

## Security Notes
- JWT expires after 7 days (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`)
- Passwords hashed with bcrypt (cost 12)
- CORS `*` in development — restrict in production
- SQL injection prevented by SQLAlchemy parameterized queries
- Extension uses `chrome.storage.local` (encrypted at rest by Chrome)
- 401 responses auto-logout via `auth:unauthorized` event

---

(c) 2026 APCM Pharma. All rights reserved.
