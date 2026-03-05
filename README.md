# PharmaGest

Pharmacy management system with dashboard, inventory, sales tracking, and reporting.

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js 18+

### Installation

```bash
cd dashboard
make install
```

This installs both backend (FastAPI + SQLAlchemy) and frontend (React + Refine).

### Run Development Servers

```bash
make dev
```

This starts:
- Backend API: `http://localhost:8000`
- Frontend: `http://localhost:5173`

Or run separately:
```bash
make dev-backend  # Backend only
make dev-frontend # Frontend only
```

### Environment Setup

On first run, `.env` is created from `.env.example`. Update `SECRET_KEY` in `backend/.env` before production use.

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy, SQLite
- **Frontend**: React, TypeScript, Refine, shadcn/ui, Tailwind CSS

## License

© 2026 PharmaGest
