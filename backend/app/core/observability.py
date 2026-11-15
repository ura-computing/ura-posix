"""Errors seen from outside: Sentry, for every API service and the Sobrus worker. Off until SENTRY_DSN is set (dev, E2E
send nothing). Each `log.exception` / error log becomes an event with its traceback (Sentry's logging integration),
tagged with its component (identity, analytics…, worker) and, for a request, its request id (`errors.CatchServerErrors`).
No personal data is sent (`send_default_pii=False`: no emails, cookies, IPs)."""

import sentry_sdk

from app.core.config import settings


def init_sentry(component: str) -> None:
    """`component`: the API service (`SERVICE`, « api » when unsplit) or « worker »."""
    if not settings.SENTRY_DSN:
        return
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.SENTRY_ENVIRONMENT,
        send_default_pii=False,
        traces_sample_rate=0.0,  # errors only (no performance tracing, no extra cost)
    )
    sentry_sdk.set_tag("component", component)
