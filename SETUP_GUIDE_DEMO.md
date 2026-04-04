# PharmaGest -- Demo Setup Guide

Run the full application with a single command using Docker.

---

## One-Command Start

```bash
make demo
```

That's it.

---

## What It Does

The `make demo` command performs the following steps in order:

1. Loads the demo environment (`APP_ENV=demo`, reads from `env/demo/`)
2. Builds the Chrome extension locally
3. Runs `docker compose down -v` to remove any existing containers and volumes
4. Builds all Docker images from scratch (no cache)
5. Starts three containers:
   - **db** -- PostgreSQL 16 (port 5432)
   - **backend** -- FastAPI API server, seeds accounts and catalog on first start (port 8000)
   - **frontend** -- Production build served via preview server (port 4173)

First run takes a few minutes while Docker images are built. Subsequent runs are faster.

---

## Access the App

| Service   | URL                        |
|-----------|----------------------------|
| Dashboard | http://localhost:4173      |
| API Docs  | http://localhost:8000/docs |

---

## Default Accounts

| Role  | Email           | Password  | Pharmacy        |
|-------|-----------------|-----------|-----------------|
| Admin | admin@gmail.com | admin@123 | --              |
| Owner | owner@gmail.com | owner@123 | Pharmacie Demo  |

---

## Seeded Data

The seed imports **16,282 medicaments** from `catalog.csv` into the product catalog, giving the demo a realistic dataset to work with.

---

## Features by Role

### Admin

- **Pharmacies** -- manage pharmacies, users, approve/reject signups, configure per-pharmacy feature toggles (Options tab)
- **Catalogue** -- CRUD products, import catalog XLSM, manage category suffixes
- **Demandes catalogue** -- approve/reject exclusion and annulation requests from owners
- **Rapports** -- system-wide stats, per-pharmacy drill-down with Excel export

### Owner (Pharmacie Demo)

- **Achats / Ventes** -- paginated tables with search, category/TVA/date filters, pharmacie/parapharmacie toggle, CSV export
- **Rapports** -- KPIs, TVA breakdown, marge analysis, monthly trends, Excel export
- **Import** -- CSV upload wizard or auto-import via Chrome extension
- **Produits non declares** -- request product exclusions, cancel approved exclusions
- **Mes employes** -- approve/reject employees, manage per-feature permissions
- **Parametres** -- clear achat/vente data with optional filters

### Employee

- Same pages as owner, but limited by the permissions set by the pharmacy owner

---

## Chrome Extension

The extension is already built by `make demo`. To load it in Chrome:

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select `extension/dist/`
4. Pin the extension to the toolbar

The extension connects to the dashboard automatically when you log in. It intercepts CSV exports from Sobrus (`app.pharma.sobrus.com`) and sends them directly to the backend.

---

## Stop the App

```bash
# Ctrl+C in the terminal running make demo, then:
make down
```

---

## Reset to a Clean State

```bash
make down    # remove all containers and volumes
make demo    # rebuild and start fresh
```

---

## Switching Back to Dev

After running the demo, switch back to local development with:

```bash
make back-dev
```

This recreates the database using the dev environment (`env/dev/`) and starts the backend in development mode.
