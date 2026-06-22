from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded

from config import settings
from rate_limit import limiter, rate_limit_handler
from routers import admin_catalog, admin_stats, auth, category_suffixes, data, health, sessions, special_products, stats, transactions, uploads


app = FastAPI(title="PharmaGest", version="0.1.0")

# CORS — exact-match the configured frontend origin. allow_credentials must be
# True because the frontend sends httpOnly cookies (access_token, session_token).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Requested-With"],
)

# slowapi: register the limiter on app.state so the @limiter.limit decorators
# can find it via request.app.state.limiter, and translate 429s to French.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

app.include_router(health.router,   prefix="/v1")
app.include_router(auth.router,     prefix="/v1/auth")
app.include_router(sessions.router, prefix="/v1/sessions")
app.include_router(stats.router,         prefix="/v1")
app.include_router(admin_stats.router,   prefix="/v1")
app.include_router(admin_catalog.router, prefix="/v1")
app.include_router(uploads.router,      prefix="/v1")
app.include_router(transactions.router, prefix="/v1")
app.include_router(data.router,             prefix="/v1")
app.include_router(category_suffixes.router, prefix="/v1")
app.include_router(special_products.router,  prefix="/v1/special-products")