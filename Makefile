BACKEND_DIR   := backend
FRONTEND_DIR  := frontend
EXTENSION_DIR := extension

VENV      := $(BACKEND_DIR)/.venv
PIP       := $(VENV)/bin/pip
UVICORN   := $(VENV)/bin/uvicorn
SQLITE_WEB := $(VENV)/bin/sqlite_web

.PHONY: install install-backend install-frontend install-extension \
        dev dev-backend dev-frontend dev-extension \
        build-extension env db

# ── Setup ──────────────────────────────────────────────────────────────────────

env:
	@if [ ! -f $(BACKEND_DIR)/.env ]; then \
		cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env; \
		echo "Created $(BACKEND_DIR)/.env — update SECRET_KEY before use."; \
	fi

install: install-backend install-frontend install-extension

install-backend:
	python3 -m venv $(VENV)
	$(PIP) install -r $(BACKEND_DIR)/requirements.txt

install-frontend:
	cd $(FRONTEND_DIR) && npm install

install-extension:
	cd $(EXTENSION_DIR) && npm install

# ── Dev servers ────────────────────────────────────────────────────────────────

dev-backend: env
	cd $(BACKEND_DIR) && .venv/bin/uvicorn main:app --reload --port 8000

dev-frontend:
	cd $(FRONTEND_DIR) && npm run dev

dev-extension:
	cd $(EXTENSION_DIR) && npm run dev

# Run backend + frontend together (extension is loaded directly in Chrome)
dev:
	@$(MAKE) dev-backend &
	@$(MAKE) dev-frontend

# ── Build ──────────────────────────────────────────────────────────────────────

build-extension:
	cd $(EXTENSION_DIR) && npm run build

# ── Database ───────────────────────────────────────────────────────────────────

db:
	$(SQLITE_WEB) $(BACKEND_DIR)/pharmagest.db --port 8080 --no-browser
