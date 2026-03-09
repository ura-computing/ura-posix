# PharmaGest — Developer Setup Guide

Complete setup instructions for local development.

---

## Prerequisites

- **Python 3.10+** (for backend)
- **Node.js 18+** (for frontend and extension)
- **Docker & Docker Compose** (for PostgreSQL)
- **Google Chrome** (for extension testing)

---

## Quick Start

### 1. Install Dependencies

```bash
make install
```

Creates `backend/.venv` and installs all Python, frontend, and extension packages.

### 2. Configure Environment

```bash
# Auto-created on first `make seed` or `make dev`, or manually:
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```env
DATABASE_URL=postgresql://pharmagest:pharmagest@localhost:5432/pharmagest
SECRET_KEY=<generate-with: python3 -c "import secrets; print(secrets.token_urlsafe(32))">
ACCESS_TOKEN_EXPIRE_MINUTES=10080
CORS_ORIGINS=http://localhost:5173
```

### 3. Start Database

```bash
make db
```

Starts PostgreSQL 16 on port 5432 and waits for healthcheck.

### 4. Seed Default Admin

```bash
make seed
```

Creates the default admin account (skips if already exists):

| Role  | Email           | Password  | Status |
|-------|-----------------|-----------|--------|
| Admin | admin@gmail.com | admin@123 | active |

### 5. Start Dev Servers

```bash
make dev
```

- Backend: http://localhost:8000
- Frontend: http://localhost:5173
- API Docs: http://localhost:8000/docs

### 6. Load Chrome Extension

```bash
make ext-build
```

Then in Chrome:
1. Go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `extension/dist/`
4. Pin the extension to your toolbar

---

## Default Account

Only the admin is seeded. To test with an owner or employee:

1. Log in as admin at http://localhost:5173
2. Open a second browser profile (or incognito) → go to http://localhost:5173/register
3. Register as an **Owner** (fill in pharmacy details)
4. Back in the admin panel → **Pharmacies** → approve the new account
5. Register additional employees from the owner's account under **Mes employés**

---

## Development Workflow

### Start Everything Fresh

```bash
make down     # stop and remove DB container
make db       # start fresh DB
make seed     # seed admin
make dev      # start servers
```

### Individual Commands

```bash
make back-dev    # backend only (port 8000)
make front-dev   # frontend only (port 5173)
make ext-dev     # extension watcher (hot reload)
make ext-build   # extension production build
```

### Database Management

```bash
make db                                          # start PostgreSQL
docker compose stop                              # stop container (keep data)
make down                                        # stop + delete data
make db-clean                                    # clear all rows via script
docker compose exec db psql -U pharmagest -d pharmagest  # psql shell
docker compose logs db                           # view DB logs
```

### Reseed from Scratch

```bash
make down && make db && make seed
```

---

## Testing the Setup

```bash
# Health check
curl http://localhost:8000/health

# Login as admin
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gmail.com","password":"admin@123"}'
```

Open http://localhost:5173 → log in → you should see the admin dashboard.

---

## Troubleshooting

### Database Connection Error

```bash
docker compose ps      # check if container is running
make down && make db   # restart
```

### Port Already in Use

```bash
lsof -ti:8000 | xargs kill -9   # free port 8000
lsof -ti:5173 | xargs kill -9   # free port 5173
```

### Seed: "Admin account already exists"

Normal — seed is idempotent. Run `make db-clean && make seed` to reset completely.

### Extension Not Capturing

1. Extension is loaded and enabled in Chrome
2. You're logged in to the dashboard
3. Extension popup shows green connected badge
4. You're on a Sobrus export page (`app.pharma.sobrus.com`)

---

## Additional Resources

- API docs: http://localhost:8000/docs
- DB models: `backend/models.py`
- Frontend routes: `frontend/src/routes.tsx`
- Extension manifest: `extension/public/manifest.json`
- Architecture: `README.md`
- Learning guide: `TECHNICAL_LEARNING.md`
