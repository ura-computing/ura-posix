BACKEND_DIR  := ./backend
FRONTEND_DIR := ./frontend

.PHONY: help dev backend frontend cli migrate demo down clean logs

help:
	@echo "PharmaGest commands:"
	@echo ""
	@echo "  Local dev (no docker):"
	@echo "    make dev       — run backend + frontend together (Ctrl+C kills both)"
	@echo "    make backend   — only the backend (uvicorn :8000, hot reload)"
	@echo "    make frontend  — only the frontend (Vite dev :5173)"
	@echo "    make cli       — interactive Python CLI"
	@echo "    make migrate   — apply Alembic migrations against your local DB"
	@echo ""
	@echo "  Docker demo (one-command setup for clients):"
	@echo "    make demo      — build + run the full stack (postgres + backend + frontend)"
	@echo "                     → Frontend: http://localhost:4173"
	@echo "                     → Login:    admin@gmail.com / admin@123"
	@echo "    make down      — stop containers (DB volume survives)"
	@echo "    make logs      — tail container logs"
	@echo "    make clean     — DESTRUCTIVE: stop + wipe the demo DB volume"

# ── Local dev (no docker) ───────────────────────────────────────────────────

dev:
	@trap 'kill 0' EXIT INT; \
	  $(MAKE) backend & \
	  $(MAKE) frontend & \
	  wait

backend:
	cd $(BACKEND_DIR) && uv run uvicorn main:app --port 8000 --reload

frontend:
	cd $(FRONTEND_DIR) && npm run dev

cli:
	cd $(BACKEND_DIR) && uv run python -m cli

migrate:
	cd $(BACKEND_DIR) && uv run alembic upgrade head

# ── Docker demo (client-shippable) ──────────────────────────────────────────
# Boots postgres + backend + frontend via docker-compose. The backend's
# entrypoint runs `alembic upgrade head` (idempotent against the old apcm-pharma
# schema) + `seed.py` (idempotent — skips if admin already exists).

demo:
	@cp env/demo/docker.env .env
	@cp resources/catalog.csv backend/catalog.csv     # docker build context is ./backend
	@echo "▸ Building containers + applying migrations + seeding…"
	@docker compose up -d --build --wait
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
	@echo "✓ Volume removed. Next `make demo` starts from an empty DB."