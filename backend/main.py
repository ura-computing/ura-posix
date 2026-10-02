from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi.errors import RateLimitExceeded

from config import settings
from errors import ApiError, api_error_handler, validation_error_handler
from rate_limit import limiter, rate_limit_handler
from routers import accounting, admin_pharmacies, auth, catalog, exclusions, health, imports, owner_employees, stats, store_website, transactions


app = FastAPI(title="PharmaGest", version="0.1.0")

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

app.include_router(health.router,           prefix="/v1")
app.include_router(auth.router,             prefix="/v1")
app.include_router(stats.router,            prefix="/v1")
app.include_router(catalog.router,          prefix="/v1")
app.include_router(admin_pharmacies.router, prefix="/v1")
app.include_router(owner_employees.router,  prefix="/v1")
app.include_router(imports.router,          prefix="/v1")
app.include_router(transactions.router,     prefix="/v1")
app.include_router(exclusions.router,       prefix="/v1")
app.include_router(accounting.router,       prefix="/v1")
app.include_router(store_website.router,    prefix="/v1")