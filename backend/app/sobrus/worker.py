"""The Sobrus robot's process: `python -m app.sobrus.worker`, started by the backend when a run is
queued (`launcher.wake`), in the backend's own container. No browser, no web server: it closes the
runs of a stopped robot, runs the queued ones one by one (`FOR UPDATE SKIP LOCKED`: a second robot
never takes the same one), then exits: nothing runs between imports."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from app.core.database import SessionLocal
from app.core.models import SobrusRun
from app.sobrus.sync import execute

log = logging.getLogger("uvicorn.error")

# A running run writes its heartbeat at every step (sync._set): silent this long = its robot stopped
# (deploy, restart). Longer than any step: a 300 s Sobrus read timeout, one ANALYZE.
STALE_AFTER = timedelta(minutes=10)


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


def main() -> None:
    recover()
    while (run_id := claim()) is not None:
        log.info("Sobrus run %s started", run_id)
        execute(run_id)
        log.info("Sobrus run %s ended", run_id)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s sobrus-robot %(levelname)s %(message)s")
    # httpx logs every URL at INFO: the Sobrus login URLs carry its one-time `code` / `state`.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    main()
