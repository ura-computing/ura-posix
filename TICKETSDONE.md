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

