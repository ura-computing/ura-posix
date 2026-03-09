+ Product classification engine: Rule: suffix -1 = Medicine, suffix -2 = Parapharmacy. Fallback: keyword match. Log unknowns for review.
    [ ] [BACKEND] Define classification rule: Catégorie containing "Médicament" → Medicine (accounting suffix -1), all others (Parapharmacie, Complément Alimentaire, etc.) → Parapharmacy (suffix -2)
    [ ] [BACKEND] Apply classification during CSV/JSON ingestion to store accounting_group field on each Medicament row
    [ ] [FRONTEND] Display Medicine / Parapharmacy badge on Ventes and Achats list pages
    [ ] [FRONTEND] Admin settings screen to configure custom Catégorie → accounting group mappings

+ Invoice split logic (FAC-XXXXXX-1 / -2): Split mixed invoices by product type. Example: FAC-231371 split into FAC-231371-1 (medicines 173.30 MAD) + FAC-231371-2 (parapharmacy 399.00 MAD).
    [ ] [BACKEND] Build invoice split logic: group line items from the same invoice by accounting_group, create sub-invoice records with suffixed IDs
    [ ] [BACKEND] Store split invoices so they can be referenced in the Excel accounting export
    [ ] [FRONTEND] Show split invoice IDs (FAC-xxx-1 / FAC-xxx-2) in the Achats detail view

+ Filter: product type (Medicine / Parapharmacy): Primary filter. Must work correctly on split invoices. Real-time filtering, no page reload.
    [ ] [BACKEND] Add accounting_group query param filter to GET /ventes and GET /achat endpoints
    [ ] [FRONTEND] Add "Type de produit" toggle or dropdown filter (All / Medicine / Parapharmacy) to Ventes and Achats table toolbars

+ Filter: product category & storage zone: Categories: Food supplement, Homeopathy, etc. Zones: Counter, Drawer 3&4, Columns.
    [*] [BACKEND] categories multi-value query param filter on GET /ventes and GET /achat
    [*] [FRONTEND] Category multi-select filter in Ventes and Achats toolbars
    [*] [FRONTEND] Delete dialog uses category filter
    [ ] [BACKEND] Add zone query param filter to GET /ventes and GET /achat
    [ ] [FRONTEND] Add Zone dropdown filter to Ventes and Achats toolbars

+ Excel export with separate sheets: Generate .xlsx: Sheet1=Medicines, Sheet2=Parapharmacy, Sheet3=VAT Summary. Apply accounting format.
    [ ] [BACKEND] Install openpyxl and build GET /exports/ventes endpoint generating Excel with two sheets split by accounting_group
    [ ] [BACKEND] Include split invoice IDs (FAC-xxx-1 / FAC-xxx-2) in the relevant sheet rows
    [ ] [BACKEND] Apply active filters (date range, category, zone, TVA) to the export query so the export matches what the user sees on screen
    [ ] [FRONTEND] Add "Exporter Excel" button to Ventes page, Achats page, and Rapports page that triggers the download

+ Backend API: receive purchase data from extension: REST endpoint POST /purchases. Validate payload, store supplier/product/qty/PPH. Return confirmation.
    [*] [BACKEND] POST /uploads/vente-json — accepts JSON array of vente rows from extension
    [*] [BACKEND] POST /uploads/achat-json — accepts JSON array of achat rows from extension
    [*] [BACKEND] JWT authentication enforced on all upload endpoints via get_current_user dependency
    [ ] [BACKEND] Return detailed per-row result (inserted / skipped / error) instead of a simple count
    [*] [BACKEND] Add idempotency: skip rows that already exist (match on Sobrus reference + date + quantity)

+ Margin analysis module: Calculate: Margin = PPV - PPH. Margin% = (Margin/PPH)*100. Flag 0% margin. Example: BIODERMA H2O = 0%.
    [ ] [BACKEND] GET /reports/margin endpoint: compute per-product margin grouped by category and period
    [ ] [BACKEND] Aggregate margin stats on GET /dashboard/summary (overall avg margin%, margin by category)
    [ ] [FRONTEND] Margin column on Ventes table (hidden from Employee role)
    [ ] [FRONTEND] Margin KPI card on Dashboard
    [ ] [BACKEND] Restrict margin endpoints to Owner and Admin roles only (403 for Employee)

+ Top-selling products report: Rank by units sold and revenue. Separate Medicine vs Parapharmacy. Example: DOLIPRANE 1000MG - 450 units sold.
    [ ] [BACKEND] GET /reports/top-products endpoint: rank by total quantity sold, filterable by period, category, accounting_group
    [ ] [FRONTEND] Top products table/chart on Rapports page with period selector and group toggle
    [ ] [FRONTEND] Rapports page structure exists at frontend/src/pages/rapports/index.tsx — needs data-driven content

+ VAT report for government declaration: Calculate VAT by rate per period. Total VAT 20% for January = 108,215.02 MAD. Export as official format.
    [ ] [BACKEND] GET /reports/vat endpoint: sum TVA amounts grouped by rate for a given date range
    [ ] [FRONTEND] VAT report section on Rapports page with period selector and rate breakdown table
    [ ] [FRONTEND] VAT KPI cards on Dashboard (total TVA 7%, total TVA 20%)
    [ ] [BACKEND] Include VAT data in Excel export (optional third sheet or summary row)

+ Slow-moving stock report: Flag products with no sales in configurable period. Join with stock qty if available.
    [*] [FRONTEND] Stock alerts page (/stock) structure exists
    [ ] [BACKEND] GET /stock/alerts endpoint: products where last sale date exceeds threshold (default: 30 days)
    [ ] [BACKEND] Configurable threshold: accept days_threshold query param (default 30)
    [ ] [FRONTEND] Slow-moving stock table: product name, last sale date, days since last sale, alert severity badge

+ Sales analysis by storage zone: Aggregate sales by: Counter, Drawer 3&4, Columns. Bar chart + data table. Filter by date.
    [ ] [BACKEND] GET /reports/by-zone endpoint: aggregate revenue, quantity, margin by zone for a period
    [ ] [FRONTEND] Zone breakdown chart/table on Rapports page
    [*] [BACKEND] zone field added to Medicament model (maps from Sobrus CSV column)

+ Admin Pharmacy Management: Admin panel to create pharmacies and assign users with roles.
    [*] [BACKEND] Pharmacy model with id, name, address, phone, email, created_at and users relationship
    [*] [BACKEND] User model extended: role (admin/owner/employee, default owner), pharmacy_id
    [*] [BACKEND] Admin router: CRUD for pharmacies, user role assignment, user pharmacy assignment — all guarded by get_current_admin (403 if not admin)
    [*] [BACKEND] Admin endpoints: GET/POST/PUT/DELETE /admin/pharmacies, GET/PUT /admin/users
    [*] [FRONTEND] Admin Pharmacies page: pharmacy cards grid (create/edit), users panel with role/pharmacy dropdowns, delete confirmation dialog
    [*] [FRONTEND] Sidebar "Pharmacies" tab visible only to admin users
    [*] [BACKEND] Scope all queries (ventes, achats) to current_user.pharmacy_id for tenant isolation
    [ ] [BACKEND] Alembic migration for pharmacies table and new columns on users

+ Database Infrastructure:
    [*] [BACKEND] Models: User, Medicament, Achat, Vente, Pharmacy (SQLAlchemy ORM)
    [*] [BACKEND] Configure DATABASE_URL env variable pointing to PostgreSQL
    [*] [BACKEND] Docker Compose config for PostgreSQL, backend, and frontend (dev + demo)
    [ ] [BACKEND] Initialize Alembic and create initial migration
    [ ] [BACKEND] Clean source of truth csv file manually


=========================================================================================================
+ CSV parser for Sorbus export: Parse Sorbus CSV: handle encoding (UTF-8/latin1), map columns, validate rows. Support 8,760+ transactions.
    [*] [BACKEND] CSV upload endpoint Vente/achat
    [*] [BACKEND] JSON upload endpoint
    [*] [FRONTEND] File upload UI on Dashboard (3-step wizard: type selector, file drop zone, preview + import)
    [*] [BACKEND] Validate required columns and reject malformed CSVs with descriptive error messages
    [*] [BACKEND] Deduplicate rows on re-upload (idempotent ingestion) to prevent double-counting
    [*] [BACKEND] POST /uploads/catalog — import product catalog from XLSM accounting file (LISTING sheet)

+ Auto-detect downloaded CSV file: Intercept the Sobrus CSV export on the Sobrus platform and upload it directly to the backend without the user downloading it manually.
    [*] [EXTENSION] Background script relays messages between popup and content script
    [*] [EXTENSION] Content script intercepts "Télécharger en CSV" click on Sobrus export pages
    [*] [EXTENSION] Fetch CSV directly from Sobrus API (same-domain, session cookies included)
    [*] [EXTENSION] Split CSV into 500-row chunks and relay each to background service worker (bypasses Chrome Private Network Access policy)
    [*] [EXTENSION] Background uploads each chunk to backend and returns inserted/skipped count per chunk
    [*] [EXTENSION] Show real-time progress banner with "Lot X/N" progress bar on Sobrus page during upload
    [*] [EXTENSION] Show same upload progress banner on dashboard during active upload (synced via chrome.storage)
    [*] [EXTENSION] Save upload result as notification in chrome.storage for dashboard header bell

+ User Onboarding & Profile Setup: Guide new users through profile completion after registration. Collect name, phone, pharmacy name, and profile photo before accessing the dashboard.
    [*] [FRONTEND] Multi-step profile setup page (Informations → Photo de profil → Terminé)
    [*] [BACKEND] PUT /auth/me — update user profile fields (name, phone, pharmacy_name, image_url)
    [*] [BACKEND] profile_complete flag on User model — set to true after name, phone, pharmacy_name are filled
    [*] [FRONTEND] Redirect to /profile/setup after registration if profile_complete is false
    [*] [FRONTEND] Profile edit page for users to update their info after onboarding

+ Data Management (Paramètres): User-controlled deletion of ingested data by type, category, and date range.
    [*] [FRONTEND] Paramètres page with danger zone: delete Achats or Ventes data scoped by category and date range
    [*] [FRONTEND] Delete dialog redesigned to match design system: destructive header band, section labels with icons, separator, summary block with AlertTriangle
    [*] [BACKEND] DELETE /data/achats and DELETE /data/ventes with optional categories and date_from/date_to filters
    [*] [BACKEND] Return count of deleted rows in response for confirmation display

+ Filter: VAT rate (0% / 7% / 20%): Filter by VAT rate applied to product. Multi-select. Show count per rate.
    [*] [BACKEND] Add tva_rate query param filter to GET /ventes and GET /achat
    [*] [BACKEND] GET /achat/tva-rates and GET /ventes/tva-rates return distinct TVA values
    [*] [FRONTEND] Add TVA rate multi-select dropdown to Ventes and Achats table toolbars
    [*] [FRONTEND] TVA filter wired to export (CSV export respects active TVA filter)

+ Filter: date range & period: Date picker component. Support: today, this week, custom range. Applied on transaction date.
    [*] [BACKEND] date_from / date_to query params on GET /ventes and GET /achat
    [*] [FRONTEND] Date range picker on Ventes page toolbar
    [*] [FRONTEND] Date range picker on Achats page toolbar
    [*] [FRONTEND] Named period quick-select buttons (Aujourd'hui, 7 jours, Ce mois) in TableToolbar
    [*] [FRONTEND] Delete dialog uses two separate date inputs (Du / Au) instead of nested Calendar — avoids Radix Dialog scroll-lock

+ Chrome extension: popup interface: Status panel showing auto-import state and recent import history.
    [*] [EXTENSION] JWT token retrieved from web app via window.postMessage APCM_AUTH_TOKEN mechanism
    [*] [EXTENSION] Popup shows auth state (logged in / not logged in) with dashboard link
    [*] [EXTENSION] Popup shows "Import automatique actif" status card when connected
    [*] [EXTENSION] Popup shows recent import history list (inserted/skipped count, type, time ago)
    [*] [EXTENSION] Dashboard link button in popup to open relevant Achats/Ventes page
    [*] [EXTENSION] Show upload progress indicator for large captures

+ Multi-role auth with owner registration & approval workflow:
    [*] [BACKEND] Owner self-registration endpoint with pharmacy details (name, address, phone)
    [*] [BACKEND] User status flow: pending → active / rejected — admin must approve owners
    [*] [BACKEND] Admin approve/reject/revoke endpoints: PUT /admin/users/{id}/status
    [*] [BACKEND] Employee invitation and management by owner (POST /owner/employees)
    [*] [BACKEND] GET /auth/me returns effective permissions (intersection of owner + employee perms)
    [*] [FRONTEND] Registration page with role selector (Propriétaire / Employé)
    [*] [FRONTEND] Welcome page shown to pending users explaining approval status
    [*] [FRONTEND] PendingGuard blocks navigation to protected routes until status = active
    [*] [FRONTEND] Admin can approve/reject owners from Pharmacies panel

+ Employee permissions system:
    [*] [BACKEND] permissions JSON field on User model (achat, ventes, rapports, import, stock)
    [*] [BACKEND] Owner can update employee permissions via PUT /owner/employees/{id}/permissions
    [*] [FRONTEND] Owner "Mes employés" page: invite employees, toggle permissions per employee
    [*] [FRONTEND] Permission-based UI hiding: import buttons, achat/ventes/rapports QuickLinks hidden when permission = false
    [*] [FRONTEND] RoleGuard on routes: redirects to / if user lacks required permission
    [*] [FRONTEND] Real-time permission sync: useStatusPoller polls /auth/me every 4s, detects permission changes and updates UI without page reload

+ Configuration & environment management:
    [*] [BACKEND] ACCESS_TOKEN_EXPIRE_MINUTES read from env (default 10080 = 7 days)
    [*] [BACKEND] CORS_ORIGINS read from env (comma-separated, default "*")
    [*] [BACKEND] SECRET_KEY read from env with dev fallback
    [*] [BACKEND] backend/.env.example with all required vars
    [*] [FRONTEND] VITE_REFINE_PROJECT_ID read from env with fallback
    [*] [FRONTEND] frontend/.env.example with all required vars
    [*] [EXTENSION] extension/.env.example created (VITE_DASHBOARD_URL, VITE_API_URL)

+ Docker deployment (make demo):
    [*] [DEVOPS] backend/Dockerfile: python:3.12-slim, runs seed.py then uvicorn on startup
    [*] [DEVOPS] frontend/Dockerfile: pre-built dist served via serve on port 4173
    [*] [DEVOPS] docker-compose.yml: db + backend + frontend services with healthcheck dependency
    [*] [DEVOPS] make demo: builds frontend + extension locally, then docker compose up --build
    [*] [DEVOPS] Root .env / .env.example with all compose vars (Postgres, backend, frontend build args)
