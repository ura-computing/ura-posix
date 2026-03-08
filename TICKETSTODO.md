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
    [ ] [BACKEND] Add zone field to Medicament model if not already present (map from Sobrus CSV column)

+ Admin Pharmacy Management: Admin panel to create pharmacies and assign users with roles.
    [*] [BACKEND] Pharmacy model with id, name, address, phone, email, created_at and users relationship
    [*] [BACKEND] User model extended: role (admin/owner/employee, default owner), pharmacy_id
    [*] [BACKEND] Admin router: CRUD for pharmacies, user role assignment, user pharmacy assignment — all guarded by get_current_admin (403 if not admin)
    [*] [BACKEND] Admin endpoints: GET/POST/PUT/DELETE /admin/pharmacies, GET/PUT /admin/users
    [*] [FRONTEND] Admin Pharmacies page: pharmacy cards grid (create/edit), users panel with role/pharmacy dropdowns, delete confirmation dialog
    [*] [FRONTEND] Sidebar "Pharmacies" tab visible only to admin users
    [ ] [BACKEND] Scope all queries (ventes, achats, dashboard) to current_user.pharmacy_id for tenant isolation
    [ ] [BACKEND] Alembic migration for pharmacies table and new columns on users

+ Database Infrastructure:
    [*] [BACKEND] Models: User, Medicament, Achat, Vente, Pharmacy (SQLAlchemy ORM)
    [*] [BACKEND] Configure DATABASE_URL env variable pointing to PostgreSQL
    [ ] [BACKEND] Docker Compose config for PostgreSQL (dev + production)
    [ ] [BACKEND] Initialize Alembic and create initial migration
    [ ] [BACKEND] Clean source of truth csv file manually
