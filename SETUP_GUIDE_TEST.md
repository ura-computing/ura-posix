# PharmaGest — Test / Demo Setup Guide

Get the full application built and running inside Docker with a single command.

---

## Prerequisites

- **Docker & Docker Compose**
- **Node.js 18+** (to build the Chrome extension locally)
- **Google Chrome** (for the extension)

---

## One-Command Start

```bash
make demo
```

That's it. This will:

1. Create `.env` from the template (if it doesn't exist)
2. Build the Chrome extension locally
3. Build and start three Docker containers:
   - **db** — PostgreSQL 16 (port 5432)
   - **backend** — FastAPI API, seeds the admin account on first start (port 8000)
   - **frontend** — Production build served via `serve` (port 4173)

> **First run takes a few minutes** — Docker images need to be built. Subsequent runs are fast.

---

## Access the App

| Service   | URL                          |
|-----------|------------------------------|
| Dashboard | http://localhost:4173        |
| API Docs  | http://localhost:8000/docs   |

---

## Default Admin Account

| Email           | Password  |
|-----------------|-----------|
| admin@gmail.com | admin@123 |

---

## Set Up a Pharmacy (Owner + Employees)

The seed only creates the admin. To test the full pharmacy workflow:

1. **Register an owner** — open http://localhost:4173/register in a new browser profile or incognito window, select **Propriétaire**, fill in the pharmacy details, and submit.
2. **Approve the owner** — log in as admin → **Pharmacies** → find the pending account → approve.
3. **Add employees** — log in as the owner → **Mes employés** → invite / manage employee accounts.

---

## Chrome Extension

Already built by `make demo`. Load it in Chrome:

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** → select `extension/dist/`
4. Pin the extension to the toolbar

The extension connects to the dashboard automatically when you log in. It intercepts CSV exports from Sobrus (`app.pharma.sobrus.com`) and sends them directly to the backend.

---

## Stop the App

```bash
# Ctrl+C in the terminal running `make demo`, then:
make down
```

---

## Reset to a Clean State

```bash
make down    # remove all containers and data
make demo    # rebuild and start fresh
```
