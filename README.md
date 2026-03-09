# PharmaGest

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
│  Filters + Export   │                     │  /achat          │
│  Notification bell  │                     │  /ventes         │
│  Import history     │                     │  /auth           │
└─────────────────────┘                     │  /admin          │
           ▲                                └────────┬─────────┘
           │                                         │
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
│ google_id   (UQ, nullable) ││
│ pharmacy_id (FK, nullable) │┘
│ role                       │
│   admin                    │
│   owner                    │
│   employee                 │
│ status                     │
│   pending                  │
│   active                   │
│   rejected                 │
│ name, phone                │
│ pharmacy_name              │
│ image_url                  │
│ profile_complete           │
│ permissions (JSON)         │  ← feature flags: { import, achat, ventes, rapports, stock }
│ created_at, updated_at     │
└────────────────────────────┘


┌──────────────────────────────────────┐
│         medicaments                  │  (Product Catalog — source of truth)
├──────────────────────────────────────┤
│ id           (PK)                    │
│ pid          (UQ)                    │  ← Sobrus product ID (or barcode fallback)
│ product                              │  ← Product name
│ category                             │  ← e.g. "Médicaments (7.0%)"
│ zone                                 │  ← Storage location
│ laboratoire                          │  ← Manufacturer
│ pph                                  │  ← Purchase price (HT)
│ ppv                                  │  ← Public selling price
│ tva                                  │  ← Tax rate string e.g. "7%", "20%"
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
│ pharmacy_id     (FK) ──────┼────┐       │ pharmacy_id     (FK) ─────────────┼────┐
│ medicament_id   (FK)       │    │       │ medicament_id   (FK)              │    │
│ created_at_source          │    │       │ date                              │    │
│ delivery_date              │    │       │ transaction_ref                   │    │
│ delivery_ref               │    │       │ transaction_ref_final             │    │
│ delivery_ref_final         │    │       │ client                            │    │
│ supplier                   │    │       │ quantity                          │    │
│ quantity                   │    │       │ unit_price                        │    │
│ unit_price                 │    │       │ discount                          │    │
│ expiry_date                │    │       │ total                             │    │
│ stock_min, stock_max       │    │       │ uploaded_at                       │    │
│ total                      │    │       └───────────────────────────────────┘    │
│ uploaded_at                │    │                                                │
└────────────────────────────┘    │                                                │
           │                      │                                                │
           │ N:1                  │                                                │
           └──────────────────────┼────────────────────────────────────────────────┘
                                  │ N:1
                                  ▼
                          ┌──────────────────────┐
                          │   pharmacies         │
                          │  (shown above)       │
                          └──────────────────────┘


┌──────────────────────────────────────┐
│      catalog_requests                │  (Product addition requests)
├──────────────────────────────────────┤
│ id              (PK)                 │
│ requested_by    (FK → users.id) ─────┼───► users
│ pharmacy_id     (FK, nullable) ──────┼───► pharmacies
│ status                               │
│   pending                            │
│   approved                           │
│   rejected                           │
│ reject_reason                        │
│ product                              │
│ tva, pph, ppv                        │
│ category, zone                       │
│ barcode1, laboratoire                │
│ created_at, reviewed_at              │
└──────────────────────────────────────┘

Relationships:
  pharmacies 1:N users          (one pharmacy has many users)
  pharmacies 1:N achats         (one pharmacy has many purchases)
  pharmacies 1:N ventes         (one pharmacy has many sales)
  pharmacies 1:N catalog_requests (one pharmacy has many requests)
  medicaments 1:N achats        (one product appears in many purchases)
  medicaments 1:N ventes        (one product appears in many sales)
  users 1:N catalog_requests    (one user can make many requests)

Deduplication keys:
  achats  → (delivery_ref, medicament_id, pharmacy_id)
  ventes  → (transaction_ref, medicament_id, pharmacy_id)
```

---

## Technology Stack

**Backend:** FastAPI · SQLAlchemy 2 · PostgreSQL 16 · Pydantic v2 · python-jose · bcrypt

**Frontend:** React 19 + TypeScript · Refine 5 · TanStack Query/Table · shadcn/ui · Tailwind CSS 4 · React Router 7

**Extension:** Chrome MV3 · React 19 + TypeScript · TanStack Query · Chrome Storage API

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
  (visible both on Sobrus and on dashboard simultaneously)
→ on completion → saves notification to chrome.storage
→ opens / focuses dashboard tab on relevant page
→ dashboard notification bell shows unread count
```

### 3. Manual CSV Import (Dashboard)
```
User drops file on dashboard upload wizard
→ POST /uploads/achat or /uploads/vente (multipart)
→ backend parses CSV (semicolon-delimited, UTF-8 / Latin-1)
→ for each row: upsert Medicament by PID → insert Achat/Vente
→ returns { inserted: N, skipped: M }
```

### 4. Catalog Import
```
User uploads XLSM accounting file
→ POST /uploads/catalog
→ reads "LISTING" sheet via openpyxl
→ clears Medicament table (cascades to Achat/Vente)
→ imports products, deduplicates by PID and name
```

---

## API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Get JWT token |
| GET | `/auth/me` | Current user profile |
| PUT | `/auth/me` | Update profile |

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
| GET | `/admin/analytics` | Platform-wide analytics and trends |

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
│   ├── main.py              # FastAPI app, CORS, router registration
│   ├── models.py            # User, Medicament, Achat, Vente, Pharmacy
│   ├── schemas.py           # Pydantic request/response models
│   ├── database.py          # SQLAlchemy engine + session
│   ├── routers/
│   │   ├── auth.py          # Login, register, profile
│   │   ├── uploads.py       # CSV/JSON/XLSM ingestion + upsert logic
│   │   ├── achat.py         # GET /achat, categories, tva-rates
│   │   ├── vente.py         # GET /ventes, categories, tva-rates
│   │   ├── data.py          # DELETE /data/achats+ventes
│   │   └── admin.py         # Pharmacy + user management
│   └── utils/auth.py        # JWT encode/decode, bcrypt helpers
│
├── frontend/src/
│   ├── App.tsx              # Refine setup, route guards
│   ├── routes.tsx           # All routes + Refine resource config
│   ├── providers/
│   │   ├── auth.ts          # Refine AuthProvider, postMessage token relay
│   │   └── data.ts          # Refine DataProvider, filter → query params
│   ├── lib/
│   │   ├── api.ts           # Typed API client (auth, uploads, tables, admin)
│   │   └── table-utils.ts   # CSV export helpers, fmt()
│   ├── components/
│   │   ├── table-toolbar.tsx        # 2-row filter toolbar (search, date, cat, TVA)
│   │   ├── category-multi-select.tsx # Popover multi-select dropdown
│   │   └── refine-ui/layout/
│   │       ├── header.tsx           # Notification bell, user avatar
│   │       └── sidebar.tsx          # Nav, role-based visibility
│   └── pages/
│       ├── achat/index.tsx          # Purchases table
│       ├── ventes/index.tsx         # Sales table
│       ├── dashboard/upload-file.tsx # 3-step CSV import wizard
│       ├── parametres/index.tsx     # Danger zone: clear data
│       └── admin/pharmacies.tsx     # Admin panel
│
└── extension/src/
    ├── background/index.ts      # Token storage, CSV chunk upload, notifications
    ├── content/index.ts         # Auth relay, notification bridge, draggable Sobrus indicator
    ├── content/sobrus-export.ts # Intercepts CSV download click, chunks + uploads to backend
    ├── content/sobrus-ui.ts     # Upload progress banner on Sobrus export pages
    ├── popup/app.tsx            # Auth status + recent import history panel
    ├── hooks/
    │   ├── use-token.ts         # chrome.storage token read/write
    │   └── use-notifications.ts # Import history from chrome.storage
    ├── lib/
    │   ├── api.ts           # Backend fetch with JWT
    │   ├── storage.ts       # chrome.storage wrappers
    │   └── tabs.ts          # Open / focus dashboard tab
    └── constants.ts         # ACTIONS, ENDPOINTS, keys
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

### Default Accounts

After running `make seed`, you can log in with:

| Role  | Email              | Password   | Description                                   |
|-------|--------------------|------------|-----------------------------------------------|
| Admin | admin@gmail.com    | admin@123  | Full system access, user and pharmacy management |

Owners register themselves via the app (`/register`). The admin then approves them from the Pharmacies panel.

### Environment (`backend/.env`)
```env
DATABASE_URL=postgresql://pharmagest:pharmagest@localhost:5432/pharmagest
SECRET_KEY=<generate-secure-key>
ACCESS_TOKEN_EXPIRE_MINUTES=10080
CORS_ORIGINS=http://localhost:5173
```

**Note**: The seed script (`make seed`) will automatically create default accounts after the database is initialized. Run it once after your first `make db`.

### Chrome Extension
```bash
cd extension && npm run build
# Chrome → chrome://extensions/ → Load unpacked → select extension/dist/
```

---

## Key Design Decisions

| Decision | Reason |
|----------|--------|
| **Chunked CSV upload (500 rows)** | Prevents timeout and memory overflow on 10k+ row exports |
| **Background SW handles uploads** | Content scripts can't reach localhost (Chrome Private Network Access); background can |
| **chrome.storage for sync** | Upload progress and notifications persist across tabs without a WebSocket server |
| **Token relay via postMessage** | Extension can't read dashboard's localStorage directly; dashboard fires a message on login that content script forwards to background |
| **Medicament upsert by PID** | Same product may appear across multiple CSV imports; PID is the stable Sobrus identifier |
| **Draggable Sobrus indicator** | Visual confirmation that extension is active and connected, positioned by user preference (saved to `chrome.storage.local`) |

---

## Security Notes
- JWT expires after 7 days by default (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES` in `backend/.env`)
- Passwords hashed with bcrypt (cost 12)
- CORS `*` in development — restrict to specific origins in production
- SQL injection prevented by SQLAlchemy parameterized queries
- Extension uses `chrome.storage.local` (encrypted at rest by Chrome)

---

© 2026 PharmaGest. All rights reserved.
