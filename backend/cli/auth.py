"""Auth category. Endpoints: login, logout, me, forgot-password, validate-token, set-password."""
from __future__ import annotations

from typing import Callable

import questionary

from ._client import clear_cookies, get_cookie, request
from ._data import KNOWN_ACCOUNTS, MALFORMED_EMAIL, UNKNOWN_EMAIL, TestAccount
from ._output import console, info, print_request, print_response, success, warn


# Sentinel for "Back" choice. questionary 2.x can mishandle Choice(value=None),
# so use a string we can compare against.
BACK = "__BACK__"

# Endpoint paths (single source of truth)
EP_LOGIN           = "/auth/login"
EP_LOGOUT          = "/auth/logout"
EP_ME              = "/auth/me"
EP_FORGOT_PASSWORD = "/auth/forgot-password"
EP_VALIDATE_TOKEN  = "/auth/validate-token"
EP_SET_PASSWORD    = "/auth/set-password"
EP_CHANGE_PASSWORD = "/auth/change-password"

# Shared prompt copy
NEW_PASSWORD_PROMPT = "New password (min 8 chars)"


def _pick_account(prompt: str = "Which account?") -> TestAccount | None:
    choices = [questionary.Choice(a.label, value=a) for a in KNOWN_ACCOUNTS]
    choices.append(questionary.Choice("← Cancel", value=BACK))
    pick = questionary.select(prompt, choices=choices).ask()
    return None if pick is None or pick == BACK else pick


def _login() -> None:
    a = _pick_account("Log in as?")
    if not a: return
    body = {"email": a.email, "password": a.password}
    print_request("POST", EP_LOGIN, body)
    resp = request("POST", EP_LOGIN, json=body)
    print_response(resp)
    if resp.status_code == 200:
        cookie = get_cookie("access_token")
        if cookie:
            success(f"Cookie set (access_token={cookie[:16]}…). /me will use this session.")


def _login_custom() -> None:
    """Prompts for arbitrary email + password. Use when a preset password
    no longer matches what's in the DB (e.g. after a change-password test)."""
    email = questionary.text("Email").ask()
    if not email: return
    password = questionary.password("Password").ask()
    if not password: return
    body = {"email": email, "password": password}
    print_request("POST", EP_LOGIN, {"email": email, "password": "***"})
    resp = request("POST", EP_LOGIN, json=body)
    print_response(resp)
    if resp.status_code == 200:
        cookie = get_cookie("access_token")
        if cookie:
            success(f"Cookie set (access_token={cookie[:16]}…). /me will use this session.")


def _login_wrong_password() -> None:
    a = _pick_account("Test wrong password for?")
    if not a: return
    body = {"email": a.email, "password": "definitely-wrong"}
    print_request("POST", EP_LOGIN, body)
    print_response(request("POST", EP_LOGIN, json=body))


def _login_unknown_email() -> None:
    body = {"email": UNKNOWN_EMAIL, "password": "x"}
    print_request("POST", EP_LOGIN, body)
    print_response(request("POST", EP_LOGIN, json=body))


def _logout() -> None:
    print_request("POST", EP_LOGOUT)
    print_response(request("POST", EP_LOGOUT))
    clear_cookies()
    info("CLI cookies cleared.")


def _me() -> None:
    print_request("GET", EP_ME)
    print_response(request("GET", EP_ME))


def _update_me() -> None:
    """Requires an active login session (do /auth/login first)."""
    name  = questionary.text("New full name").ask()
    if not name: return
    phone = questionary.text("New phone (E.164 ideally, e.g. +212600000000)").ask()
    if not phone: return
    body = {"name": name, "phone": phone}
    print_request("PATCH", EP_ME, body)
    resp = request("PATCH", EP_ME, json=body)
    print_response(resp)
    if resp.status_code == 401:
        warn("401 means you're not logged in. Run /auth/login first.")


def _change_password() -> None:
    """Requires an active login session. Changes the logged-in user's password.
    NOTE: this actually changes the password in the DB — restore via psql or another change."""
    current = questionary.password("Current password").ask()
    if not current: return
    new = questionary.password(NEW_PASSWORD_PROMPT).ask()
    if not new: return
    body = {"current_password": current, "new_password": new}
    print_request("POST", EP_CHANGE_PASSWORD, {"current_password": "***", "new_password": "***"})
    resp = request("POST", EP_CHANGE_PASSWORD, json=body)
    print_response(resp)
    if resp.status_code == 204:
        success(f"Password changed. Next /auth/login must use `{new}`. Don't forget to restore.")
    elif resp.status_code == 401:
        warn("401 means you're not logged in. Run /auth/login first.")


def _forgot_password() -> None:
    pick = questionary.select(
        "Which email?",
        choices=[
            questionary.Choice("Known account (pick…)", value="known"),
            questionary.Choice(f"Unknown email ({UNKNOWN_EMAIL})", value="unknown"),
            questionary.Choice(f"Malformed email ({MALFORMED_EMAIL})", value="bad"),
            questionary.Choice("← Cancel", value=BACK),
        ],
    ).ask()
    if pick is None or pick == BACK: return

    if pick == "known":
        a = _pick_account("Forgot-password for?")
        if not a: return
        email = a.email
    elif pick == "unknown":
        email = UNKNOWN_EMAIL
    else:
        email = MALFORMED_EMAIL

    body = {"email": email}
    print_request("POST", EP_FORGOT_PASSWORD, body)
    print_response(request("POST", EP_FORGOT_PASSWORD, json=body))
    if pick == "known":
        warn("The magic-link token was printed in the uvicorn console. Copy it for /validate-token and /set-password.")


def _validate_token() -> None:
    token = questionary.text("Token (paste here)").ask()
    if not token: return
    print_request("GET", f"{EP_VALIDATE_TOKEN}?token={token[:16]}…")
    print_response(request("GET", EP_VALIDATE_TOKEN, params={"token": token}))


def _set_password() -> None:
    token = questionary.text("Token (paste here)").ask()
    if not token: return
    password = questionary.password(NEW_PASSWORD_PROMPT).ask()
    if not password: return
    body = {"token": token, "password": password}
    print_request("POST", EP_SET_PASSWORD, {"token": f"{token[:12]}…", "password": "***"})
    resp = request("POST", EP_SET_PASSWORD, json=body)
    print_response(resp)
    if resp.status_code == 204:
        success("Password set. You can now log in with it.")


def _reset_flow_demo() -> None:
    """Scripted full round-trip: forgot → wait for token → validate → set → login."""
    a = _pick_account("Target account for the full demo?")
    if not a: return
    console.print("\n[bold]── 1. forgot-password ──[/]")
    body = {"email": a.email}
    print_request("POST", EP_FORGOT_PASSWORD, body)
    print_response(request("POST", EP_FORGOT_PASSWORD, json=body))
    warn("→ Copy the token from the uvicorn console (`MAGIC LINK …token=XXX`)")
    token = questionary.text("Token").ask()
    if not token: return

    console.print("\n[bold]── 2. validate-token ──[/]")
    print_request("GET", EP_VALIDATE_TOKEN)
    print_response(request("GET", EP_VALIDATE_TOKEN, params={"token": token}))

    new_pw = questionary.password(NEW_PASSWORD_PROMPT).ask()
    if not new_pw: return
    console.print("\n[bold]── 3. set-password ──[/]")
    print_request("POST", EP_SET_PASSWORD, {"token": f"{token[:12]}…", "password": "***"})
    print_response(request("POST", EP_SET_PASSWORD, json={"token": token, "password": new_pw}))

    console.print("\n[bold]── 4. login (new password) ──[/]")
    body = {"email": a.email, "password": new_pw}
    print_request("POST", EP_LOGIN, body)
    print_response(request("POST", EP_LOGIN, json=body))
    warn(f"⚠ {a.email}'s password is now `{new_pw}`. Restore the original if needed.")


# ── menu wiring ───────────────────────────────────────────────────────────────

ENDPOINTS: list[tuple[str, Callable[[], None]]] = [
    ("POST /auth/login (known account, correct password)", _login),
    ("POST /auth/login (custom email + password)",         _login_custom),
    ("POST /auth/login (wrong password)",                  _login_wrong_password),
    ("POST /auth/login (unknown email, no-leak check)",    _login_unknown_email),
    ("GET  /auth/me",                                      _me),
    ("PATCH /auth/me (update name + phone)",               _update_me),
    ("POST /auth/change-password",                         _change_password),
    ("POST /auth/logout",                                  _logout),
    ("POST /auth/forgot-password (variants)",              _forgot_password),
    ("GET  /auth/validate-token",                          _validate_token),
    ("POST /auth/set-password",                            _set_password),
    ("✨ Full flow: forgot → validate → set → login",      _reset_flow_demo),
]


def run() -> None:
    """Auth submenu loop. Returns to main menu on Back."""
    while True:
        choices = [questionary.Choice(label, value=fn) for label, fn in ENDPOINTS]
        choices.append(questionary.Choice("← Back", value=BACK))
        pick = questionary.select("Auth · pick an endpoint", choices=choices).ask()
        if pick is None or pick == BACK:
            return
        pick()