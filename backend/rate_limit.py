"""Centralised slowapi limiter. Imported by both main.py (to register the
middleware + exception handler) and routers/*.py (to decorate endpoints).

Storage: in-memory. Fine for a single-instance deploy on DigitalOcean App
Platform. If we ever scale horizontally, swap for Redis via
`Limiter(key_func=..., storage_uri="redis://...")`.

RATE_LIMIT=0 turns the limits off — only the E2E suite does that (it logs in
more than 5 times a minute). Default: on.
"""

import os

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from errors import ErrorCode, error_body


limiter = Limiter(key_func=get_remote_address, enabled=os.environ.get("RATE_LIMIT", "1") != "0")


def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """429 with a translatable code. Replaces slowapi's default English message."""
    return JSONResponse(
        status_code=429,
        content=error_body(ErrorCode.TOO_MANY_ATTEMPTS, "Trop de tentatives. Réessayez dans quelques minutes."),
    )
