"""Starts the Sobrus robot (`worker.py`) only when there is work, as a child process of the backend:
no extra server component, nothing running between imports (no RAM, no polling).

  wake()    a run was just queued: starts the robot, unless this process already has one alive
  ticker()  every TICK_S in each backend process (FastAPI lifespan, main.py): queues tonight's « new »
            runs (from NIGHTLY_HOUR in Casablanca, once a day), closes the runs of a stopped robot,
            and wakes the robot when runs wait (left by a restart, or queued as it was exiting)

Two backend processes (uvicorn --workers 2) may start two robots: harmless, each run is taken by one."""

from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import sys
import threading
from datetime import datetime, time
from pathlib import Path

from sqlalchemy.exc import IntegrityError

from app.core.database import SessionLocal
from app.core.models import SobrusConnection, SobrusRun
from app.core.utils import PHARMACY_TZ

log = logging.getLogger("uvicorn.error")

TICK_S = float(os.environ.get("SOBRUS_TICK", "30"))
NIGHTLY_HOUR = 2
BACKEND_DIR = Path(__file__).resolve().parents[2]

_robot: subprocess.Popen | None = None
_lock = threading.Lock()


def wake() -> None:
    global _robot
    with _lock:
        if _robot is not None and _robot.poll() is None:  # poll() also reaps a robot that ended
            return
        _robot = subprocess.Popen([sys.executable, "-m", "app.sobrus.worker"], cwd=BACKEND_DIR)
        log.info("Sobrus robot started (pid %s)", _robot.pid)


def schedule_nightly() -> None:
    """Tonight's « new » run per active connection, once a day after NIGHTLY_HOUR (Casablanca)."""
    now = datetime.now(PHARMACY_TZ)
    if now.hour < NIGHTLY_HOUR:
        return
    since = datetime.combine(now.date(), time(NIGHTLY_HOUR), PHARMACY_TZ)
    with SessionLocal() as db:
        for conn in db.query(SobrusConnection).filter(SobrusConnection.status == "active").all():
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


def tick() -> None:
    from app.sobrus.worker import recover  # the robot's module, without starting it

    schedule_nightly()
    recover()
    with SessionLocal() as db:
        waiting = db.query(SobrusRun.id).filter(SobrusRun.status == "queued").first()
    if waiting:
        wake()
    elif _robot is not None:
        _robot.poll()  # reaps a robot that ended (no zombie process left)


async def ticker() -> None:
    while True:
        try:
            await asyncio.to_thread(tick)
        except Exception:
            log.exception("Sobrus ticker")
        await asyncio.sleep(TICK_S)
