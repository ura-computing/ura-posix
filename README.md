# PharmaGest

A comprehensive pharmacy management system designed for Moroccan pharmacies using Sobrus POS software. The system bridges the gap between Sobrus web interface and modern data analytics through a Chrome extension that captures data directly from the browser and syncs it to a centralized dashboard.

## Project Overview

PharmaGest is a full-stack web application with a Chrome extension that enables pharmacy owners to capture, import, manage, and analyze their business data from Sobrus POS. The system consists of three core components:

1. **Chrome Extension**: Captures purchase and sales data directly from Sobrus web interface
2. **Backend API**: Processes and stores data with automatic product deduplication
3. **React Dashboard**: Provides analytics, filtering, and data visualization

### Core Value Proposition

- **One-click data capture** from Sobrus web interface via Chrome extension
- **Automatic CSV import** with real-time progress tracking and notifications
- **Area selection tool** for capturing table data from any web page
- Centralized product catalog with automatic deduplication via PID matching
- Purchase and sales history with advanced filtering and export capabilities
- Multi-pharmacy support with role-based access (admin, owner, employee)
- RESTful API with JWT authentication
- Modern React dashboard with real-time data visualization

## Architecture

### Technology Stack

**Backend:**
- FastAPI 0.115.6 (Python web framework)
- SQLAlchemy 2.0.36 (ORM)
- PostgreSQL 16 (Primary database)
- Pydantic 2.10.3 (Data validation)
- python-jose 3.3.0 (JWT tokens)
- bcrypt 4.2.1 (Password hashing)

**Frontend:**
- React 19.1.0 with TypeScript
- Refine 5.0.1 (Headless admin framework)
- TanStack Query 5.90.21 (Data fetching)
- TanStack Table 8.2.6 (Data tables)
- shadcn/ui + Radix UI (Component library)
- Tailwind CSS 4.1.4 (Styling)
- React Router 7.0.2 (Routing)

**Chrome Extension:**
- Manifest V3 Chrome Extension
- React 19.2.0 with TypeScript
- TanStack Query 5.90.21 (State management)
- Chrome Storage API (Token and notification persistence)
- Content Scripts (DOM extraction and Sobrus integration)
- Background Service Worker (CSV upload orchestration)

**Infrastructure:**
- Docker Compose (PostgreSQL containerization)
- Vite 6.3.5 (Frontend build tool)
- Uvicorn (ASGI server)

### System Architecture

```
┌──────────────────┐
│  Sobrus Web UI   │  (Pharmacy POS System)
│  (app.pharma.    │
│   sobrus.com)    │
└────────┬─────────┘
         │
         │ DOM Extraction
         │ Area Selection
         ▼
┌──────────────────┐
│ Chrome Extension │  (Data Capture Layer)
│  - Content Script│  • Intercepts CSV downloads
│  - Background SW │  • Extracts table data from DOM
│  - Popup UI      │  • Chunks & uploads to backend
└────────┬─────────┘
         │
         │ HTTP/REST (CSV chunks)
         │ JWT Auth from localStorage
         ▼
┌──────────────────┐      HTTP/REST      ┌──────────────┐
│   React          │ ◄─────────────────► │   FastAPI    │
│  Dashboard       │   JSON + JWT Auth   │   Backend    │
│  (localhost:5173)│                     │ (localhost:  │
└──────────────────┘                     │   8000)      │
         ▲                               └──────┬───────┘
         │                                      │
         │ Real-time notifications              │ SQLAlchemy ORM
         │ (Chrome Storage API)                 ▼
         │                               ┌──────────────┐
         └───────────────────────────────│  PostgreSQL  │
                                         │   Database   │
                                         └──────────────┘
```

### Data Flow

1. **Authentication Flow:**
   - User submits credentials → `/auth/login`
   - Backend validates password (bcrypt) → generates JWT token
   - Frontend stores token in localStorage
   - Extension content script syncs token to Chrome Storage API
   - All subsequent requests include `Authorization: Bearer <token>` header
   - Backend validates JWT → extracts user_id → loads User from database

2. **Extension Capture Flow (Primary Data Input Method):**
   - User navigates to Sobrus export page (exportpurchases or exportsales)
   - User clicks "Télécharger en CSV" button on Sobrus interface
   - Extension content script intercepts the download request
   - Extension fetches CSV directly from Sobrus API (session cookies included)
   - Extension splits CSV into chunks (500 rows per chunk)
   - Background service worker uploads each chunk → `/uploads/achat` or `/uploads/vente`
   - Real-time progress displayed in banner (both Sobrus page and dashboard)
   - On completion: notification saved to Chrome Storage → dashboard auto-updates
   - User can click notification to navigate to data view

3. **Extension Area Selection Flow (Alternative Capture Method):**
   - User opens extension popup → selects "Achats" or "Ventes"
   - User clicks "Capturer une zone" button
   - Content script injects overlay with crosshair cursor
   - User drags to select table area on any web page
   - Extension extracts table data from DOM (headers + rows)
   - Background service worker uploads JSON → `/uploads/achat-json` or `/uploads/vente-json`
   - Success notification displayed with preview of captured data

4. **Manual CSV Import Flow (Dashboard Upload):**
   - User uploads CSV file via dashboard → `/uploads/achat` or `/uploads/vente`
   - Backend parses CSV (semicolon-delimited, UTF-8/Latin-1 encoding)
   - For each row: upsert Medicament by PID → create Achat/Vente record
   - Duplicate detection via (delivery_ref, medicament_id) or (transaction_ref, medicament_id)
   - Returns `{inserted: N, skipped: M}`

5. **Catalog Import Flow:**
   - User uploads XLSM file → `/uploads/catalog`
   - Backend reads "LISTING" sheet using openpyxl
   - Clears existing Medicament table (cascades to Achat/Vente)
   - Imports products with barcode as PID (fallback to product name)
   - Deduplicates by name and PID

6. **Data Query Flow:**
   - Frontend requests data → `/achat?page=1&limit=20&search=aspirin&category=PHARMA`
   - Backend builds SQLAlchemy query with filters
   - Joins Medicament table for product details
   - Returns paginated results with metadata

### Design Patterns

**Dependency Injection:**
- `get_db()` generator yields SQLAlchemy session, ensures cleanup via `finally` block
- `get_current_user()` dependency extracts JWT, validates, and returns User object
- FastAPI's `Depends()` mechanism handles injection automatically

**Repository Pattern (Implicit):**
- Router functions act as thin controllers
- Database queries encapsulated in `_base_query()` helper functions
- Separation of concerns: routers handle HTTP, helpers handle data access

**Schema Validation:**
- Pydantic models validate all incoming request bodies
- `UserRegister`, `UserLogin`, `ProfileUpdate` enforce type safety
- `model_config = {"from_attributes": True}` enables ORM model serialization

**Middleware:**
- CORS middleware allows cross-origin requests (configured for `*` in development)
- HTTPBearer security scheme extracts JWT from Authorization header

**Upsert Pattern:**
- `_upsert_medicament()` implements "insert or update" logic
- Tries exact PID match → falls back to name match → creates new record
- Prevents duplicate products while allowing catalog updates

## Key Features

### Chrome Extension (Primary Data Capture)
- **One-click CSV capture** from Sobrus web interface
- **Automatic upload** with chunked processing (500 rows per chunk)
- **Real-time progress tracking** with visual progress bar
- **Area selection tool** for capturing tables from any web page
- **DOM table extraction** with automatic header detection
- **Background upload** via service worker (bypasses CORS)
- **Smart notifications** synced between extension and dashboard
- **Session management** with automatic token sync
- **Dual-mode operation**: Sobrus auto-capture + manual area selection

### Authentication & Authorization
- JWT-based authentication with bcrypt password hashing
- Role-based access control (admin, owner, employee)
- Profile completion workflow for new users
- Token refresh and validation
- Cross-component token sync (dashboard ↔ extension)

### Data Import
- **Extension auto-capture** (primary method) from Sobrus export pages
- **Extension area selection** for custom table extraction
- Manual CSV upload for Sobrus purchase orders (Achats)
- Manual CSV upload for Sobrus sales transactions (Ventes)
- XLSM catalog import from accounting files
- Automatic product deduplication via PID matching
- Duplicate transaction detection and skipping
- Multi-encoding support (UTF-8, Latin-1)
- Chunked upload with progress tracking

### Product Management
- Centralized medicament catalog
- Product attributes: PID, name, category, PPH, PPV, TVA, barcodes
- Automatic catalog updates from import files
- Laboratory and zone tracking

### Purchase Management (Achats)
- Purchase history with delivery notes
- Supplier tracking
- Expiry date monitoring
- Stock min/max thresholds
- Advanced filtering: search, category, date range
- CSV export functionality

### Sales Management (Ventes)
- Sales transaction history
- Client tracking
- Discount management
- Transaction reference tracking
- Advanced filtering and export

### Multi-Pharmacy Support
- Pharmacy entity management
- User-pharmacy associations
- Admin dashboard for user management
- Pharmacy-level data isolation (planned)

### Frontend Dashboard
- Responsive React UI with dark mode support
- Data tables with sorting, filtering, pagination
- Date range picker with presets
- Multi-select category filters
- Real-time search
- CSV export from browser
- File upload with drag-and-drop
- Toast notifications
- **Real-time extension notifications** with unread badges
- **Import history** with click-to-view navigation
- Collapsible sidebar with French labels

## Setup & Installation

### Prerequisites
- Python 3.10+
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 16 (via Docker)
- Google Chrome or Chromium-based browser (for extension)

### Environment Configuration

1. Copy environment template:
```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

2. Configure `backend/.env`:
```env
DATABASE_URL=postgresql://pharmagest:password@localhost:5432/pharmagest
SECRET_KEY=<generate-secure-key>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
```

3. Configure `frontend/.env`:
```env
VITE_API_URL=http://localhost:8000
```

### Installation

Install all dependencies:
```bash
make install
```

Or install individually:
```bash
make back-install   # Backend only
make front-install  # Frontend only
make ext-install    # Chrome extension only
```

### Chrome Extension Setup

1. Build the extension:
```bash
cd extension
npm run build
```

2. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the `extension/build` directory

3. Pin the extension:
   - Click the puzzle icon in Chrome toolbar
   - Find "APCM Pharma Capture"
   - Click the pin icon to keep it visible

4. The extension is now ready to capture data from Sobrus!

### Database Setup

Start PostgreSQL container:
```bash
make db
```

The database will be created automatically on first backend startup via SQLAlchemy's `Base.metadata.create_all()`.

### Development

Start all services:
```bash
make dev
```

Or start individually:
```bash
make back-dev   # Backend: http://localhost:8000
make front-dev  # Frontend: http://localhost:5173
```

Stop database:
```bash
make down
```

## Usage

### Chrome Extension Usage (Recommended)

The Chrome extension is the primary method for importing data from Sobrus POS.

#### Method 1: Automatic CSV Capture (Sobrus Export Pages)

1. Log in to the PharmaGest dashboard (http://localhost:5173)
2. Navigate to Sobrus web interface (app.pharma.sobrus.com)
3. Go to Reports → Export Purchases or Export Sales
4. Click the "Télécharger en CSV" button
5. The extension automatically:
   - Intercepts the CSV download
   - Splits data into chunks (500 rows each)
   - Uploads to PharmaGest backend
   - Shows real-time progress in a banner
   - Displays success notification with import summary
6. Click the notification to view imported data in dashboard

#### Method 2: Area Selection Tool (Any Web Page)

1. Open the extension popup (click the extension icon)
2. Select data type: "Achats" (purchases) or "Ventes" (sales)
3. Click "Capturer une zone"
4. Drag to select the table area on the web page
5. Click "Extraire les données"
6. Extension extracts table data and uploads to backend
7. View preview and import summary in popup

### API Authentication

1. Register a new user:
```bash
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret","name":"John Doe"}'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "profile_complete": false,
    "role": "owner"
  }
}
```

2. Login:
```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret"}'
```

3. Access protected endpoints:
```bash
curl http://localhost:8000/auth/me \
  -H "Authorization: Bearer <token>"
```

### Importing Data

#### Via Chrome Extension (Recommended)

See "Chrome Extension Usage" section above for the primary data import method.

#### Via API (Alternative)

1. Upload Sobrus purchase CSV:
```bash
curl -X POST http://localhost:8000/uploads/achat \
  -H "Authorization: Bearer <token>" \
  -F "file=@Sobrus-Achats.csv"
```

Response:
```json
{"inserted": 150, "skipped": 5}
```

2. Upload Sobrus sales CSV:
```bash
curl -X POST http://localhost:8000/uploads/vente \
  -H "Authorization: Bearer <token>" \
  -F "file=@Sobrus-Ventes.csv"
```

3. Upload JSON data (used by extension area selection):
```bash
curl -X POST http://localhost:8000/uploads/achat-json \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"rows": [{"PID": "12345", "Produit": "ASPIRIN 500MG", ...}]}'
```

4. Upload catalog XLSM:
```bash
curl -X POST http://localhost:8000/uploads/catalog \
  -H "Authorization: Bearer <token>" \
  -F "file=@LISTING.xlsm"
```

### Querying Data

1. List purchases with filters:
```bash
curl "http://localhost:8000/achat?page=1&limit=20&search=aspirin&category=PHARMA&date_from=2026-01-01" \
  -H "Authorization: Bearer <token>"
```

Response:
```json
{
  "data": [
    {
      "id": 1,
      "delivery_date": "2026-01-15",
      "delivery_ref": "BL-2026-001",
      "supplier": "PHARMA DIST",
      "product": "ASPIRIN 500MG",
      "pid": "12345",
      "category": "PHARMA",
      "quantity": 100,
      "unit_price": 5.50,
      "total": 550.00
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

2. Export all purchases to CSV:
```bash
curl "http://localhost:8000/achat?export=true" \
  -H "Authorization: Bearer <token>"
```

3. Get available categories:
```bash
curl http://localhost:8000/achat/categories \
  -H "Authorization: Bearer <token>"
```

## API Documentation

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Create new user account | No |
| POST | `/auth/login` | Authenticate and get JWT token | No |
| GET | `/auth/me` | Get current user profile | Yes |
| PUT | `/auth/me` | Update user profile | Yes |

### Upload Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/uploads/achat` | Import Sobrus purchase CSV | Yes |
| POST | `/uploads/achat-json` | Import purchases from JSON (extension area selection) | Yes |
| POST | `/uploads/vente` | Import Sobrus sales CSV | Yes |
| POST | `/uploads/vente-json` | Import sales from JSON (extension area selection) | Yes |
| POST | `/uploads/catalog` | Import product catalog from XLSM | Yes |

### Data Query Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/achat` | List purchases with pagination/filters | Yes |
| GET | `/achat/categories` | Get available purchase categories | Yes |
| GET | `/ventes` | List sales with pagination/filters | Yes |
| GET | `/ventes/categories` | Get available sales categories | Yes |
| GET | `/data/dashboard` | Get dashboard KPI summary | Yes |

### Admin Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/admin/users` | List all users (admin only) | Yes |
| PUT | `/admin/users/{id}/role` | Update user role | Yes |
| PUT | `/admin/users/{id}/pharmacy` | Assign user to pharmacy | Yes |
| GET | `/admin/pharmacies` | List all pharmacies | Yes |
| POST | `/admin/pharmacies` | Create new pharmacy | Yes |

### Query Parameters

**Pagination:**
- `page` (int, default: 1): Page number
- `limit` (int, default: 10, max: 200): Items per page

**Filtering:**
- `search` (string): Search in product name, PID, supplier, reference
- `category` (array): Filter by product categories (multi-select)
- `date_from` (string, YYYY-MM-DD): Start date filter
- `date_to` (string, YYYY-MM-DD): End date filter
- `export` (bool): Return all results without pagination

## Project Structure

```
.
├── backend/                 # FastAPI backend
│   ├── routers/            # API route handlers
│   │   ├── auth.py         # Authentication endpoints
│   │   ├── uploads.py      # CSV/XLSM/JSON import logic
│   │   ├── achat.py        # Purchase queries
│   │   ├── vente.py        # Sales queries
│   │   ├── data.py         # Dashboard data
│   │   └── admin.py        # Admin management
│   ├── utils/              # Utility functions
│   │   └── auth.py         # JWT and password utilities
│   ├── models.py           # SQLAlchemy ORM models
│   ├── schemas.py          # Pydantic validation schemas
│   ├── database.py         # Database connection setup
│   ├── main.py             # FastAPI application entry
│   └── requirements.txt    # Python dependencies
├── frontend/               # React dashboard
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   │   ├── refine-ui/  # Refine framework components
│   │   │   │   ├── layout/ # Sidebar, header, user avatar
│   │   │   │   ├── notification/ # Toast notifications
│   │   │   │   └── theme/  # Dark mode support
│   │   │   └── ui/         # shadcn/ui components
│   │   ├── pages/          # Page components
│   │   ├── providers/      # Auth and data providers
│   │   ├── lib/            # API client and utilities
│   │   ├── routes.tsx      # Route configuration
│   │   └── App.tsx         # Application root
│   └── package.json        # Node dependencies
├── extension/              # Chrome extension (PRIMARY DATA INPUT)
│   ├── src/
│   │   ├── background/     # Service worker
│   │   │   └── index.ts    # Upload orchestration, token storage
│   │   ├── content/        # Content scripts
│   │   │   ├── index.ts    # Token relay, notifications, area selection
│   │   │   ├── sobrus-export.ts  # CSV intercept and chunked upload
│   │   │   └── sobrus-ui.ts      # Progress banner on Sobrus pages
│   │   ├── popup/          # Extension popup UI
│   │   │   └── app.tsx     # Capture controls and preview
│   │   ├── lib/            # Utilities
│   │   │   ├── api.ts      # Backend API client
│   │   │   ├── storage.ts  # Chrome Storage API wrapper
│   │   │   └── tabs.ts     # Tab management
│   │   ├── hooks/          # React hooks
│   │   │   ├── use-capture.ts    # Area selection logic
│   │   │   ├── use-token.ts      # Token management
│   │   │   └── use-notifications.ts  # Notification state
│   │   └── constants.ts    # Shared constants
│   ├── public/
│   │   └── manifest.json   # Chrome extension manifest v3
│   └── package.json        # Node dependencies
├── docker-compose.yml      # PostgreSQL container config
├── Makefile                # Development commands
└── README.md               # This file
```

## Database Schema

### Users Table
- `id`: Primary key
- `email`: Unique, indexed
- `password_hash`: bcrypt hashed password
- `name`, `phone`, `pharmacy_name`: Profile fields
- `image_url`: Profile picture URL
- `profile_complete`: Boolean flag
- `role`: admin | owner | employee
- `pharmacy_id`: Foreign key to pharmacies

### Pharmacies Table
- `id`: Primary key
- `name`, `address`, `phone`, `email`: Pharmacy details

### Medicaments Table (Product Catalog)
- `id`: Primary key
- `pid`: Unique product identifier (Sobrus PID or barcode)
- `product`: Product name
- `category`, `zone`, `laboratoire`: Classification
- `pph`: Purchase price (Prix Public Hors Taxe)
- `ppv`: Selling price (Prix Public de Vente)
- `tva`: Tax rate
- `barcode1`, `barcode2`: Product barcodes

### Achats Table (Purchases)
- `id`: Primary key
- `medicament_id`: Foreign key to medicaments
- `delivery_date`, `delivery_ref`: Delivery note details
- `supplier`: Supplier name
- `quantity`, `unit_price`, `total`: Transaction amounts
- `expiry_date`: Product expiration
- `stock_min`, `stock_max`: Inventory thresholds

### Ventes Table (Sales)
- `id`: Primary key
- `medicament_id`: Foreign key to medicaments
- `date`, `transaction_ref`: Transaction details
- `client`: Customer name
- `quantity`, `unit_price`, `discount`, `total`: Transaction amounts

## Chrome Extension Architecture

### Content Scripts

**index.ts** (runs on all pages):
- Syncs JWT token between localStorage and Chrome Storage API
- Relays notifications from background to dashboard
- Implements area selection tool with DOM table extraction
- Shows real-time upload progress banner on dashboard

**sobrus-export.ts** (runs on Sobrus export pages):
- Intercepts "Télécharger en CSV" button clicks
- Fetches CSV directly from Sobrus API (bypasses download)
- Splits CSV into 500-row chunks
- Sends chunks to background service worker for upload
- Updates upload status in Chrome Storage for real-time UI sync

**sobrus-ui.ts** (runs on Sobrus export pages):
- Displays upload progress banner with animated progress bar
- Shows success notification with import summary
- Provides "Open Dashboard" link to view imported data

### Background Service Worker

**index.ts**:
- Stores and retrieves JWT tokens from Chrome Storage
- Uploads CSV chunks to backend API (can reach localhost)
- Saves notifications after successful uploads
- Opens/focuses dashboard tab after import completion
- Relays area selection requests to content scripts

### Popup UI

**app.tsx**:
- Login status indicator with redirect to dashboard
- Data type selector (Achats vs Ventes)
- "Capturer une zone" button to trigger area selection
- Preview table showing captured data
- Import status and error messages

### Key Design Decisions

1. **Chunked Upload**: Large CSV files (10,000+ rows) are split into 500-row chunks to prevent timeout and memory issues
2. **Background Upload**: Service worker handles uploads because content scripts cannot reach localhost due to CORS
3. **Chrome Storage Sync**: Upload status stored in Chrome Storage allows real-time UI updates across tabs
4. **Token Relay**: Content script syncs token from localStorage to Chrome Storage for extension access
5. **DOM Extraction**: Area selection tool uses bounding box overlap detection to find tables within selected region

## Development Notes

### Database Migrations
Currently using SQLAlchemy's `create_all()` for schema creation. For production, implement Alembic migrations:
```bash
pip install alembic
alembic init alembic
alembic revision --autogenerate -m "Initial schema"
alembic upgrade head
```

### Testing
No test suite currently implemented. Recommended setup:
- Backend: pytest + pytest-asyncio + httpx
- Frontend: Vitest + React Testing Library
- Extension: Chrome Extension Testing Library + Puppeteer

### Security Considerations
- JWT tokens expire after 7 days (configurable)
- Passwords hashed with bcrypt (cost factor 12)
- CORS configured for `*` in development (restrict in production)
- SQL injection prevented via SQLAlchemy parameterized queries
- No rate limiting implemented (add in production)
- Extension uses Chrome Storage API (encrypted at rest)
- Extension requires `activeTab` permission (minimal access)

### Performance Optimization
- Database indexes on: `email`, `pid`, `medicament_id`
- Pagination limits max 200 items per request
- Eager loading via `joinedload()` prevents N+1 queries
- Bulk inserts via `bulk_save_objects()` for imports
- Extension chunked upload prevents memory overflow
- Extension uses `read_only=True` for Excel file parsing

## License

© 2026 PharmaGest. All rights reserved.
