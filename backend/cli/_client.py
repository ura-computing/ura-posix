"""Shared HTTP client. Single instance for the CLI session so cookies persist
across calls (login → /me uses the cookie set by login)."""
from __future__ import annotations

import os
from typing import Any

import httpx


BASE_URL = os.environ.get("PG_CLI_BACKEND", "http://localhost:8000")
API_PREFIX = "/v1"

# Single shared client per CLI run; cookie jar persists.
_client = httpx.Client(
    base_url=BASE_URL,
    timeout=10.0,
    headers={"X-Requested-With": "XMLHttpRequest"},
)


def request(method: str, path: str, **kwargs: Any) -> httpx.Response:
    """Wrapper that prepends /v1 and uses the shared client."""
    return _client.request(method, f"{API_PREFIX}{path}", **kwargs)


def get_cookie(name: str) -> str | None:
    return _client.cookies.get(name)


def clear_cookies() -> None:
    _client.cookies.clear()