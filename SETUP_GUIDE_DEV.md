# PharmaGest -- Developer Setup Guide

Complete setup instructions for local development.

---

## 1. Prerequisites

- **Python 3.12+** (for backend)
- **Node.js 20+** (for frontend and extension)
- **Docker & Docker Compose** (for PostgreSQL)
- **Google Chrome** (for extension testing)

---

## 2. Quick Start

### Option A: One Command

```bash
make dev
```

This installs dependencies, starts the database, runs the seed, and launches both backend and frontend dev servers.

### Option B: Step by Step

```bash
# 1. Install all dependencies (Python venv, npm packages for frontend + extension)
make install

# 2. Start PostgreSQL via Docker
make db

# 3. Seed admin + owner accounts and import catalog (16k products)
make seed

# 4. Start backend dev server (port 8000)
make back-dev

# 5. In another terminal, start frontend dev server (port 5173)
make front-dev
```

| Service   | URL                        |
|-----------|----------------------------|
| Frontend  | http://localhost:5173      |
| API       | http://localhost:8000      |
| API Docs  | http://localhost:8000/docs |

---

## 3. Environment Configuration

Environment files live in the `env/` folder, organized by target:

```
env/
├── dev/
│   ├── .env.backend
│   └── .env.frontend
├── demo/
│   ├── .env.backend
│   └── .env.frontend
├── prod/
│   ├── .env.backend
│   └── .env.frontend
└── test/
    └── .env.backend
```

The `APP_ENV` variable controls which folder is loaded at runtime. For local development:

```bash
APP_ENV=dev   # loads env/dev/.env.backend and env/dev/.env.frontend
```

Key variables in `env/dev/.env.backend`:

```env
DATABASE_URL=postgresql://apcm:apcm@localhost:5432/apcm
SECRET_KEY=<generate-with: python3 -c "import secrets; print(secrets.token_urlsafe(32))">
ACCESS_TOKEN_EXPIRE_MINUTES=10080
CORS_ORIGINS=http://localhost:5173
APP_ENV=dev
```

To switch environments, change `APP_ENV` or use the appropriate Makefile target (`make dev`, `make demo`, `make prod`).

---

## 4. Database

### Start PostgreSQL

```bash
make db
```

This runs `docker compose up -d` for PostgreSQL 16 on port 5432 and waits for the healthcheck.

### Seed Data

```bash
make seed
```

The seed script creates two accounts and imports the product catalog:

| Role  | Email           | Password  | Pharmacy        |
|-------|-----------------|-----------|-----------------|
| Admin | admin@gmail.com | admin@123 | --              |
| Owner | owner@gmail.com | owner@123 | Pharmacie Demo  |

It also imports `catalog.csv` (16,282 medicaments) into the product catalog.

### Database Management

```bash
make db                                          # start PostgreSQL
docker compose stop                              # stop container (keep data)
make down                                        # stop + delete data
make db-clean                                    # clear all rows via script
docker compose exec db psql -U apcm -d apcm     # psql shell
docker compose logs db                           # view DB logs
```

### Full Reset

```bash
make down && make db && make seed
```

---

## 5. Running Tests

The project has 298 tests across backend, frontend, and extension.

### Run All Tests

```bash
make test
```

### Run by Module

```bash
make test-back     # backend tests (pytest)
make test-front    # frontend tests (vitest)
make test-ext      # extension tests (vitest)
```

The test suite uses `APP_ENV=test` which loads `env/test/.env.backend` with a separate test database.

---

## 6. Chrome Extension

### Build

```bash
make ext-build
```

### Load in Chrome

1. Go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select `extension/dist/`
4. Pin the extension to your toolbar

### Development Mode (Hot Reload)

```bash
make ext-dev
```

The extension connects to the dashboard automatically when you log in. It intercepts CSV exports from Sobrus (`app.pharma.sobrus.com`) and sends them directly to the backend.

---

## 7. Project Conventions

- **All filenames**: camelCase everywhere (`useMe.ts`, `loginForm.tsx`, `tableToolbar.tsx`)
- **Logic in hooks, not components**: Pages/components are thin UI; all TanStack Query/Mutation logic lives in `hooks/`
- **API calls in `api/` only**: Never call `fetch` directly in a component
- **Enums for all string constants**: Roles, statuses, request types, category types -- never hardcode string literals
  - Frontend: `eUserRole`, `eUserStatus`, `eRequestStatus`, `eRequestType`, `eCategoryType` in `types/index.ts`
  - Backend: `Role`, `Status`, `RequestStatus`, `RequestType` in `utils/constants.py`
- **Zod schemas in `schemas/`**: Form validation + `useForm` hooks live in schema files, not in UI components
- **French error messages**: All user-facing error messages and labels are in French
- **`utils/cn.ts`** is the single `cn()` utility

---

## 8. WhatsApp OTP Setup (Optional)

The app supports password reset via WhatsApp OTP using Meta's Cloud API. This is optional for local development.

### 1. Create Meta Business & Developer Accounts

- Create a business account at [business.facebook.com](https://business.facebook.com)
- Create a developer account at [developers.facebook.com](https://developers.facebook.com)

### 2. Create a Meta App

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps) and click **Create App**
2. Choose **"Business"** type
3. Name it (e.g. "PharmaGest"), select your business account
4. On the app dashboard, find **WhatsApp** and click **Set Up**

### 3. Add a Phone Number

1. In WhatsApp > **Getting Started**, Meta provides a test phone number (free)
2. To use your own: go to **Phone Numbers** > **Add Phone Number** and verify via SMS/call
3. Note your **Phone Number ID** (displayed on the page)

### 4. Create the Authentication Template

1. Go to **WhatsApp** > **Message Templates** > **Create Template**
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
3. Click **Generate Token**, select your app, grant `whatsapp_business_messaging` permission
4. Copy the token (shown only once)

### 6. Set Environment Variables

Add to `env/dev/.env.backend`:

```env
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_permanent_access_token
```

### Important Notes

- **Test mode**: The test phone number can only send to numbers manually added in WhatsApp > Getting Started > "To" field
- **Production**: Verify your business and get your phone number approved to send to any number
- **Phone format**: Numbers must be in E.164 format (e.g. `212600000000` for Morocco -- country code + number without leading 0)
- **Cost**: ~$0.03 per authentication message to Morocco

---

## 9. Troubleshooting

### Database Connection Error

```bash
docker compose ps      # check if container is running
make down && make db   # restart from scratch
```

Verify that `DATABASE_URL` in `env/dev/.env.backend` matches the Docker Compose PostgreSQL credentials.

### Wrong Environment Loaded

If the app behaves unexpectedly, check which env is active:

```bash
echo $APP_ENV   # should be "dev" for local development
```

To switch back to dev after running demo or prod:

```bash
make back-dev   # restarts backend with APP_ENV=dev
```

### Port Already in Use

```bash
lsof -ti:8000 | xargs kill -9   # free port 8000
lsof -ti:5173 | xargs kill -9   # free port 5173
```

### Seed Errors

The seed is idempotent -- "already exists" messages are normal. To fully reset:

```bash
make down && make db && make seed
```

### Extension Not Capturing

1. Extension is loaded and enabled in Chrome
2. You are logged in to the dashboard
3. Extension popup shows green connected badge
4. You are on a Sobrus export page (`app.pharma.sobrus.com`)

---

## Makefile Commands Reference

| Command          | Description                                      |
|------------------|--------------------------------------------------|
| `make dev`       | Full dev start (DB + seed + backend + frontend)  |
| `make back-dev`  | Backend only (port 8000)                         |
| `make front-dev` | Frontend only (port 5173)                        |
| `make test`      | Run all 298 tests                                |
| `make test-back` | Backend tests only (pytest)                      |
| `make test-front`| Frontend tests only (vitest)                     |
| `make test-ext`  | Extension tests only (vitest)                    |
| `make demo`      | Build and run full demo in Docker                |
| `make prod`      | Production build and deploy                      |
| `make db`        | Start PostgreSQL container                       |
| `make seed`      | Seed accounts + catalog                          |
| `make down`      | Stop and remove all containers + data            |
| `make ext-build` | Build Chrome extension                           |
| `make ext-dev`   | Extension dev mode (hot reload)                  |
