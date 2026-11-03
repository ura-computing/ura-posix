"""Wakes the Sobrus robot (`worker.py`, its own process, never inside the API) when the API queues a
run: Postgres `NOTIFY sobrus_runs`, sent with the run's INSERT (same transaction: no wake for a run that
was not saved). The robot LISTENs; it also looks every 30 s (tonight's runs, a stopped robot's)."""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import text
from sqlalchemy.orm import Session

CHANNEL = "sobrus_runs"
BACKEND_DIR = Path(__file__).resolve().parents[2]


def wake(db: Session) -> None:
    """Before `db.commit()`: Postgres delivers the NOTIFY at the commit."""
    db.execute(text(f"NOTIFY {CHANNEL}"))
