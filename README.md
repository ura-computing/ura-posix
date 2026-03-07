# PharmaGest - Pharmacy Management System

A pharmacy management system built for importing and analyzing sales/purchase data from Sobrus, with a dashboard for inventory, sales tracking, and reporting.

## Tech Stack

### Backend
- **FastAPI** + **SQLAlchemy 2.0** — REST API
- **PostgreSQL 16** (Docker) — Database
- **python-jose** + **bcrypt** — JWT authentication
- **Cloudinary** — Profile photo uploads

### Frontend
- **React 19** + **TypeScript** + **Vite**
- **Refine** — Admin panel framework
- **shadcn/ui** + **Tailwind CSS** — UI components

### Chrome Extension
- **React 19** + **TypeScript** + **Vite** + **@crxjs/vite-plugin** (MV3)
- DOM table extraction from Sobrus — selects a table area on screen and extracts data

### Infrastructure
- **Docker Compose** — PostgreSQL + CloudBeaver
- **CloudBeaver** — Web-based database UI (http://localhost:8080)

## Project Structure

```
apcm-pharma/
├── backend/              # FastAPI app
│   ├── main.py
│   ├── models.py
│   ├── database.py
│   ├── schemas.py
│   ├── routers/          # auth, vente, achat, uploads, data
│   ├── utils/            # JWT auth helpers
│   ├── .env              # Server secrets (not committed)
│   └── requirements.txt
├── frontend/             # React dashboard
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── providers/
│   │   └── routes.tsx
│   └── .env              # VITE_ public vars (not committed)
├── extension/            # Chrome Extension (MV3)
│   └── src/
│       ├── background/   # Message relay
│       ├── content/      # DOM table extraction
│       └── popup/        # Extension UI
├── docker-compose.yml    # PostgreSQL + CloudBeaver
├── .env                  # Docker credentials (not committed)
└── Makefile
```

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker + Docker Compose

### 1. Environment Setup

Copy the example env files and fill in your values:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 2. Install Dependencies

```bash
make install
```

### 3. Start the Database

```bash
make db
```

### 4. Run the App

```bash
# Backend (starts DB automatically, creates tables on first run)
make back-dev

# Frontend (in a separate terminal)
make front-dev
```

### 5. Database UI (optional)

```bash
make db-ui
# Opens http://localhost:8080
```

First-time CloudBeaver setup:
- Go through the wizard, leave **Login** as `cbadmin`
- Set a strong password
- Add a PostgreSQL connection: host `db`, port `5432`, db/user/pass `pharmagest`

## Available Commands

```bash
make install       # Install all dependencies (backend + frontend + extension)
make db            # Start PostgreSQL in Docker
make db-ui         # Start PostgreSQL + CloudBeaver, open browser
make down          # Stop Docker containers

make back-dev      # Start backend (auto-starts DB, creates tables)
make front-dev     # Start frontend

make ext-dev       # Start extension in dev mode
make ext-build     # Build extension for Chrome

make dev           # Start backend + frontend together
```

## Environment Variables

### `.env` (root) — Docker only
```env
POSTGRES_DB=pharmagest
POSTGRES_USER=pharmagest
POSTGRES_PASSWORD=pharmagest
```

### `backend/.env` — Server secrets
```env
DATABASE_URL=postgresql://pharmagest:pharmagest@localhost:5432/pharmagest
SECRET_KEY=your_secret_key
FRONTEND_URL=http://localhost:5173
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### `frontend/.env` — Public vars (VITE_ prefix)
```env
VITE_BACKEND_BASE_URL=http://localhost:8000/
VITE_API_URL=http://localhost:8000
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
```

## API Endpoints

- `POST /auth/signup` — Register
- `POST /auth/login` — Login (returns JWT)
- `GET /auth/me` — Current user
- `POST /upload/ventes` — Upload Sobrus ventes CSV
- `POST /upload/achats` — Upload Sobrus achats CSV
- `GET /ventes` — List sales
- `GET /achats` — List purchases
- `GET /data` — Dashboard data
