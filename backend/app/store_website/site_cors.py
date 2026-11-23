"""CORS for `/v1/store-public/*`: a downloaded store calls from its own domain, not the app's. Any origin gets the
headers here; the route itself refuses a wrong key or a domain that is not the store's (`public_router`).
Added after (= outside) the app's CORSMiddleware, which would refuse these origins."""

from __future__ import annotations

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

PREFIX = "/v1/store-public"


def _headers(origin: str) -> dict[str, str]:
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
        "Access-Control-Max-Age": "600",
        "Vary": "Origin",
    }


class StoreSiteCors(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin")
        if not request.url.path.startswith(PREFIX) or not origin:
            return await call_next(request)
        if request.method == "OPTIONS":
            return Response(status_code=204, headers=_headers(origin))
        response = await call_next(request)
        response.headers.update(_headers(origin))
        return response
