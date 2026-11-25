"""The Sobrus robot: `python -m app.sobrus.worker`, its own process (DigitalOcean « Worker » component,
the `worker` service of the Docker stacks, `make worker`), never inside the web one: a big client's import
has its own memory, not the website's. Postgres is the queue: forever, it queues tonight's « new » runs,
closes the runs of a stopped robot, runs the queued ones one by one (`FOR UPDATE SKIP LOCKED`: a second
robot never takes the same one), then sleeps until the API queues a run (`NOTIFY sobrus_runs`,
`launcher.wake`) or TICK_S. No browser, no web server, never migrates (waits for the API's migrations)."""

from __future__ import annotations

import logging
import os
import select
import signal
import time as clock

import psycopg2
from datetime import datetime, time, timedelta, timezone

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from uvicorn.logging import DefaultFormatter

from app.core.config import settings
from app.core.observability import init_sentry
from app.core.database import SessionLocal, engine
from app.core.models import Pharmacy, PharmacyFeature, SobrusConnection, SobrusRun
from app.core.utils import PHARMACY_TZ
from app.promis.promis_queries import expire_overdue
from app.sobrus.launcher import BACKEND_DIR, CHANNEL
from app.sobrus.sync import execute

log = logging.getLogger("uvicorn.error")

TICK_S = float(os.environ.get("SOBRUS_TICK", "30"))
NIGHTLY_HOUR = 2
# A running run writes its heartbeat at every step (sync._set): silent this long = its robot stopped
# (deploy, restart). Longer than any step: a 300 s Sobrus read timeout, one ANALYZE.
STALE_AFTER = timedelta(minutes=10)


def schedule_nightly() -> None:
    """Tonight's « new » run per active connection, once a day after NIGHTLY_HOUR (Casablanca); not
    for a pharmacy whose « Connexion Sobrus » access the admin took away."""
    now = datetime.now(PHARMACY_TZ)
    if now.hour < NIGHTLY_HOUR:
        return
    since = datetime.combine(now.date(), time(NIGHTLY_HOUR), PHARMACY_TZ)
    with SessionLocal() as db:
        allowed = (
            db.query(PharmacyFeature.pharmacy_id)
            .filter(PharmacyFeature.feature == "sobrus", PharmacyFeature.enabled.is_(True))
            .scalar_subquery()
        )
        active = db.query(SobrusConnection).filter(
            SobrusConnection.status == "active", SobrusConnection.pharmacy_id.in_(allowed)
        )
        for conn in active.all():
            done = (
                db.query(SobrusRun.id)
                .filter(SobrusRun.pharmacy_id == conn.pharmacy_id, SobrusRun.created_at >= since)
                .first()
            )
            if done:
                continue
            db.add(SobrusRun(pharmacy_id=conn.pharmacy_id, mode="new", status="queued", events=[]))
            try:
                db.commit()
            except IntegrityError:  # a run of this pharmacy is already queued / running
                db.rollback()


def recover() -> None:
    """Runs left `running` by a stopped robot can't go on: shown as interrupted."""
    limit = datetime.now(timezone.utc) - STALE_AFTER
    with SessionLocal() as db:
        stuck = db.query(SobrusRun).filter(SobrusRun.status == "running", SobrusRun.heartbeat_at < limit).all()
        for run in stuck:
            run.status = "error"
            run.error_code = "sobrusInterrupted"
            run.phase = None
            run.ended_at = datetime.now(timezone.utc)
        db.commit()
        if stuck:
            log.info("%d interrupted Sobrus run(s) closed", len(stuck))


def claim() -> int | None:
    with SessionLocal() as db:
        run = (
            db.query(SobrusRun)
            .filter(SobrusRun.status == "queued")
            .order_by(SobrusRun.id)
            .with_for_update(skip_locked=True)
            .first()
        )
        if run is None:
            return None
        run.status = "running"
        run.started_at = run.heartbeat_at = datetime.now(timezone.utc)
        db.commit()
        return run.id


def wait_for_schema() -> None:
    """DigitalOcean starts the API and the worker together: the API migrates, the worker waits until the
    database is at this code's revision (else a new column would be missing)."""
    head = ScriptDirectory.from_config(Config(str(BACKEND_DIR / "alembic.ini"))).get_current_head()
    while True:
        with engine.connect() as c:
            if MigrationContext.configure(c).get_current_revision() == head:
                return
        log.info("Waiting for the API's migrations (head %s)…", head)
        clock.sleep(2)


def _listen():
    """A Postgres connection of its own, outside the pool (a pooled one is taken back and closed under us), LISTENing
    to `sobrus_runs`. TCP keepalives: a connection the database drops (DigitalOcean idle limit, maintenance) fails at
    once instead of hanging."""
    # Direct, never through DigitalOcean's pool (PgBouncer in transaction mode does not keep a LISTEN).
    url = make_url(settings.direct_database_url).set(drivername="postgresql").render_as_string(hide_password=False)
    raw = psycopg2.connect(url, keepalives=1, keepalives_idle=60, keepalives_interval=10, keepalives_count=3)
    raw.autocommit = True
    raw.cursor().execute(f"LISTEN {CHANNEL}")
    return raw


def requeue(run_id: int) -> None:
    """This robot is stopping in the middle of a run (`make worker` restarts it when the code changes, a deploy stops
    it): the run goes back in the queue, so the next robot takes it at once (a product import resumes at its last
    page) instead of « running » for STALE_AFTER."""
    with SessionLocal() as db:
        run = db.get(SobrusRun, run_id)
        if run is None or run.status != "running":
            return
        run.status, run.phase, run.started_at, run.heartbeat_at = "queued", None, None, None
        run.events = [*run.events, {"at": datetime.now(timezone.utc).isoformat(), "code": "requeued"}]
        db.commit()
    log.info("Sobrus run %s back in the queue: this robot is stopping", run_id)


def _stop_on_sigterm(*_) -> None:
    """`docker stop`, a deploy: like Ctrl+C (the run in progress goes back in the queue)."""
    raise SystemExit(0)


def describe(run_id: int) -> str:
    """« products · Pharmacie Demo (pharmacy 1), by user 3 »."""
    with SessionLocal() as db:
        run = db.get(SobrusRun, run_id)
        if run is None:  # deleted meanwhile (its pharmacy deleted)
            return f"run {run_id} (deleted)"
        pharmacy = db.get(Pharmacy, run.pharmacy_id)
        dates = f" {run.date_from} → {run.date_to}" if run.mode == "range" else ""
        who = f"by user {run.created_by}" if run.created_by else "nightly"
        return f"{run.mode}{dates} · {pharmacy.name if pharmacy else '?'} (pharmacy {run.pharmacy_id}), {who}"


def result(run_id: int) -> str:
    with SessionLocal() as db:
        run = db.get(SobrusRun, run_id)
        if run is None:
            return "deleted"
        if run.status == "error":
            return f"error {run.error_code}"
        return f"{run.status}, {run.lines_added:,} line(s) / product(s) added".replace(",", " ")


def _duration(seconds: float) -> str:
    """75.4 → « 1 min 15 s »."""
    minutes, rest = divmod(int(seconds), 60)
    return f"{minutes} min {rest} s" if minutes else f"{seconds:.1f} s"


def main() -> None:
    wait_for_schema()
    listen = None
    while True:
        try:
            if listen is None:
                listen = _listen()
            schedule_nightly()
            with SessionLocal() as db:  # « Promis »: « Prêt » past its 7 days → « Expiré » (not a Sobrus call)
                expire_overdue(db)
            recover()
            while (run_id := claim()) is not None:
                log.info("Sobrus run %s started: %s", run_id, describe(run_id))
                began = clock.monotonic()
                try:
                    execute(run_id)
                except (KeyboardInterrupt, SystemExit):  # stopped (code changed in dev, deploy): the next robot goes on
                    requeue(run_id)
                    raise
                log.info("Sobrus run %s ended in %s: %s", run_id, _duration(clock.monotonic() - began), result(run_id))
            # Sleep until the API queues a run, at most TICK_S (tonight's runs, a stopped robot's).
            if select.select([listen], [], [], TICK_S)[0]:
                listen.poll()
                listen.notifies.clear()
        # The LISTEN connection itself dropped (idle limit, maintenance): a new one, no traceback. (The pool's errors
        # come wrapped by SQLAlchemy, other classes: below.)
        except (psycopg2.InterfaceError, psycopg2.OperationalError):
            log.info("Sobrus robot: LISTEN connection closed, opening a new one")
            if listen is not None and not listen.closed:
                listen.close()
            listen = None
            clock.sleep(1)
        except Exception:  # the database restarted (DigitalOcean maintenance…): again in TICK_S
            log.exception("Sobrus robot")
            if listen is not None:
                listen.close()
            listen = None
            clock.sleep(TICK_S)


if __name__ == "__main__":
    # Same look as the API's log (uvicorn: « INFO:     … », colored in a terminal).
    handler = logging.StreamHandler()
    handler.setFormatter(DefaultFormatter("%(levelprefix)s %(message)s", use_colors=None))
    logging.basicConfig(level=logging.INFO, handlers=[handler])
    # httpx logs every URL at INFO: the Sobrus login URLs carry its one-time `code` / `state`.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("alembic").setLevel(logging.WARNING)  # « Context impl … » at every schema check
    signal.signal(signal.SIGTERM, _stop_on_sigterm)
    init_sentry("worker")
    try:
        main()
    except KeyboardInterrupt:  # Ctrl+C, or `make worker` reloading after a code change
        log.info("Sobrus robot stopped")
