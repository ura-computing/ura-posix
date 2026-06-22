FROM python:3.12-slim

# Static binaries needed by the entrypoint: psql (libpq client), curl (health probe).
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# uv for fast deterministic Python installs — mirrors the dev workflow.
COPY --from=ghcr.io/astral-sh/uv:0.5.4 /uv /usr/local/bin/uv

WORKDIR /app
ENV UV_PROJECT_ENVIRONMENT=/app/.venv \
    PATH=/app/.venv/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Dependency layer first so app-code changes don't bust the wheel cache.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# App source + entrypoint.
COPY . .
RUN chmod +x ./entrypoint.sh

# Non-root for runtime.
RUN useradd -m -r -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
CMD ["./entrypoint.sh"]
