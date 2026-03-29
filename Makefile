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
	db db-ui down docker-env env check-env install dev build serve seed db-clean start demo prod

# ── Environment ────────────────────────────────────────────────────────────────

# TODO: add MAIL_USERNAME MAIL_PASSWORD WHATSAPP_PHONE_NUMBER_ID WHATSAPP_ACCESS_TOKEN once configured
REQUIRED_BACKEND_VARS := DATABASE_URL SECRET_KEY FRONTEND_URL

env:
	@if [ ! -f $(BACKEND_DIR)/.env ]; then \
		cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env; \
		echo "Created $(BACKEND_DIR)/.env — update required variables before starting."; \
	fi

check-env: env
	@missing=""; \
	for var in $(REQUIRED_BACKEND_VARS); do \
		val=$$(grep -E "^$$var=" $(BACKEND_DIR)/.env 2>/dev/null | cut -d= -f2-); \
		if [ -z "$$val" ] || echo "$$val" | grep -qE "^your_|^your-"; then \
			missing="$$missing  - $$var\n"; \
		fi; \
	done; \
	if [ -n "$$missing" ]; then \
		echo ""; \
		echo "============================================================"; \
		echo "FATAL: Missing or unconfigured environment variables:"; \
		printf "$$missing"; \
		echo "============================================================"; \
		echo "Set them in $(BACKEND_DIR)/.env and try again."; \
		echo ""; \
		exit 1; \
	fi

docker-env:
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env — update required variables before starting."; \
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

back-seed: check-env db
	cd $(BACKEND_DIR) && .venv/bin/python seed.py

back-db-clean: env db
	cd $(BACKEND_DIR) && .venv/bin/python db_clean.py

back-dev: check-env db back-install
	cd $(BACKEND_DIR) && .venv/bin/uvicorn main:app --reload --port 8000

back-build: back-install

back-prod: check-env db
	cd $(BACKEND_DIR) && .venv/bin/uvicorn main:app --port 8000

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

# ── Dev environment (local Vite dev servers + local DB) ───────────────────────

dev:
	@$(MAKE) back-dev &
	@$(MAKE) front-dev

start: install check-env db seed dev

# ── Demo environment (Docker Compose — full stack in containers) ──────────────

demo: docker-env check-env front-install front-build ext-install ext-build
	docker compose up --build

# ── Prod environment (optimised backend + pre-built frontend, local DB) ───────

prod: build
	@$(MAKE) back-prod &
	@$(MAKE) front-serve

serve: prod
