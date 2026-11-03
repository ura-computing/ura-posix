"""Fake Sobrus for the E2E stack (`e2e/docker-compose.e2e.yml`): the same 5 HTTP steps as the real
one (backend/app/sobrus/sobrus_client.py), never the real Sobrus.

  GET  /auth/redirect-to-idp-login   → 302 /authorize?…&prompt=login&state&nonce (cookie oidc_state)
  GET  /authorize                    → logged in on the account: 302 /auth/token?code&state, else 302 /login
  POST /auth/identifier              {login} → {isRegistered}
  POST /auth/sessions                {email, password} → 200 + cookie account_session | 401 {errorMessage}
  GET  /auth/token                   → cookie SBSID2 + 302 /app
  GET  /authenticated-user           → 200 with SBSID2, else 401
  GET  /reports/exports/{purchases,sales}?start_date&end_date
                                     → the generated CSV (resources/tests/{achats,ventes}/*.csv): header +
                                       the lines whose date is inside (same date rules as csv_parse)
  GET  /reports/exports/stock        → today's stock as JSON, like the real one (no dates): the rows of
                                       resources/tests/stock/*.csv + the categories / taxes / zones tables
  POST /__control                    test only: {password} = « the owner changed his Sobrus password »
                                     (every session ends); {delay} = seconds each export waits (« Arrêter »);
                                     {verify} = Sobrus asks a check (« Confirmez votre numéro »): /authorize
                                     shows a page instead of the code (no SBSID2), every session ends;
                                     {busy: n} = the next n logins answer 429 (too many logins), every session ends;
                                     {fail: "login" | "export" | null} = Sobrus down at login (503, every session
                                     ends) or refusing the export (500)
Standard library only. Env: FAKE_SOBRUS_EMAIL, FAKE_SOBRUS_PASSWORD, FAKE_SOBRUS_DATA, FAKE_SOBRUS_BASE, PORT."""

from __future__ import annotations

import csv
import json
import os
import re
import secrets
import time
from datetime import date
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse

EMAIL = os.environ.get("FAKE_SOBRUS_EMAIL", "pharmacie@sobrus.e2e")
STATE = {"password": os.environ.get("FAKE_SOBRUS_PASSWORD", "SobrusE2e#2026"), "delay": 0.0, "verify": False, "busy": 0, "fail": None}
DATA = Path(os.environ.get("FAKE_SOBRUS_DATA", "/data"))
BASE = os.environ.get("FAKE_SOBRUS_BASE", "http://sobrus.e2e.test:9100").rstrip("/")
PORT = int(os.environ.get("PORT", "9100"))

ACCOUNT_SESSIONS: set[str] = set()
APP_SESSIONS: set[str] = set()
CODES: set[str] = set()
FILES = {"purchases": ("achats", "Date Bon de Livraison"), "sales": ("ventes", "Date"), "stock": ("stock", None)}

# Same as backend/app/ingestion/csv_parse.py _DATE_RE: ISO, or day first (files saved again by hand).
DATE_RE = re.compile(
    r"(?:(?P<y>\d{4}) ?[-/.] ?(?P<m>\d{1,2}) ?[-/.] ?(?P<d>\d{1,2})"
    r"|(?P<dd>\d{1,2}) ?[-/.] ?(?P<mm>\d{1,2}) ?[-/.] ?(?P<yy>\d{4}|\d{2}))"
    r"(?:[T ](?P<H>\d{1,2}):(?P<M>\d{2})(?::(?P<S>\d{2})(?:[.,]\d+)?)?)?"
)


def day_of(value: str) -> date | None:
    m = DATE_RE.fullmatch(" ".join(value.split()).strip("\"' "))
    if not m:
        return None
    if m["y"]:
        y, mo, d = int(m["y"]), int(m["m"]), int(m["d"])
    else:
        y, mo, d = int(m["yy"]), int(m["mm"]), int(m["dd"])
        y += 2000 if y < 100 else 0
    try:
        return date(y, mo, d)
    except ValueError:
        return None


def stock_json() -> bytes:
    """Sobrus' stock export: JSON, the names behind ids (`product_categories`, `taxes`, `zones`)."""
    path = sorted((DATA / "stock").glob("*.csv"))[-1]
    rows = list(csv.DictReader(path.read_text(encoding="utf-8-sig").splitlines(), delimiter=";"))
    tables: dict[str, dict[str, str]] = {"product_categories": {}, "taxes": {}, "zones": {}}

    def ref(table: str, name: str) -> str | None:
        if not name:
            return None
        ids = tables[table]
        found = next((k for k, v in ids.items() if v == name), None)
        if found is None:
            found = str(len(ids) + 1)
            ids[found] = name
        return found

    stock = [
        {
            "ID": r["PID"],
            "name": r["Produit"],
            "product_category_id": ref("product_categories", r["Catégorie"]),
            "purchase_tax_id": ref("taxes", r["TVA"]),
            "sale_price": r["PPV"],
            "purchase_price": r["PPH"],
            "zone_id": ref("zones", r["Zone"]),
            "stock": r["Stock"],
            "expiry_date": r["Date de péremption"] or None,
            "min_stock": r["Stock min"] or None,
            "max_stock": r["Stock max"] or None,
            "barcode": r["Code barre 1"] or None,
            "barcode_2": r["Code barre 2"] or None,
        }
        for r in rows
    ]
    return json.dumps({"data": {"stock": stock, "date": date.today().isoformat(), **tables}}).encode()


def export(kind: str, start: date, end: date) -> bytes:
    folder, column = FILES[kind]
    lines: list[str] = []
    header = ""
    for path in sorted((DATA / folder).glob("*.csv")):
        text = path.read_text(encoding="utf-8-sig").splitlines()
        if not text:
            continue
        header = header or text[0]
        index = next(csv.reader([text[0]], delimiter=";")).index(column)
        for line in text[1:]:
            cells = next(csv.reader([line], delimiter=";"), [])
            d = day_of(cells[index]) if len(cells) > index else None
            if d is not None and start <= d <= end:
                lines.append(line)
    return ("\n".join([header, *lines]) + "\n").encode("utf-8")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # quiet: the E2E log is the backend's
        pass

    def _cookies(self) -> dict[str, str]:
        jar = SimpleCookie(self.headers.get("Cookie", ""))
        return {k: v.value for k, v in jar.items()}

    def _send(self, status: int, body: bytes = b"", ctype="application/json", headers=None, cookies=None):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        for name, value in (cookies or {}).items():
            self.send_header("Set-Cookie", f"{name}={value}; Path=/; HttpOnly")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status: int, obj, cookies=None):
        self._send(status, json.dumps(obj).encode(), cookies=cookies)

    def _redirect(self, location: str, cookies=None):
        self._send(302, b"", headers={"Location": location}, cookies=cookies)

    def _body(self) -> dict:
        n = int(self.headers.get("Content-Length") or 0)
        try:
            return json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            return {}

    def do_GET(self):  # noqa: N802
        url = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        cookies = self._cookies()
        if url.path == "/auth/redirect-to-idp-login":
            state = secrets.token_hex(8)
            params = {
                "response_type": "code",
                "scope": "openid",
                "client_id": "pharma",
                "redirect_uri": f"{BASE}/auth/token",
                "prompt": "login",
                "state": state,
                "nonce": secrets.token_hex(8),
            }
            return self._redirect(f"{BASE}/authorize?{urlencode(params)}", cookies={"oidc_state": state})
        if url.path == "/authorize":
            if cookies.get("account_session") in ACCOUNT_SESSIONS and q.get("prompt") != "login":
                if STATE["verify"]:
                    return self._redirect(f"{BASE}/app/confirm-phone")
                code = secrets.token_hex(8)
                CODES.add(code)
                return self._redirect(f"{BASE}/auth/token?{urlencode({'code': code, 'state': q.get('state', '')})}")
            return self._redirect(f"{BASE}/login?redirectUri=x")
        if url.path == "/login":
            return self._send(200, b"<html><body>Sobrus login</body></html>", ctype="text/html")
        if url.path == "/auth/token":
            if q.get("code") not in CODES:
                return self._json(400, {"errors": ["bad code"]})
            CODES.discard(q["code"])
            sid = secrets.token_hex(16)
            APP_SESSIONS.add(sid)
            return self._redirect(f"{BASE}/app", cookies={"SBSID2": sid})
        if url.path == "/app":
            return self._send(200, b"<html><body>Sobrus app</body></html>", ctype="text/html")
        if url.path == "/authenticated-user":
            if cookies.get("SBSID2") in APP_SESSIONS:
                return self._json(200, {"user": {"user_id": 1}})
            return self._json(401, {"errors": ["unauthenticated"]})
        if url.path.startswith("/reports/exports/"):
            kind = url.path.rsplit("/", 1)[-1]
            if cookies.get("SBSID2") not in APP_SESSIONS:
                return self._json(401, {"errors": ["unauthenticated"]})
            if STATE["fail"] == "export":
                return self._json(500, {"errors": ["export failed"]})
            if kind not in FILES:
                return self._json(404, {"errors": ["unknown export"]})
            start = end = None
            if FILES[kind][1] is not None:
                try:
                    start, end = date.fromisoformat(q["start_date"]), date.fromisoformat(q["end_date"])
                except (KeyError, ValueError):
                    return self._json(400, {"errors": ["dates"]})
            time.sleep(STATE["delay"])
            if kind == "stock":
                return self._send(200, stock_json(), ctype="application/json; charset=utf-8")
            return self._send(200, export(kind, start, end), ctype="text/csv; charset=utf-8")
        return self._json(404, {"errors": ["not found"]})

    def do_POST(self):  # noqa: N802
        url = urlparse(self.path)
        body = self._body()
        if url.path == "/auth/identifier":
            if STATE["fail"] == "login":
                return self._json(503, {"errors": ["unavailable"]})
            return self._json(200, {"isRegistered": body.get("login") == EMAIL})
        if url.path == "/auth/sessions":
            if STATE["busy"] > 0:  # « too many logins »
                STATE["busy"] -= 1
                return self._json(429, {"errorMessage": "Too many requests"})
            if body.get("email") == EMAIL and body.get("password") == STATE["password"]:
                token = secrets.token_hex(16)
                ACCOUNT_SESSIONS.add(token)
                return self._json(200, {"data": {"mustResetPassword": False}}, cookies={"account_session": token})
            return self._json(401, {"errorMessage": "Identifiant ou mot de passe incorrect"})
        if url.path == "/__control":
            if "delay" in body:
                STATE["delay"] = float(body["delay"])
            if "verify" in body:
                STATE["verify"] = bool(body["verify"])
                APP_SESSIONS.clear()
            if "busy" in body:
                STATE["busy"] = int(body["busy"])
                APP_SESSIONS.clear()
            if "fail" in body:
                STATE["fail"] = body["fail"]
                if body["fail"] == "login":
                    APP_SESSIONS.clear()
            if "password" in body:
                STATE["password"] = body["password"]
                ACCOUNT_SESSIONS.clear()
                APP_SESSIONS.clear()
            return self._json(200, {"ok": True})
        return self._json(404, {"errors": ["not found"]})


if __name__ == "__main__":
    print(f"fake Sobrus on :{PORT} ({BASE}), data {DATA}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
