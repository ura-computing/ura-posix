"""Sobrus over plain HTTP (httpx, no browser). The login is OpenID Connect (seen 2026-10-28):

  1 GET  {API}/auth/redirect-to-idp-login?country_code → {ACCOUNT_API}/authorize?…state&nonce → login page
  2 POST {ACCOUNT_API}/auth/identifier {login, rememberMe}
  3 POST {ACCOUNT_API}/auth/sessions   {email, password, rememberMe}            → account session cookie
  4 GET  the same /authorize (without `prompt`) → {API}/auth/token?code&state → cookie SBSID2 (≈ 4 days)

Exports: GET {API}/reports/exports/{purchases|sales}?start_date&end_date with SBSID2 (the CSV the
« Télécharger en CSV » button gives). Nothing here is ever logged: no password, no cookie value."""

from __future__ import annotations

import time
from typing import Callable

import httpx

from app.core.config import settings

USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
EXPORT_PATH = {"achat": "purchases", "vente": "sales", "stock": "stock"}


class SobrusError(Exception):
    """A problem the page shows (`errors.<code>`): sobrusBadCredentials, sobrusNeedsAction,
    sobrusUnreachable, sobrusExportFailed."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class SessionExpired(Exception):
    """The Sobrus session ended (≈ 4 days): log in again with the saved password."""


class SobrusClient:
    """One HTTP session on Sobrus; its cookies can be saved (`cookies()`) and given back next time."""

    def __init__(self, cookies: list[dict] | None = None) -> None:
        self.http = httpx.Client(
            follow_redirects=True,
            timeout=httpx.Timeout(60.0, read=300.0),
            headers={"User-Agent": USER_AGENT, "Accept-Language": "fr-FR,fr;q=0.9"},
        )
        for c in cookies or []:
            self.http.cookies.set(c["name"], c["value"], domain=c["domain"], path=c.get("path", "/"))

    def close(self) -> None:
        self.http.close()

    def cookies(self) -> list[dict]:
        return [{"name": c.name, "value": c.value, "domain": c.domain, "path": c.path} for c in self.http.cookies.jar]

    def _request(self, method: str, url: str, **kwargs) -> httpx.Response:
        try:
            return self.http.request(method, url, **kwargs)
        except httpx.HTTPError as e:
            raise SobrusError("sobrusUnreachable") from e

    def session_alive(self) -> bool:
        """The saved session still opens Sobrus."""
        r = self._request("GET", f"{settings.SOBRUS_API_URL}/authenticated-user", follow_redirects=False)
        if r.status_code >= 500:
            raise SobrusError("sobrusUnreachable")
        return r.status_code == 200

    def login(self, email: str, password: str) -> None:
        """The 4 steps above. Wrong email / password → sobrusBadCredentials (the caller never retries
        it: no account lockout); Sobrus asks something else (limit, password reset) → sobrusNeedsAction."""
        self.http.cookies.clear()
        api, account = settings.SOBRUS_API_URL, settings.SOBRUS_ACCOUNT_API_URL
        json_headers = {
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "Referer": "https://account.sobrus.com/",
            "Origin": "https://account.sobrus.com",
        }

        r = self._request("GET", f"{api}/auth/redirect-to-idp-login", params={"country_code": settings.SOBRUS_COUNTRY})
        authorize = next((h.url for h in r.history if h.url.path == "/authorize"), None)
        if authorize is None:
            raise SobrusError("sobrusUnreachable")

        r = self._request(
            "POST", f"{account}/auth/identifier", json={"login": email, "rememberMe": True}, headers=json_headers
        )
        _raise_for_login(r)
        if _json(r).get("isRegistered") is False:
            raise SobrusError("sobrusBadCredentials")

        r = self._request(
            "POST",
            f"{account}/auth/sessions",
            json={"email": email, "password": password, "rememberMe": True},
            headers=json_headers,
        )
        _raise_for_login(r)
        if (_json(r).get("data") or {}).get("mustResetPassword"):
            raise SobrusError("sobrusNeedsAction")

        params = dict(authorize.params)
        params.pop("prompt", None)  # `prompt=login` would show the login page again
        self._request("GET", str(authorize.copy_with(params=params)))
        if not any(c.name == "SBSID2" for c in self.http.cookies.jar):
            raise SobrusError("sobrusNeedsAction")

    def export(self, kind: str, start: str | None, end: str | None, on_bytes: Callable[[int], None]) -> bytes:
        """The CSV of `kind`: achat | vente from `start` to `end` (ISO days), stock = today's (no
        dates); `on_bytes(n)` about every second while it arrives (a year of sales is several Mo)."""
        url = f"{settings.SOBRUS_API_URL}/reports/exports/{EXPORT_PATH[kind]}"
        params = {"start_date": start, "end_date": end} if start and end else None
        try:
            with self.http.stream("GET", url, params=params, follow_redirects=False) as r:
                if r.status_code in (401, 403) or r.is_redirect:
                    raise SessionExpired()
                if r.status_code != 200:
                    raise SobrusError("sobrusExportFailed")
                content = bytearray()
                shown_at = 0.0
                for part in r.iter_bytes():
                    content += part
                    if time.monotonic() - shown_at > 1:
                        shown_at = time.monotonic()
                        on_bytes(len(content))
                on_bytes(len(content))
                return bytes(content)
        except httpx.HTTPError as e:
            raise SobrusError("sobrusUnreachable") from e


def _json(r: httpx.Response) -> dict:
    try:
        body = r.json()
    except ValueError:
        return {}
    return body if isinstance(body, dict) else {}


def _raise_for_login(r: httpx.Response) -> None:
    if r.status_code == 429:
        raise SobrusError("sobrusNeedsAction")
    if r.status_code >= 500:
        raise SobrusError("sobrusUnreachable")
    if r.status_code >= 400:
        raise SobrusError("sobrusBadCredentials")
