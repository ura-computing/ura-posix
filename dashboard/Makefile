BACKEND_DIR := backend
FRONTEND_DIR := frontend
VENV := $(BACKEND_DIR)/.venv
PIP := $(VENV)/bin/pip
UVICORN := $(VENV)/bin/uvicorn

.PHONY: install install-backend install-frontend dev dev-backend dev-frontend env

env:
	@if [ ! -f $(BACKEND_DIR)/.env ]; then \
		cp $(BACKEND_DIR)/.env.example $(BACKEND_DIR)/.env; \
		echo "Created $(BACKEND_DIR)/.env — update SECRET_KEY before use."; \
	fi

install: install-backend install-frontend

install-backend:
	python3 -m venv $(VENV)
	$(PIP) install -r $(BACKEND_DIR)/requirements.txt

install-frontend:
	cd $(FRONTEND_DIR) && npm install

dev-backend: env
	cd $(BACKEND_DIR) && ../$(UVICORN) main:app --reload --port 8000

dev-frontend:
	cd $(FRONTEND_DIR) && npm run dev

dev:
	@$(MAKE) dev-backend &
	@$(MAKE) dev-frontend
