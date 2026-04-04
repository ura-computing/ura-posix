BACKEND_DIR   := ./backend
FRONTEND_DIR  := ./frontend
EXTENSION_DIR := ./extension
ENV_DIR       := ./env

VENV := $(BACKEND_DIR)/.venv
PIP  := $(VENV)/bin/python3 -m pip

.DEFAULT_GOAL := start

.PHONY: \
	back-install back-dev back-build back-prod back-seed back-db-clean \
	front-install front-dev front-build front-serve \
	ext-install ext-dev ext-build \
	test test-back test-front test-ext test-db \
	db db-ui down check-env install dev build serve seed db-clean start demo prod

# ── Environment ──────────────────────────────────────────────────────────────
# Backend reads directly from env/{APP_ENV}/backend.env (no copy needed).
# Frontend & extension need .env copied because Vite only reads from its own dir.
# Docker Compose reads from root .env (copied from env/{ENV}/docker.env).

# TODO: add MAIL_USERNAME MAIL_PASSWORD WHATSAPP_PHONE_NUMBER_ID WHATSAPP_ACCESS_TOKEN once configured
REQUIRED_BACKEND_VARS := DATABASE_URL SECRET_KEY FRONTEND_URL

_load-env = \
	@cp $(ENV_DIR)/$(1)/docker.env .env; \
	cp $(ENV_DIR)/$(1)/frontend.env $(FRONTEND_DIR)/.env; \
	cp $(ENV_DIR)/$(1)/extension.env $(EXTENSION_DIR)/.env; \
	echo "Loaded $(1) environment from $(ENV_DIR)/$(1)/"

check-env:
	@test -f $(ENV_DIR)/$${APP_ENV:-dev}/backend.env || { echo "ERROR: $(ENV_DIR)/$${APP_ENV:-dev}/backend.env not found"; exit 1; }
	@missing=""; \
	for var in $(REQUIRED_BACKEND_VARS); do \
		val=$$(grep -E "^$$var=" $(ENV_DIR)/$${APP_ENV:-dev}/backend.env 2>/dev/null | cut -d= -f2-); \
		if [ -z "$$val" ] || echo "$$val" | grep -qE "^your_|^your-|^CHANGE_ME"; then \
			missing="$$missing  - $$var\n"; \
		fi; \
	done; \
	if [ -n "$$missing" ]; then \
		echo ""; \
		echo "============================================================"; \
		echo "FATAL: Missing or unconfigured environment variables:"; \
		printf "$$missing"; \
		echo "============================================================"; \
		echo "Set them in $(ENV_DIR)/$${APP_ENV:-dev}/backend.env and try again."; \
		echo ""; \
		exit 1; \
	fi

# ── Database ───────────────────────────────────────────────────────────────────

db:
	docker compose up -d --wait db

db-ui:
	open tableplus://

down:
	docker compose down

# ── Backend ────────────────────────────────────────────────────────────────────

back-install:
	python3 -m venv $(VENV)
	$(PIP) install -r $(BACKEND_DIR)/requirements.txt

back-seed: check-env db
	cd $(BACKEND_DIR) && APP_ENV=$${APP_ENV:-dev} .venv/bin/python seed.py

back-db-clean: db
	cd $(BACKEND_DIR) && APP_ENV=$${APP_ENV:-dev} .venv/bin/python db_clean.py

back-dev: back-install
	$(call _load-env,dev)
	@APP_ENV=dev $(MAKE) check-env
	@docker compose down -v 2>/dev/null || true
	@docker compose up -d --wait db
	cd $(BACKEND_DIR) && APP_ENV=dev .venv/bin/uvicorn main:app --reload --port 8000

back-prod:
	$(call _load-env,prod)
	@APP_ENV=prod $(MAKE) check-env db
	cd $(BACKEND_DIR) && APP_ENV=prod .venv/bin/uvicorn main:app --port 8000

back-build: back-install

# ── Frontend ───────────────────────────────────────────────────────────────────

front-install:
	cd $(FRONTEND_DIR) && npm install

front-dev: front-install
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

db-clean: back-db-clean
seed: back-seed

# ── Tests ─────────────────────────────────────────────────────────────────────

test-db:
	$(call _load-env,dev)
	@docker compose down -v 2>/dev/null || true
	@docker compose up -d --wait db
	@docker compose exec db psql -U apcm -d postgres -c "CREATE DATABASE apcm_test;" 2>/dev/null || true

test-back: back-install test-db
	cd $(BACKEND_DIR) && APP_ENV=test .venv/bin/python -m pytest -v $(ARGS)

test-front: front-install
	cd $(FRONTEND_DIR) && npx vitest run $(ARGS)

test-ext: ext-install
	cd $(EXTENSION_DIR) && npx vitest run $(ARGS)

test: test-back test-front test-ext

# ── Dev environment (local Vite dev servers + local DB) ───────────────────────

dev:
	$(call _load-env,dev)
	@APP_ENV=dev $(MAKE) check-env db back-install
	@APP_ENV=dev $(MAKE) back-dev &
	@$(MAKE) front-dev

start: install
	$(call _load-env,dev)
	@APP_ENV=dev $(MAKE) check-env db seed dev

# ── Demo environment (Docker Compose — separate DB, auto-seed, clean start) ──

demo:
	$(call _load-env,demo)
	@$(MAKE) ext-install ext-build
	@cp resources/catalog.csv $(BACKEND_DIR)/catalog.csv 2>/dev/null || true
	docker compose down -v
	docker compose up --build
	@rm -f $(BACKEND_DIR)/catalog.csv

# ── Prod environment (optimised backend + pre-built frontend, local DB) ───────

prod:
	$(call _load-env,prod)
	@APP_ENV=prod $(MAKE) build check-env db
	@APP_ENV=prod $(MAKE) back-prod &
	@$(MAKE) front-serve

serve: prod
