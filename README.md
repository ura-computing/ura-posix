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
┌──────────────────┐         ┌────────────────────┐
│   pharmacies     │         │      users         │
├──────────────────┤         ├────────────────────┤
│ id          (PK) │◄──┐     │ id          (PK)   │
│ name             │   │     │ email       (UQ)   │
│ address          │   │     │ password_hash      │
│ phone            │   └─────│ pharmacy_id (FK)   │
│ email            │   N:1   │ role               │
│ created_at       │         │   admin            │
└──────────────────┘         │   owner            │
                             │   employee         │
                             │ name, phone        │
                             │ pharmacy_name      │
                             │ image_url          │
                             │ profile_complete   │
                             └────────────────────┘


┌──────────────────────────────┐
│         medicaments          │  (Product Catalog — source of truth)
├──────────────────────────────┤
│ id           (PK)            │
│ pid          (UQ)            │  ← Sobrus product ID (or barcode fallback)
│ product                      │  ← Product name
│ category                     │  ← e.g. "Médicaments (7.0%)"
│ zone                         │  ← Storage location
│ laboratoire                  │  ← Manufacturer
│ pph                          │  ← Purchase price (HT)
│ ppv                          │  ← Public selling price
│ tva                          │  ← Tax rate string e.g. "7%", "20%"
│ barcode1, barcode2           │
└──────────┬───────────────────┘
           │ 1
           ├──────────────────────────────────────────────┐
           │ N                                            │ N
┌──────────▼───────────────┐            ┌────────────────▼──────────────┐
│          achats          │            │            ventes             │
│       (Purchases)        │            │            (Sales)            │
├──────────────────────────┤            ├───────────────────────────────┤
│ id           (PK)        │            │ id            (PK)            │
│ medicament_id (FK)       │            │ medicament_id (FK)            │
│ delivery_date            │            │ date                          │
│ delivery_ref             │            │ transaction_ref               │
│ supplier                 │            │ client                        │
│ quantity                 │            │ quantity                      │
│ pph                      │            │ unit_price                    │
│ ppv                      │            │ ppv                           │
│ unit_price               │            │ discount                      │
│ total                    │            │ total                         │
│ expiry_date              │            └───────────────────────────────┘
│ stock_min, stock_max     │
└──────────────────────────┘

Deduplication keys:
  achats  → (delivery_ref, medicament_id)
  ventes  → (transaction_ref, medicament_id)
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
           → token stored in localStorage (dashboard)
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
| GET | `/admin/users` | List users |
| PUT | `/admin/users/{id}/role` | Change user role |
| PUT | `/admin/users/{id}/pharmacy` | Assign pharmacy |

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
    ├── background/index.ts  # Token storage, CSV chunk upload, notifications
    ├── content/index.ts     # Auth relay, notification bridge, Sobrus indicator
    ├── popup/app.tsx        # Auth status + recent import history panel
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
make install      # install all deps
make db           # start PostgreSQL container
make dev          # start backend + frontend
```

### Environment (`backend/.env`)
```env
DATABASE_URL=postgresql://pharmagest:password@localhost:5432/pharmagest
SECRET_KEY=<generate-secure-key>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
```

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
| **Draggable Sobrus indicator** | Visual confirmation that extension is active and connected, positioned by user preference (saved to localStorage) |

---

## Security Notes
- JWT expires after 7 days (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`)
- Passwords hashed with bcrypt (cost 12)
- CORS `*` in development — restrict to specific origins in production
- SQL injection prevented by SQLAlchemy parameterized queries
- Extension uses `chrome.storage.local` (encrypted at rest by Chrome)

---

© 2026 PharmaGest. All rights reserved.
