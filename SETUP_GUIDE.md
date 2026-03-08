# PharmaGest Setup Guide

Complete setup instructions for the PharmaGest pharmacy management system.

---

## Prerequisites

- **Python 3.10+** (for backend)
- **Node.js 18+** (for frontend and extension)
- **Docker & Docker Compose** (for PostgreSQL)
- **Google Chrome** (for extension)

---

## Quick Start

### 1. Clone and Install Dependencies

```bash
# Install all dependencies (backend, frontend, extension)
make install
```

This will:
- Create Python virtual environment in `backend/.venv`
- Install Python packages from `backend/requirements.txt`
- Install Node packages for frontend and extension

### 2. Configure Environment

```bash
# Copy environment template
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set:
```env
DATABASE_URL=postgresql://pharmagest:password@localhost:5432/pharmagest
SECRET_KEY=your-super-secret-key-change-this
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
```

**Important**: Generate a secure `SECRET_KEY` for production:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 3. Start Database

```bash
# Start PostgreSQL container
make db
```

This will:
- Pull PostgreSQL 16 image
- Start container on port 5432
- Create database with credentials from `.env`
- Wait for database to be ready (healthcheck)

### 4. Seed Default Accounts

```bash
# Create default admin and owner accounts
make seed
```

This creates:
- **Admin account**: `admin@gmail.com` / `admin@123`
- **Owner account**: `owner@gmail.com` / `owner@123`
- **Default pharmacy**: "Pharmacie Demo"

**Output:**
```
✓ Created default pharmacy: Pharmacie Demo (ID: 1)
✓ Created admin account: admin@gmail.com / admin@123
✓ Created owner account: owner@gmail.com / owner@123
  → Assigned to pharmacy: Pharmacie Demo

============================================================
Database seeded successfully!
============================================================

Default Accounts:
  Admin:  admin@gmail.com / admin@123
  Owner:  owner@gmail.com / owner@123

Default Pharmacy: Pharmacie Demo
============================================================
```

**Note**: The seed script is idempotent — it won't create duplicates if run multiple times.

### 5. Start Development Servers

```bash
# Start backend and frontend
make dev
```

This will:
- Start FastAPI backend on `http://localhost:8000`
- Start React frontend on `http://localhost:5173`

**Access the application:**
- Dashboard: http://localhost:5173
- API Docs: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

### 6. Install Chrome Extension

```bash
# Build the extension
cd extension
npm run build
```

**Load in Chrome:**
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select the `extension/build` directory
5. Pin the extension to toolbar

---

## Default Accounts

### Admin Account
- **Email**: admin@gmail.com
- **Password**: admin@123
- **Role**: admin
- **Permissions**: Full system access, user management, pharmacy management

### Owner Account
- **Email**: owner@gmail.com
- **Password**: owner@123
- **Role**: owner
- **Pharmacy**: Pharmacie Demo
- **Permissions**: Manage own pharmacy data, request catalog additions

---

## Database Schema

The seed script creates the following structure:

```
pharmacies
├── id: 1
├── name: "Pharmacie Demo"
├── address: "123 Rue Mohammed V, Casablanca"
├── phone: "+212 5 22 12 34 56"
└── email: "contact@pharmacie-demo.ma"

users
├── Admin
│   ├── email: admin@gmail.com
│   ├── role: admin
│   ├── status: active
│   ├── profile_complete: true
│   └── pharmacy_id: null
└── Owner Demo
    ├── email: owner@gmail.com
    ├── role: owner
    ├── status: active
    ├── profile_complete: true
    └── pharmacy_id: 1
```

---

## Development Workflow

### Starting Fresh

```bash
# Stop and remove database
make down

# Start database
make db

# Seed default accounts
make seed

# Start dev servers
make dev
```

### Individual Commands

```bash
# Backend only
make back-dev

# Frontend only
make front-dev

# Extension development mode
make ext-dev

# Extension production build
make ext-build
```

### Database Management

```bash
# Start database
make db

# Stop database (keeps data)
docker compose stop

# Stop and remove database (deletes data)
make down

# View database logs
docker compose logs db

# Access PostgreSQL CLI
docker compose exec db psql -U pharmagest -d pharmagest
```

---

## Testing the Setup

### 1. Test Backend API

```bash
# Health check
curl http://localhost:8000/health

# Login as admin
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gmail.com","password":"admin@123"}'
```

### 2. Test Dashboard

1. Open http://localhost:5173
2. Login with `admin@gmail.com` / `admin@123`
3. You should see the dashboard with sidebar navigation

### 3. Test Extension

1. Login to dashboard first (to get JWT token)
2. Navigate to a Sobrus export page
3. Extension should show "APCM Pharma actif" indicator
4. Click "Télécharger en CSV" to test auto-capture

---

## Troubleshooting

### Database Connection Error

**Error**: `could not connect to server: Connection refused`

**Solution**:
```bash
# Check if database is running
docker compose ps

# Restart database
make down
make db
```

### Seed Script Error: "Admin account already exists"

This is normal — the seed script is idempotent and won't create duplicates.

### Extension Not Capturing Data

**Check**:
1. Extension is loaded and enabled in Chrome
2. You're logged in to the dashboard
3. Token is synced (check extension popup for green status)
4. You're on a Sobrus export page

### Port Already in Use

**Error**: `Address already in use: 8000` or `5173`

**Solution**:
```bash
# Find and kill process using port 8000
lsof -ti:8000 | xargs kill -9

# Find and kill process using port 5173
lsof -ti:5173 | xargs kill -9
```

---

## Production Deployment

### Environment Variables

Update `backend/.env` for production:
```env
DATABASE_URL=postgresql://user:pass@prod-host:5432/pharmagest
SECRET_KEY=<generate-new-secure-key>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080
```

### Security Checklist

- [ ] Generate new `SECRET_KEY`
- [ ] Use strong database password
- [ ] Restrict CORS origins in `backend/main.py`
- [ ] Enable HTTPS
- [ ] Set up database backups
- [ ] Configure firewall rules
- [ ] Use environment-specific `.env` files
- [ ] Never commit `.env` to version control

### Database Migrations

For production, use Alembic for schema migrations:

```bash
# Install Alembic
pip install alembic

# Initialize Alembic
alembic init alembic

# Create migration
alembic revision --autogenerate -m "Initial schema"

# Apply migration
alembic upgrade head
```

---

## Additional Resources

- **API Documentation**: http://localhost:8000/docs (Swagger UI)
- **Database Schema**: See `backend/models.py`
- **Frontend Routes**: See `frontend/src/routes.tsx`
- **Extension Manifest**: See `extension/public/manifest.json`

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the README.md for architecture details
3. Check the TECHNICAL_LEARNING.md for in-depth explanations

---

© 2026 PharmaGest. All rights reserved.
