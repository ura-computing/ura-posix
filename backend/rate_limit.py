"""Centralised slowapi limiter. Imported by both main.py (to register the
middleware + exception handler) and routers/*.py (to decorate endpoints).

Storage: in-memory. Fine for a single-instance deploy on DigitalOcean App
Platform. If we ever scale horizontally, swap for Redis via
`Limiter(key_func=..., storage_uri="redis://...")`.
"""
from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address


limiter = Limiter(key_func=get_remote_address)


def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """French 429 response. Replaces slowapi's default English message."""
    return JSONResponse(
        status_code=429,
        content={"detail": "Trop de tentatives. Réessayez dans quelques minutes."},
    )