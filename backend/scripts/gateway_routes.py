"""Write `gateway/Caddyfile` from the API's own routes: each path goes to the service that has it
(`app/core/services.py`). Run it after adding / moving a route: `uv run python scripts/gateway_routes.py`.
`--check`: fail when the file on disk is not what the routes give (CI, E2E start).

Fixed paths are matched first, then the ones with an `{id}`: `/v1/admin/catalog/sobrus-products` (sobrus) never falls
into `/v1/admin/catalog/{id}` (ingestion). Every route is then checked: its own path must reach its own service."""

import os
import re
import sys
from importlib import import_module
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("DATABASE_URL", "postgresql://unused/unused")  # routes only: no connection
os.environ.setdefault("JWT_SECRET", "x" * 40)
os.environ.setdefault("FRONTEND_URL", "http://localhost")

from fastapi import FastAPI  # noqa: E402

from app.core.services import ROUTER_MODULES, SERVICE_ROUTERS  # noqa: E402

CADDYFILE = Path(__file__).resolve().parents[2] / "gateway" / "Caddyfile"
PARAM = re.compile(r"\{[^}]+\}")


def service_paths() -> dict[str, list[str]]:
    """Service → its path templates (`/v1/admin/pharmacies/{pharmacy_id}`), sorted."""
    out: dict[str, set[str]] = {}
    for service, routers in SERVICE_ROUTERS.items():
        app = FastAPI()  # its OpenAPI lists every path (FastAPI 0.138 keeps included routers lazy)
        if service == "identity":  # /v1/health: every service has it, the gateway asks identity's
            app.include_router(import_module("app.core.health").router, prefix="/v1")
        for name in routers:
            app.include_router(import_module(ROUTER_MODULES[name]).router, prefix="/v1")
        out[service] = set(app.openapi()["paths"])
    return {service: sorted(paths) for service, paths in out.items()}


def regex(paths: list[str]) -> str:
    """`/v1/a/{x}`, `/v1/b/{y}/c` → `^/v1/(?:a/[^/]+|b/[^/]+/c)$` (RE2, Caddy's regex engine)."""
    parts = ["[^/]+".join(re.escape(p) for p in PARAM.split(path.removeprefix("/v1/"))) for path in paths]
    return "^/v1/(?:" + "|".join(parts) + ")$"


def build() -> str:
    by_service = service_paths()
    lines = [
        "# Made by backend/scripts/gateway_routes.py from the API's routes: do not edit by hand.",
        "# The public /api of the app (DigitalOcean strips /api): each path → the service that has it",
        "# (backend/app/core/services.py). Fixed paths first, then the ones with an {id}.",
        "{",
        "\tadmin off",
        "\tauto_https off",
        "}",
        "",
        ":{$PORT:8080} {",
        "\t@gateway_health path /healthz",
    ]
    handlers: list[str] = []
    for kind in ("fixed", "param"):
        for service, paths in by_service.items():
            mine = [p for p in paths if ("{" in p) == (kind == "param")]
            if not mine:
                continue
            name = f"{service}_{kind}"
            if kind == "fixed":
                lines.append(f"\t@{name} path " + " ".join(mine))
            else:
                lines.append(f"\t@{name} path_regexp {regex(mine)}")
            upstream = "{$" + service.upper() + "_URL:http://" + service + ":8000}"
            handlers.append(f"\t\treverse_proxy @{name} {upstream}")
    lines += [
        "",
        "\troute {",
        '\t\trespond @gateway_health "ok" 200',  # inside `route`: Caddy runs `route` before a bare `respond`
        *handlers,
        '\t\trespond `{"detail":"Not Found"}` 404',
        "\t}",
        "}",
        "",
    ]
    return "\n".join(lines)


def check_routing(text: str) -> list[str]:
    """Every route's path (its {ids} = 1) must reach its own service, like Caddy reads the file (in order)."""
    matchers: list[tuple[str, str, object]] = []
    for line in text.splitlines():
        m = re.match(r"\t@(\w+)_(fixed|param) (path|path_regexp) (.+)$", line)
        if m:
            service, _, kind, value = m.groups()
            matchers.append((service, kind, set(value.split()) if kind == "path" else re.compile(value)))
    errors = []
    for service, paths in service_paths().items():
        for path in paths:
            sample = PARAM.sub("1", path)
            hit = next(
                (
                    owner
                    for owner, kind, value in matchers
                    if (sample in value if kind == "path" else value.match(sample))  # type: ignore[operator, union-attr]
                ),
                None,
            )
            if hit != service:
                errors.append(f"{path}: goes to {hit}, belongs to {service}")
    return errors


def main() -> int:
    text = build()
    errors = check_routing(text)
    if errors:
        print("Gateway routing wrong:\n  " + "\n  ".join(errors))
        return 1
    if "--check" in sys.argv:
        if not CADDYFILE.exists() or CADDYFILE.read_text() != text:
            print(f"{CADDYFILE} is not up to date: uv run python scripts/gateway_routes.py")
            return 1
        print(f"{CADDYFILE}: up to date")
        return 0
    CADDYFILE.parent.mkdir(exist_ok=True)
    CADDYFILE.write_text(text)
    print(f"{CADDYFILE} written ({sum(len(p) for p in service_paths().values())} paths)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
