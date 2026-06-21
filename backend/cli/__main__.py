"""PharmaGest CLI test tool.

Run with:
    uv run python -m cli            (from backend/)
    # or
    make cli                        (from apcm-refactor/ root)

Backend URL is configurable via env var PG_CLI_BACKEND (defaults to
http://localhost:8000). The CLI keeps a shared cookie jar across calls so
after a successful login, /me and other authenticated endpoints work.

Add a new category by creating `cli/<name>.py` exposing a `run()` function,
then registering it below in CATEGORIES.
"""
from __future__ import annotations

from typing import Callable

import questionary

from . import auth, sessions, stats, transactions, uploads
from ._client import BASE_URL
from ._output import console, info


BACK = "__QUIT__"

# Each entry: (label, function). Add new modules here.
CATEGORIES: list[tuple[str, Callable[[], None]]] = [
    ("Auth (login · me · logout · forgot/set/change password)", auth.run),
    ("Sessions (list · kill one · revoke others)",              sessions.run),
    ("Stats / Rapport (GET /v1/stats with filter combos)",      stats.run),
    ("Uploads (Sobrus CSV ingest — 6 endpoints + cancel)",      uploads.run),
    ("Transactions (list achats + ventes, filter by batch)",    transactions.run),
]


def main() -> None:
    console.print(f"[bold cyan]PharmaGest CLI[/]  [dim]→ {BASE_URL}[/]")
    info("Tip: Ctrl+C or \"Quit\" to exit.")

    while True:
        choices = [questionary.Choice(label, value=fn) for label, fn in CATEGORIES]
        choices.append(questionary.Choice("Quit", value=BACK))
        try:
            pick = questionary.select("Category?", choices=choices).ask()
        except KeyboardInterrupt:
            return
        if pick is None or pick == BACK:
            return
        pick()


if __name__ == "__main__":
    main()