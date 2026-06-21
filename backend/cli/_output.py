"""Pretty-printers using rich. Status code coloring, JSON formatting."""
from __future__ import annotations

import json

import httpx
from rich.console import Console
from rich.panel import Panel
from rich.syntax import Syntax


console = Console()


def _status_color(code: int) -> str:
    if 200 <= code < 300: return "green"
    if 300 <= code < 400: return "cyan"
    if 400 <= code < 500: return "yellow"
    return "red"


def print_request(method: str, path: str, body: object | None = None) -> None:
    console.print(f"\n[bold cyan]→ {method.upper()}[/] [white]{path}[/]")
    if body is not None:
        json_str = json.dumps(body, indent=2, ensure_ascii=False)
        console.print(Syntax(json_str, "json", theme="monokai", line_numbers=False, background_color="default"))


def print_response(resp: httpx.Response) -> None:
    color = _status_color(resp.status_code)
    duration_ms = int(resp.elapsed.total_seconds() * 1000)
    console.print(f"[bold {color}]← {resp.status_code}[/] [dim]{resp.reason_phrase} · {duration_ms} ms[/]")

    if not resp.content:
        console.print("[dim](no body)[/]")
        return

    try:
        parsed = resp.json()
        json_str = json.dumps(parsed, indent=2, ensure_ascii=False)
        console.print(Syntax(json_str, "json", theme="monokai", line_numbers=False, background_color="default"))
    except json.JSONDecodeError:
        console.print(resp.text)


def info(msg: str) -> None:
    console.print(f"[dim]ℹ {msg}[/]")


def warn(msg: str) -> None:
    console.print(f"[yellow]⚠ {msg}[/]")


def success(msg: str) -> None:
    console.print(f"[green]✓ {msg}[/]")


def divider() -> None:
    console.print(Panel("", style="dim", padding=0))