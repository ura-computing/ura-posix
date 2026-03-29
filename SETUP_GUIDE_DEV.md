# APCM Pharma — Developer Setup Guide

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
DATABASE_URL=postgresql://apcm:apcm@localhost:5432/apcm
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
2. Open a second browser profile (or incognito) → go to http://localhost:5173/signup
3. Register as an **Owner** (fill in pharmacy details) or **Employee** (select existing pharmacy)
4. Back in the admin panel → **Pharmacies** → approve the new owner account
5. For employees: the pharmacy owner approves them from **Mes employes**

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
docker compose exec db psql -U apcm -d apcm  # psql shell
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

## Frontend Conventions

- **All filenames**: camelCase (`useMe.ts`, `loginForm.tsx`, `tableToolbar.tsx`)
- **Logic in hooks**: Pages/components never call `useQuery`/`useMutation` directly — all TanStack logic lives in `hooks/`
- **API calls in `api/` only**: Never call `fetch` directly in a component
- **Zod schemas in `schemas/`**: Form validation + `useForm` hooks live in schema files, not in UI components
- **Role checks use `eUserRole` enum**: No string literals (`"admin"`, `"owner"`, `"employee"`)

---

## Project Structure

```
backend/
├── models/          # SQLAlchemy models (auth.py, catalog.py, transactions.py)
├── schemas/         # Pydantic request/response models
├── routers/         # API endpoints
│   └── stats/       # Analytics engine (queries, marge, excel export)
└── utils/           # JWT, permissions, email, string helpers

frontend/src/
├── api/             # Typed API layer (one file per domain)
├── hooks/           # All TanStack Query/Mutation logic (~20 hooks)
├── schemas/         # Zod schemas + useForm hooks
├── pages/           # Route pages (thin UI, delegate to hooks)
├── components/      # Shared UI components
├── utils/           # session, format, table export, cn
├── types/           # TypeScript types + eUserRole enum
└── constants/       # API_URL, TOKEN_KEY, QUERY_KEYS

extension/src/
├── background/      # Token storage, upload orchestration
├── content/         # Auth relay, CSV intercept, Sobrus UI
├── popup/           # Extension popup UI
└── hooks/           # Token, notifications, upload status
```

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

## WhatsApp OTP Setup (Password Reset via WhatsApp)

The app supports password reset via WhatsApp OTP using Meta's Cloud API.

### 1. Create Meta Business & Developer Accounts

- Create a business account at [business.facebook.com](https://business.facebook.com)
- Create a developer account at [developers.facebook.com](https://developers.facebook.com)

### 2. Create a Meta App

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps) → **Create App**
2. Choose **"Business"** type
3. Name it (e.g. "APCM Pharma"), select your business account
4. On the app dashboard, find **WhatsApp** and click **Set Up**

### 3. Add a Phone Number

1. In WhatsApp → **Getting Started**, Meta provides a test phone number (free)
2. To use your own: go to **Phone Numbers** → **Add Phone Number** and verify via SMS/call
3. Note your **Phone Number ID** (displayed on the page)

### 4. Create the Authentication Template

1. Go to **WhatsApp** → **Message Templates** → **Create Template**
2. Configure:
   - **Category**: `Authentication`
   - **Name**: `password_reset_otp`
   - **Language**: `French (fr)`
   - **OTP type**: Copy code
   - **Security disclaimer**: Yes
   - **Expiry warning**: 10 minutes
3. Submit for review (usually approved within minutes)

### 5. Generate a Permanent Access Token

1. Go to [business.facebook.com/settings/system-users](https://business.facebook.com/settings/system-users)
2. Create a **System User** with Admin role
3. Click **Generate Token** → select your app → grant `whatsapp_business_messaging` permission
4. Copy the token (shown only once)

### 6. Set Environment Variables

Add to `backend/.env`:

```env
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_permanent_access_token
```

### Important Notes

- **Test mode**: The test phone number can only send to numbers manually added in WhatsApp → Getting Started → "To" field
- **Production**: Verify your business and get your phone number approved to send to any number
- **Phone format**: Numbers must be in E.164 format (e.g. `212600000000` for Morocco — country code + number without leading 0)
- **Cost**: ~$0.03 per authentication message to Morocco

---

## Additional Resources

- API docs: http://localhost:8000/docs
- DB models: `backend/models/`
- Frontend routes: `frontend/src/routes.tsx`
- Extension manifest: `extension/public/manifest.json`
- Architecture: `README.md`
