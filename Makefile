BACKEND_DIR  := ./backend
FRONTEND_DIR := ./frontend

.PHONY: help dev backend frontend cli migrate

help:
	@echo "PharmaGest dev commands:"
	@echo "  make dev       — run backend + frontend together (Ctrl+C kills both)"
	@echo "  make backend   — run only the backend (uvicorn on :8000, logs to stdout)"
	@echo "  make frontend  — run only the frontend (Vite dev server)"
	@echo "  make cli       — interactive Python CLI to test the API"
	@echo "  make migrate   — apply Alembic migrations"

# Run backend + frontend in parallel; Ctrl+C kills both
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