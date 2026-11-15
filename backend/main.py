from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi.errors import RateLimitExceeded

from importlib import import_module

from app.core import health
from app.core.config import settings
from app.core.errors import ApiError, CatchServerErrors, api_error_handler, validation_error_handler
from app.core.observability import init_sentry
from app.core.rate_limit import limiter, rate_limit_handler
from app.core.services import ROUTER_MODULES, routers_of


init_sentry(settings.SERVICE or "api")

app = FastAPI(title=f"PharmaGest {settings.SERVICE}".strip(), version="0.1.0")

# Crash → JSON 500 `serverError` (« Le logiciel a rencontré un problème »). Added before
# CORS = inside it, so the answer keeps the CORS headers and the browser can read it.
app.add_middleware(CatchServerErrors)

# CORS — exact-match the configured frontend origin. allow_credentials must be
# True because the frontend sends httpOnly cookies (access_token, session_token).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Requested-With"],
)
# Gzip every JSON answer > 1 kB: the 45k-row ventes export goes 17.7 MB → 1.5 MB.
# Level 5: 85 ms on that export (Starlette's default 9: 450 ms for 10 % less).
app.add_middleware(GZipMiddleware, minimum_size=1000, compresslevel=5)

# slowapi: register the limiter on app.state so the @limiter.limit decorators
# can find it via request.app.state.limiter, and answer 429s with a translatable code.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

# Errors carry a `code` the frontend translates (FR / ES) — see errors.py.
app.add_exception_handler(ApiError, api_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)

# Every service answers /v1/health; then its own routers (`SERVICE` env, app/core/services.py; unset = all).
app.include_router(health.router, prefix="/v1")
for name in routers_of(settings.SERVICE):
    app.include_router(import_module(ROUTER_MODULES[name]).router, prefix="/v1")
