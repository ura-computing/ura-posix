BACKEND_DIR  := ./backend
FRONTEND_DIR := ./frontend
DEV_DB       := apcm

.PHONY: help install dev backend worker frontend migrate seed db build build-backend build-frontend demo down clean logs format test tests tests-ui

help:
	@echo "PharmaGest commands:"
	@echo ""
	@echo "  Setup (first-time clone):"
	@echo "    make install  — install backend (uv sync) + frontend (npm install) deps"
	@echo "                    and create gitignored backend/.env + frontend/.env if missing"
	@echo ""
	@echo "  Local dev (dockerized DB + host backend/frontend):"
	@echo "    make dev       — run backend + Sobrus robot + frontend together (Ctrl+C kills all)"
	@echo "    make backend   — only the backend (starts the DB, applies new migrations; uvicorn :8000, hot reload)"
	@echo "    make worker    — only the « Connexion Sobrus » robot (waits for the backend's migrations)"
	@echo "    make frontend  — only the frontend (Vite dev :5173)"
	@echo "    make db        — start the Postgres 17 container + create the dev DB if missing"
	@echo "    make migrate   — apply Alembic migrations against the dev DB + reload product photos"
	@echo "    make seed      — seed admin + owner + catalogue into the dev DB (idempotent)"
	@echo ""
	@echo "  Build:"
	@echo "    make build          — build-backend + build-frontend"
	@echo "    make build-backend  — backend Docker image (the one make demo runs)"
	@echo "    make build-frontend — type check + Vite bundle into frontend/dist"
	@echo ""
	@echo "  Docker demo (one-command setup for clients):"
	@echo "    make demo      — build + run the full stack (postgres + backend + frontend)"
	@echo "                     → Frontend: http://localhost:4173"
	@echo "                     → Login:    admin@gmail.com / admin@123"
	@echo "    make down      — stop containers (DB volume survives)"
	@echo "    make logs      — tail container logs"
	@echo "    make clean     — DESTRUCTIVE: stop + wipe ALL DB volumes (dev, demo, old Postgres 16 backup)"
	@echo ""
	@echo "  Code style:"
	@echo "    make format    — format the whole repo (Prettier: frontend + e2e, ruff: backend)"
	@echo ""
	@echo "  End-to-end tests (Playwright — asks its options, Enter = default):"
	@echo "    make tests     — every test, headless (make tests 99 / 06 15: only those test files)"
	@echo "    make tests-ui  — one test file (or all) in a real browser, slowed down"

# ── Setup (fresh clone) ─────────────────────────────────────────────────────

# One-command setup for a fresh clone: install backend + frontend deps and
# provision the gitignored .env files. The backend .env is generated with dev
# defaults — a DATABASE_URL matching the dockerized Postgres and a fresh random
# JWT_SECRET (the .env.example placeholder would trip the boot-time validator).
# Re-running `make install` is a no-op for existing .env files.
install:
	@echo "▸ Installing backend dependencies…"
	@cd $(BACKEND_DIR) && uv sync
	@echo "▸ Installing frontend dependencies…"
	@cd $(FRONTEND_DIR) && npm install
	@if [ ! -f $(BACKEND_DIR)/.env ]; then \
	  echo "▸ Creating backend/.env (dev defaults + random JWT_SECRET)…"; \
	  printf 'DATABASE_URL=postgresql+psycopg2://apcm:apcm@localhost:5432/%s\nJWT_SECRET=%s\nJWT_ACCESS_EXPIRY_MIN=10080\nCOOKIE_SECURE=false\nFRONTEND_URL=http://localhost:5173\nMAIL_USERNAME=\nMAIL_PASSWORD=\nMAIL_FROM=\n' \
	    "$(DEV_DB)" "$$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')" > $(BACKEND_DIR)/.env; \
	fi
	@if [ ! -f $(FRONTEND_DIR)/.env ]; then \
	  echo "▸ Creating frontend/.env from example…"; \
	  cp $(FRONTEND_DIR)/.env.example $(FRONTEND_DIR)/.env; \
	fi
	@echo "✓ Install complete. Next: make db && make seed && make dev"

# ── Local dev (dockerized Postgres + host-side backend/frontend) ────────────

dev: db
	@trap 'kill 0' EXIT INT; \
	  $(MAKE) backend & \
	  $(MAKE) worker & \
	  $(MAKE) frontend & \
	  wait

# `db` boots the Postgres container (idempotent — no-op if already up) and
# ensures the dev database exists. The container's POSTGRES_DB env only
# creates apcm_demo; we add `apcm` for dev on top of that.
db:
	@if [ -z "$$(docker compose ps -q db)" ] || [ -z "$$(docker compose ps -q --status running db)" ]; then \
	  echo "▸ Starting Postgres container…"; \
	  cp env/demo/docker.env .env 2>/dev/null || true; \
	  docker compose up -d --wait db; \
	fi
	@docker compose exec -T db psql -U apcm -d postgres -tAc \
	  "SELECT 1 FROM pg_database WHERE datname='$(DEV_DB)'" | grep -q 1 || { \
	    echo "▸ Creating dev database '$(DEV_DB)'…"; \
	    docker compose exec -T db psql -U apcm -d postgres -c "CREATE DATABASE $(DEV_DB);"; \
	  }

backend: install db migrate
	cd $(BACKEND_DIR) && uv run uvicorn main:app --port 8000 --reload

# The Sobrus robot, its own process (like the DigitalOcean « Worker »): no migrate here, it waits for the
# backend's (make dev starts both).
worker: db
	cd $(BACKEND_DIR) && uv run python -m app.sobrus.worker

frontend: install
	cd $(FRONTEND_DIR) && npm run dev

migrate: db
	cd $(BACKEND_DIR) && uv run python scripts/bootstrap.py
	cd $(BACKEND_DIR) && uv run python scripts/load_product_infos.py

# Run the same seed.py the docker entrypoint runs — but against the dev DB
# (the backend's local .env / DATABASE_URL).
seed: db migrate
	cd $(BACKEND_DIR) && uv run python scripts/seed.py

# ── Build ───────────────────────────────────────────────────────────────────

build: build-backend build-frontend

build-backend:
	@cp resources/catalog.csv backend/catalog.csv     # docker build context is ./backend (same as demo)
	docker compose build backend

build-frontend:
	cd $(FRONTEND_DIR) && npm run build

# ── Docker demo (client-shippable) ──────────────────────────────────────────
# Boots postgres + backend + frontend via docker-compose. Re-runs are safe:
# the backend's entrypoint inspects DB state and chooses the right path —
#
#   • empty volume        → create_all + alembic stamp head + seed
#   • legacy volume       → align schema + alembic stamp head, seed skipped
#                           (no alembic_version table yet — see bootstrap.py)
#   • managed volume      → alembic upgrade head (pending migrations only),
#                           seed skipped — DATA PRESERVED across the upgrade
#
# `make clean` is the only path that wipes data (drops the docker volume).

demo:
	@cp env/demo/docker.env .env
	@cp resources/catalog.csv backend/catalog.csv     # docker build context is ./backend
	@echo "▸ Building containers + bootstrapping schema (smart)…"
	@# DigitalOcean's limits (env/do/limits.yml: backend 512 MB, Postgres 1 GB / 22 connections). Enter = yes.
	@answer=y; if [ -t 0 ]; then printf "DigitalOcean limits (backend 512 MB, Postgres 1 GB, 22 connections)? (y/n) [y]: "; read -r answer; fi; \
	if [ "$${answer:-y}" = y ]; then docker compose -f docker-compose.yml -f env/do/limits.yml up -d --build --wait; \
	else docker compose up -d --build --wait; fi
	@echo ""
	@echo "✓ Demo ready:"
	@echo "    Frontend : http://localhost:4173"
	@echo "    Backend  : http://localhost:8000"
	@echo "    Login    : admin@gmail.com / admin@123  (or owner@gmail.com / owner@123)"

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

clean:
	docker compose down -v
	@echo "✓ Volume removed. Next 'make demo' starts from an empty DB."

# ── Code style ──────────────────────────────────────────────────────────────
# One style everywhere: Prettier for frontend + e2e (.prettierrc.json, width 120),
# ruff for the backend (pyproject.toml, line-length 120). Rewrites only spacing,
# wrapping and quotes, never what the code does.
format:
	cd $(FRONTEND_DIR) && npx prettier --write --log-level warn --ignore-path ../.prettierignore . ../e2e
	cd $(BACKEND_DIR) && uv run ruff format .

# ── End-to-end (Playwright) ─────────────────────────────────────────────────
# Two commands. The script asks for its inputs (Enter = default); with no
# terminal (git pre-push) it uses the defaults. First run installs Playwright.
#   make tests      headless, every test        make tests 99 / make tests 06 15: only those files
#   make tests-ui   real browser, slowed down; asks which test file (or: make tests-ui 06)

# `make tests 99`, `make tests 06 15`, `make tests-ui ventes`: only those test files (number
# or part of the name; the setup tests 01-02 always run first). `make test` = `make tests`.
ifneq ($(filter test tests tests-ui,$(firstword $(MAKECMDGOALS))),)
SPECS := $(wordlist 2,$(words $(MAKECMDGOALS)),$(MAKECMDGOALS))
ifneq ($(SPECS),)
$(eval $(SPECS):;@:)
endif
endif

test tests:
	@bash e2e/scripts/run.sh tests $(SPECS)

tests-ui:
	@bash e2e/scripts/run.sh ui $(SPECS)