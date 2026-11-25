"""The admin's Sobrus runs: Catalogue « Importer les produits depuis Sobrus » (run mode `products`) and « Fournisseurs »
(run mode `suppliers`). Every pharmacy sees the same Sobrus base, so ONE owner's Sobrus account is read: the one that
worked last. Refused or failed → the robot queues the next connected pharmacy, until one works or none is left. The
runs of one click share their start (`since`, first event `products_try`, both modes), so the next try skips the
pharmacies already tried. The catalogue CSV import stays, for when Sobrus fails."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.models import SobrusConnection, SobrusRun

TRY = "products_try"


def chain_since(run: SobrusRun) -> datetime:
    """When the admin clicked (the runs of that click all carry it); never after the run itself (a run queued before
    `created_at` was set by `queue_next` got the database's transaction time, a few ms earlier)."""
    for e in run.events or []:
        if e.get("code") == TRY and e.get("since"):
            return min(datetime.fromisoformat(e["since"]), run.created_at)
    return run.created_at


def tried(db: Session, mode: str, since: datetime) -> set[int]:
    rows = db.query(SobrusRun.pharmacy_id).filter(SobrusRun.mode == mode, SobrusRun.created_at >= since)
    return {pid for (pid,) in rows}


def queue_next(db: Session, mode: str, since: datetime, created_by: int | None, exclude: set[int]) -> SobrusRun | None:
    """The next account to try: active connections, the last one that worked first; a pharmacy busy with another
    run is skipped. None = nobody left."""
    conns = (
        db.query(SobrusConnection)
        .filter(SobrusConnection.status == "active", SobrusConnection.pharmacy_id.notin_(exclude or {0}))
        .order_by(SobrusConnection.last_success_at.desc().nullslast(), SobrusConnection.id)
        .all()
    )
    for conn in conns:
        now = datetime.now(timezone.utc)
        run = SobrusRun(
            pharmacy_id=conn.pharmacy_id,
            mode=mode,
            status="queued",
            created_by=created_by,
            # Set here, not by the database: its now() is the transaction's start, before `since` (then the run would
            # not count as one of its click's tries).
            created_at=now,
            events=[{"at": now.isoformat(), "code": TRY, "since": since.isoformat()}],
        )
        db.add(run)
        try:
            db.commit()
        except IntegrityError:  # the partial unique index: this pharmacy has a run queued / running
            db.rollback()
            continue
        db.refresh(run)
        return run
    return None
