BACKEND_DIR   := ./backend
FRONTEND_DIR  := ./frontend
EXTENSION_DIR := ./extension

VENV := $(BACKEND_DIR)/.venv
PIP  := $(VENV)/bin/python3 -m pip

.DEFAULT_GOAL := start

.PHONY: \
	back-install back-dev back-build back-prod back-seed back-db-clean \
	front-install front-dev front-build front-serve \
	ext-install ext-dev ext-build \
	db db-ui down docker-env env install dev build serve seed db-clean start demo

# ── Environment ────────────────────────────────────────────────────────────────

env:
	@if [ ! -f $(BACKEND_DIR)/.env ]; then \
		cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env; \
		echo "Created $(BACKEND_DIR)/.env — update SECRET_KEY before use."; \
	fi

docker-env:
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env — update SECRET_KEY before use."; \
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

back-build: back-install

back-prod: env db
	cd $(BACKEND_DIR) && .venv/bin/uvicorn main:app --port 8000

# ── Frontend ───────────────────────────────────────────────────────────────────

front-install:
	cd $(FRONTEND_DIR) && npm install

front-dev:
	cd $(FRONTEND_DIR) && npm run dev

front-build: front-install
	cd $(FRONTEND_DIR) && npm run build

front-serve:
	cd $(FRONTEND_DIR) && npm run start

# ── Extension ─────────────────────────────────────────────────────────────────

ext-install:
	cd $(EXTENSION_DIR) && npm install

ext-dev:
	cd $(EXTENSION_DIR) && npm run dev

ext-build:
	cd $(EXTENSION_DIR) && npm run build

# ── Shortcuts ─────────────────────────────────────────────────────────────────

install: back-install front-install ext-install

build: back-build front-build ext-build

seed: back-seed

db-clean: back-db-clean

dev:
	@$(MAKE) back-dev &
	@$(MAKE) front-dev

serve:
	@$(MAKE) back-prod &
	@$(MAKE) front-serve

start: install env db seed dev

demo: docker-env front-install front-build ext-install ext-build
	docker compose up --build
