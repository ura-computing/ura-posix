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

from app.core.errors import ErrorCode, error_body


def client_ip(request: Request) -> str:
    """The visitor's IP. Behind DigitalOcean's router (and the gateway) every request comes from the router's address:
    keyed on it, « 5 logins / min » was shared by every user of the app. DigitalOcean puts the real address in
    `do-connecting-ip`; without it (dev, E2E) the direct client."""
    return request.headers.get("do-connecting-ip") or get_remote_address(request)


limiter = Limiter(key_func=client_ip, enabled=os.environ.get("RATE_LIMIT", "1") != "0")


def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """429 with a translatable code. Replaces slowapi's default English message."""
    return JSONResponse(
        status_code=429,
        content=error_body(ErrorCode.TOO_MANY_ATTEMPTS, "Trop de tentatives. Réessayez dans quelques minutes."),
    )
