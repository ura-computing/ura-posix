"""Which routers each service runs. One image for every service: the `SERVICE` env picks its routers; unset = every
router (dev, E2E, one-component production). Every service also answers `/v1/health` (its DigitalOcean health check).
The gateway (`gateway/Caddyfile`, made by `scripts/gateway_routes.py`) sends each path to the service that has it.

Example: SERVICE=analytics → /v1/stats, /v1/products… only; /v1/auth/login there → 404 (the gateway sends it to
identity)."""

# Router name → its module (each module has a `router`). Registration order = today's (a `{id}` route registered first
# would catch a fixed path of a later router: `/admin/catalog/{id}` vs `/admin/catalog/sobrus-products`).
ROUTER_MODULES: dict[str, str] = {
    "auth": "app.identity.auth.router",
    "stats": "app.analytics.router",
    "catalog": "app.catalog.router",
    "purchasing": "app.purchasing.router",
    "admin_pharmacies": "app.identity.members.admin_router",
    "owner_employees": "app.identity.members.owner_router",
    "imports": "app.ingestion.router",
    "transactions": "app.ledger.router",
    "products": "app.products.router",
    "damaged": "app.damaged.router",
    "promis": "app.promis.router",
    "orders": "app.orders.router",
    "orders_admin": "app.orders.admin_router",
    "history": "app.history.router",
    "sobrus": "app.sobrus.router",
    "exclusions": "app.accounting.exclusions.router",
    "accounting": "app.accounting.payments.router",
    "closings": "app.accounting.closings.router",
    "store_owner": "app.store_website.owner_router",
    "store_public": "app.store_website.public_router",
    "store_website": "app.store_website.router",
    "notifications": "app.notifications.router",
}

# Service → its routers. Each router in exactly one service (checked below).
SERVICE_ROUTERS: dict[str, tuple[str, ...]] = {
    # Every page asks /auth/me; login rate limit stays right while it runs as one instance.
    "identity": ("auth", "admin_pharmacies", "owner_employees", "notifications"),
    # The heavy reads: scaled alone.
    "analytics": (
        "stats",
        "products",
        "damaged",
        "promis",
        "orders",
        "orders_admin",
        "history",
        "transactions",
        "accounting",
        "closings",
        "exclusions",
        "store_owner",
        "store_public",
        "store_website",
    ),
    # Big uploads (memory): achats / ventes / stock, the admin catalogue + suppliers.
    "ingestion": ("imports", "catalog", "purchasing"),
    # Queues the Sobrus runs and reads what the worker stored (the worker itself: `app/sobrus/worker.py`).
    "sobrus": ("sobrus",),
}

_assigned = [name for names in SERVICE_ROUTERS.values() for name in names]
if sorted(_assigned) != sorted(ROUTER_MODULES) or len(set(_assigned)) != len(_assigned):
    raise RuntimeError("SERVICE_ROUTERS must hold every router of ROUTER_MODULES exactly once")


def routers_of(service: str) -> list[str]:
    """The routers this service runs, in ROUTER_MODULES order ("" = all)."""
    if service and service not in SERVICE_ROUTERS:
        raise RuntimeError(f"SERVICE={service!r}: unknown, use one of {', '.join(SERVICE_ROUTERS)} or leave it empty")
    wanted = set(SERVICE_ROUTERS[service]) if service else set(ROUTER_MODULES)
    return [name for name in ROUTER_MODULES if name in wanted]
