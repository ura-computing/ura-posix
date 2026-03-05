# Table Screenshot Extension - Project Management
# Author: Mohammed Hrima
# Description: Chrome extension for capturing and parsing table data from screenshots

.PHONY: help backend extension demo clean

# Default target
help:
	@echo "Table Screenshot Extension - Available Commands:"
	@echo ""
	@echo "  backend    - Manage Python backend (install/run)"
	@echo "  extension  - Build Chrome extension"
	@echo "  demo       - Run demo application"
	@echo "  clean      - Clean all generated files"
	@echo ""
	@echo "Usage examples:"
	@echo "  make backend    # Install deps and run backend"
	@echo "  make extension  # Build Chrome extension"
	@echo "  make demo       # Run demo app"
	@echo "  make clean      # Clean everything"

# Backend management
backend:
	@echo "🔧 Managing Python backend..."
	@if [ ! -d ".venv" ]; then \
		echo "Creating Python virtual environment..."; \
		python3 -m venv .venv; \
	fi
	@echo "Installing backend dependencies..."
	@.venv/bin/python -m pip install --upgrade pip
	@.venv/bin/python -m pip install -r backend/requirements.txt
	@echo "Installing Tesseract OCR..."
	@if command -v brew >/dev/null 2>&1; then \
		brew install tesseract || echo "Tesseract already installed"; \
	elif command -v apt-get >/dev/null 2>&1; then \
		sudo apt-get update && sudo apt-get install -y tesseract-ocr; \
	else \
		echo "Please install Tesseract OCR manually: https://github.com/tesseract-ocr/tesseract"; \
	fi
	@echo "🔄 Restarting backend server..."
	@pkill -f "python.*app.py" || true
	@sleep 2
	@cd backend && ../.venv/bin/python app.py

# Extension management
extension:
	@echo "🔧 Building Chrome extension..."
	@if [ ! -d "extension/node_modules" ]; then \
		echo "Installing extension dependencies..."; \
		cd extension && npm install; \
	fi
	@echo "Building extension..."
	@cd extension && npm run build
	@echo "✅ Extension built successfully!"
	@echo "📦 Load in Chrome: chrome://extensions/ -> Load unpacked -> extension/build"
	@echo "� Tip: On macOS, you may need to grant accessibility permissions for auto-loading"

# Demo application
demo:
	@echo "🔧 Starting demo application..."
	@if [ ! -d "demo/node_modules" ]; then \
		echo "Installing demo dependencies..."; \
		cd demo && npm install; \
	fi
	@echo "Starting demo server..."
	@cd demo && npm run dev

# Clean everything
clean:
	@echo "🧹 Cleaning all generated files..."
	@pkill -f "python.*app.py" || true
	@pkill -f "npm.*dev" || true
	@sleep 1
	@rm -rf .venv
	@rm -rf backend/screenshots/*
	@rm -rf backend/exports/*
	@rm -rf extension/build/
	@rm -rf extension/dist/
	@rm -rf demo/dist/
	@echo "✅ Cleanup complete!"

# Development setup
dev-setup:
	@echo "🚀 Setting up development environment..."
	@echo "Skipping system Python packages (externally managed)..."
	@echo "Installing Node.js dependencies..."
	@npm install -g npm
	@echo "Setting up backend..."
	@make backend
	@echo "Setting up extension..."
	@make extension
	@echo "Setting up demo..."
	@make demo
	@echo "✅ Development setup complete!"

# Production build
build: clean extension
	@echo "🏗️ Production build complete!"
