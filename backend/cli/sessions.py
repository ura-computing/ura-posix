"""Sessions category. Endpoints: list mine, kill one, revoke all others."""
from __future__ import annotations

from typing import Callable

import questionary

from ._client import get_cookie, request
from ._output import print_request, print_response, success, warn


BACK = "__BACK__"

EP_SESSIONS      = "/sessions"
EP_REVOKE_OTHERS = "/sessions/revoke-others"


def _list() -> None:
    print_request("GET", EP_SESSIONS)
    resp = request("GET", EP_SESSIONS)
    print_response(resp)
    if resp.status_code == 200:
        rows = resp.json()
        if not rows:
            warn("No sessions returned. Did you /auth/login first?")
        else:
            current = next((r for r in rows if r["is_current"]), None)
            warn(f"{len(rows)} session(s); current = {current['id'] if current else 'none'}")


def _kill_specific() -> None:
    session_id = questionary.text("Session ID to kill").ask()
    if not session_id: return
    print_request("DELETE", f"{EP_SESSIONS}/{session_id}")
    resp = request("DELETE", f"{EP_SESSIONS}/{session_id}")
    print_response(resp)
    if resp.status_code == 204:
        success(f"Session {session_id} deleted.")


def _revoke_others() -> None:
    if not get_cookie("session_token"):
        warn("No session_token cookie — log in first so 'current' can be detected.")
        return
    print_request("POST", EP_REVOKE_OTHERS)
    resp = request("POST", EP_REVOKE_OTHERS)
    print_response(resp)
    if resp.status_code == 204:
        success("All other sessions killed. Current session preserved.")


ENDPOINTS: list[tuple[str, Callable[[], None]]] = [
    ("GET    /sessions (list mine)",          _list),
    ("DELETE /sessions/{id} (kill one)",      _kill_specific),
    ("POST   /sessions/revoke-others",        _revoke_others),
]


def run() -> None:
    """Sessions submenu loop. Returns to main menu on Back."""
    while True:
        choices = [questionary.Choice(label, value=fn) for label, fn in ENDPOINTS]
        choices.append(questionary.Choice("← Back", value=BACK))
        pick = questionary.select("Sessions · pick an endpoint", choices=choices).ask()
        if pick is None or pick == BACK:
            return
        pick()