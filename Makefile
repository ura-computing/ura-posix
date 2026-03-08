BACKEND_DIR   := ./backend
FRONTEND_DIR  := ./frontend
EXTENSION_DIR := ./extension

VENV := $(BACKEND_DIR)/.venv
PIP  := $(VENV)/bin/python3 -m pip

.PHONY: \
	back-install back-dev back-seed back-db-clean \
	front-install front-dev \
	ext-install ext-dev ext-build \
	db db-ui down env install dev seed db-clean

# ── Environment ────────────────────────────────────────────────────────────────

env:
	@if [ ! -f $(BACKEND_DIR)/.env ]; then \
		cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env; \
		echo "Created $(BACKEND_DIR)/.env — update SECRET_KEY before use."; \
	fi

# ── Database ───────────────────────────────────────────────────────────────────

db:
	docker compose up -d --wait db
# --remove-orphans

db-ui:
	open tableplus://

down:
	docker compose down

# ── Backend ────────────────────────────────────────────────────────────────────

back-install:
	python3 -m venv $(VENV)
	$(PIP) install -r $(BACKEND_DIR)/requirements.txt

back-seed: env db
	cd $(BACKEND_DIR) && .venv/bin/python seed.py

back-db-clean: env db
	cd $(BACKEND_DIR) && .venv/bin/python db_clean.py

back-dev: env db
	cd $(BACKEND_DIR) && .venv/bin/uvicorn main:app --reload --port 8000

# ── Frontend ───────────────────────────────────────────────────────────────────

front-install:
	cd $(FRONTEND_DIR) && npm install

front-dev:
	cd $(FRONTEND_DIR) && npm run dev

# ── Extension ─────────────────────────────────────────────────────────────────

ext-install:
	cd $(EXTENSION_DIR) && npm install

ext-dev:
	cd $(EXTENSION_DIR) && npm run dev

ext-build:
	cd $(EXTENSION_DIR) && npm run build

# ── Shortcuts ─────────────────────────────────────────────────────────────────

install: back-install front-install ext-install

seed: back-seed

db-clean: back-db-clean

dev:
	@$(MAKE) back-dev &
	@$(MAKE) front-dev
