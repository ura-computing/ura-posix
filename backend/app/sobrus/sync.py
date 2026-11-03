"""One run of the Sobrus robot (claimed by `worker.py`). Same import as the browser wizard
(`app/ingestion/service.py`): chunks of 2000 rows, one batch per file, lines already stored by
another import skipped, the batch's end in the history.

  full   achats then ventes, every year from this one back (this year: 1 January → today), until
         EMPTY_YEARS_TO_STOP years in a row without a line (the pharmacy's start on Sobrus)
  new    achats then ventes, from the last success − NEW_DAYS_BACK days to today (every night)
  check  login only (a password just saved)
  range  achats then ventes, the owner's dates year by year from the newest (Sobrus exports 1 year at
         most): 2014-03-01 → 2025-08-01 = 2025-01-01 → 2025-08-01, 2024-01-01 → 2024-12-31, …,
         2014-03-01 → 2014-12-31

Every run but `check` ends with today's stock (a snapshot, not dated lines: the wizard's « Stock »
upsert); its rows are not counted in `lines_added` (= new achats + ventes). Sobrus sends the stock as
JSON (its page builds the CSV in the browser): `_stock_rows` turns it into the CSV's rows.

Each step is written on the run (`phase`, counters, `events`) so the page shows it live. A problem
updates the connection: password refused → `invalid` (never retried), Sobrus asks a check →
`needs_login`; the owner gets one email per problem."""

from __future__ import annotations

import json
import logging
import os
import time
from collections.abc import Iterator
from datetime import date, datetime, timedelta, timezone
from itertools import batched

from cryptography.fernet import InvalidToken
from sqlalchemy.orm import Session

from app.core.audit import AuditAction, log_action
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.email_service import send_sobrus_problem
from app.core.models import ImportBatch, SobrusConnection, SobrusRun, User
from app.core.utils import PHARMACY_TZ, today
from app.ingestion.csv_parse import iter_csv, parse_int
from app.ingestion.service import (
    ACHAT_CFG,
    COL_BARCODE1,
    COL_BARCODE2,
    COL_CATEGORY,
    COL_EXPIRY,
    COL_PID,
    COL_PPH,
    COL_PPV,
    COL_PRODUCT,
    COL_STOCK_MAX,
    COL_STOCK_MIN,
    COL_TVA,
    COL_ZONE,
    VENTE_CFG,
    end_batch,
    insert_stock,
    insert_transactions,
)
from app.sobrus.crypto import decrypt, encrypt
from app.sobrus.sobrus_client import SessionExpired, SobrusClient, SobrusError

log = logging.getLogger("uvicorn.error")

CHUNK_SIZE = 2000  # same as the browser wizard (frontend/src/hooks/UploadContext.tsx)
EMPTY_YEARS_TO_STOP = 5
OLDEST_YEAR = 2000  # never earlier, whatever Sobrus answers
NEW_DAYS_BACK = 3  # a late Sobrus correction of the last days still comes
KINDS = ("achat", "vente")
CFG = {"achat": ACHAT_CFG, "vente": VENTE_CFG}
FILE_LABEL = {"achat": "Achats", "vente": "Ventes"}
# Problems the owner must fix (email + banner); the others are retried the next night.
NEEDS_OWNER = {"sobrusBadCredentials": "invalid", "sobrusNeedsAction": "needs_login"}
FAILED_NIGHTS_TO_EMAIL = 3
# Sobrus answers 429 (too many logins): wait, then log in again, at most this many times (seconds; E2E: short).
BUSY_WAITS = tuple(float(x) for x in os.environ.get("SOBRUS_BUSY_WAITS", "60,300").split(",") if x.strip())


def _stock_rows(content: bytes) -> list[dict[str, str]]:
    """Sobrus' stock export {"data": {"stock": [{ID, name, stock, product_category_id, …}],
    "product_categories" | "taxes" | "zones": {id: name}}} → the rows of its « Stock » CSV, so the
    same import as the wizard reads them (`insert_stock`). Like that CSV, only the products whose
    stock is not 0 (checked on a real export: same 5 959 rows, every column equal)."""
    try:
        data = json.loads(content)["data"]
        names = {k: data.get(k) or {} for k in ("product_categories", "taxes", "zones")}
        return [
            {
                COL_PID: str(p["ID"]),
                COL_PRODUCT: p.get("name") or "",
                COL_CATEGORY: names["product_categories"].get(str(p.get("product_category_id")), ""),
                COL_TVA: names["taxes"].get(str(p.get("purchase_tax_id")), ""),
                COL_PPV: p.get("sale_price") or "",
                COL_PPH: p.get("purchase_price") or "",
                COL_ZONE: names["zones"].get(str(p.get("zone_id")), ""),
                "Stock": str(p.get("stock") or 0),
                COL_EXPIRY: p.get("expiry_date") or "",
                COL_STOCK_MIN: str(p["min_stock"]) if p.get("min_stock") is not None else "",
                COL_STOCK_MAX: str(p["max_stock"]) if p.get("max_stock") is not None else "",
                COL_BARCODE1: p.get("barcode") or "",
                COL_BARCODE2: p.get("barcode_2") or "",
            }
            for p in data["stock"]
            if parse_int(str(p.get("stock") or 0))
        ]
    except (ValueError, KeyError, TypeError) as e:  # not the JSON Sobrus sends today
        raise SobrusError("sobrusExportFailed") from e


class Cancelled(Exception):
    """« Arrêter » clicked: the running file was undone."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _set(db: Session, run: SobrusRun, **fields) -> None:
    """Progress on the run + its heartbeat (a silent run = its robot stopped: `worker.recover`)."""
    for k, v in fields.items():
        setattr(run, k, v)
    run.heartbeat_at = _now()
    db.commit()


def _event(db: Session, run: SobrusRun, code: str, **data) -> None:
    """One line of the run's story (`sobrus.event.<code>` on the page)."""
    run.events = [*run.events, {"at": _now().isoformat(), "code": code, **data}]
    run.heartbeat_at = _now()
    db.commit()


def _cancel_requested(db: Session, run: SobrusRun) -> bool:
    db.refresh(run, ["cancel_requested"])
    return run.cancel_requested


class Robot:
    """One run, its connection, its Sobrus session."""

    def __init__(self, db: Session, run: SobrusRun, conn: SobrusConnection, owner: User | None) -> None:
        self.db, self.run, self.conn, self.owner = db, run, conn, owner
        try:
            cookies = json.loads(decrypt(conn.session_enc)) if conn.session_enc else None
        except InvalidToken:  # saved with another key (`crypto.py`): log in again
            cookies = None
        self.client = SobrusClient(cookies)

    def _save_session(self) -> None:
        self.conn.session_enc = encrypt(json.dumps(self.client.cookies()))
        self.db.commit()

    def login(self, *, force: bool = False) -> None:
        _set(self.db, self.run, phase="login", kind=None, year=None)
        _event(self.db, self.run, "login_start")
        if not force and self.conn.session_enc and self.client.session_alive():
            _event(self.db, self.run, "session_reused")
            return
        try:
            password = decrypt(self.conn.password_enc)
        except InvalidToken as e:  # saved with another key (JWT_SECRET changed): the owner types it again
            raise SobrusError("sobrusBadCredentials") from e
        for wait in (*BUSY_WAITS, None):
            try:
                self.client.login(self.conn.email, password)
                break
            except SobrusError as e:
                if e.code != "sobrusBusy" or wait is None:
                    raise
                _event(self.db, self.run, "login_busy", n=int(wait))
                self._wait(wait)
        self._save_session()
        _event(self.db, self.run, "login_ok")

    def _wait(self, seconds: float) -> None:
        """Before logging in again: the heartbeat goes on (not « stopped »), « Arrêter » works."""
        end = time.monotonic() + seconds
        while (left := end - time.monotonic()) > 0:
            time.sleep(min(5.0, left))
            if _cancel_requested(self.db, self.run):
                raise Cancelled()
            _set(self.db, self.run, phase="login")

    def _download(self, kind: str, year: int | None, start: str | None, end: str | None) -> bytes:
        _set(
            self.db, self.run, phase="download", kind=kind, year=year, bytes_received=0, chunk_current=0, chunk_total=0
        )

        def shown(n: int) -> None:
            _set(self.db, self.run, bytes_received=n)

        try:
            return self.client.export(kind, start, end, shown)
        except SessionExpired:  # ended during the run (≈ 4 days): log in again, once
            self.login(force=True)
            _set(self.db, self.run, phase="download", kind=kind, year=year, bytes_received=0)
            try:
                return self.client.export(kind, start, end, shown)
            except SessionExpired as e:
                log.warning("Sobrus export %s refused again after a new login: Sobrus asks something", kind)
                raise SobrusError("sobrusNeedsAction") from e

    def import_file(self, kind: str, year: int | None, start: str | None, end: str | None) -> int | None:
        """Lines added from Sobrus' export (achat / vente of these days, or today's stock); None =
        Sobrus had no line."""
        if _cancel_requested(self.db, self.run):  # before a download that can take a while
            raise Cancelled()
        content = self._download(kind, year, start, end)

        # Read 2 000 lines at a time, twice: a year of sales all at once = 400 MB, more than DigitalOcean's
        # 512 MB with the API next to it. The 1st pass counts them (« paquet x / y ») and refuses a broken file.
        def lines() -> Iterator[dict[str, str]]:
            return iter(_stock_rows(content)) if kind == "stock" else iter_csv(content)

        total = 0
        for r in lines():
            total += 1
            if any("\x00" in v for v in r.values()):
                raise SobrusError("fileCorrupted")
        if not total:
            return None
        _set(self.db, self.run, phase="import", chunk_total=-(-total // CHUNK_SIZE), chunk_current=0)
        filename = (
            f"Sobrus - Stock {today():%Y%m%d}.csv"  # the wizard's name (frontend/src/utils/csv.ts)
            if kind == "stock"
            else f"Sobrus - {FILE_LABEL[kind]} {start} - {end}.csv"
        )
        batch_id: int | None = None
        added = 0
        try:
            for i, chunk in enumerate(batched(lines(), CHUNK_SIZE)):
                part = list(chunk)
                if _cancel_requested(self.db, self.run):
                    raise Cancelled()
                args = {
                    "pharmacy_id": self.run.pharmacy_id,
                    "filename": filename,
                    "batch_id": batch_id,
                    "user_id": self.owner.id if self.owner else None,
                }
                if kind == "stock":
                    result = insert_stock(self.db, part, **args)
                else:
                    result = insert_transactions(self.db, part, cfg=CFG[kind], **args)
                batch_id = result["batch_id"]
                added += result["inserted"]
                lines = self.run.lines_added + (0 if kind == "stock" else result["inserted"])
                _set(self.db, self.run, chunk_current=i + 1, lines_added=lines)
        except BaseException as e:
            # The file stops here: cancelled = its rows removed (like « Annuler l'import »), else kept as error.
            self.db.rollback()
            if batch_id is not None:
                batch = self.db.get(ImportBatch, batch_id)
                status = "cancelled" if isinstance(e, Cancelled) else "error"
                end_batch(self.db, batch, status, self.owner, None if status == "cancelled" else "Sobrus robot")
            raise
        end_batch(self.db, self.db.get(ImportBatch, batch_id), "success", self.owner)
        return added

    def full(self) -> None:
        last = today()
        for kind in KINDS:
            empty = 0
            year = last.year
            while empty < EMPTY_YEARS_TO_STOP and year >= OLDEST_YEAR:
                end = last.isoformat() if year == last.year else f"{year}-12-31"
                added = self.import_file(kind, year, f"{year}-01-01", end)
                if added is None:
                    empty += 1
                    _event(self.db, self.run, "year_empty", kind=kind, year=year)
                else:
                    empty = 0
                    _event(self.db, self.run, "year_done", kind=kind, year=year, n=added)
                year -= 1

    def new(self) -> None:
        last = today()
        since = (
            self.conn.last_success_at.astimezone(PHARMACY_TZ).date()
            if self.conn.last_success_at
            else date(last.year, 1, 1)
        )
        start = min(since - timedelta(days=NEW_DAYS_BACK), last)
        for kind in KINDS:
            added = self.import_file(kind, last.year, start.isoformat(), last.isoformat())
            _event(
                self.db, self.run, "period_done", kind=kind, start=start.isoformat(), end=last.isoformat(), n=added or 0
            )

    def stock(self) -> None:
        added = self.import_file("stock", None, None, None)
        _event(self.db, self.run, "stock_done", kind="stock", n=added or 0)

    def period(self, start: date, end: date) -> None:
        for kind in KINDS:
            for year in range(end.year, start.year - 1, -1):
                first, last = max(start, date(year, 1, 1)), min(end, date(year, 12, 31))
                added = self.import_file(kind, year, first.isoformat(), last.isoformat())
                _event(
                    self.db,
                    self.run,
                    "period_done",
                    kind=kind,
                    start=first.isoformat(),
                    end=last.isoformat(),
                    n=added or 0,
                )


def _problem(db: Session, run: SobrusRun, conn: SobrusConnection, owner: User | None, code: str) -> None:
    """The connection's state after a failed run + one email to the owner per problem."""
    conn.last_error_code = code
    must_fix = code in NEEDS_OWNER
    if must_fix:
        conn.status = NEEDS_OWNER[code]
        if code == "sobrusBadCredentials":
            conn.session_enc = None
        log_action(db, owner, conn.pharmacy_id, AuditAction.SOBRUS_LOGIN_REFUSED, {"email": conn.email, "reason": code})
    elif run.mode == "new" and run.created_by is None:  # the nightly run
        conn.failed_nights += 1
    notify = must_fix or conn.failed_nights >= FAILED_NIGHTS_TO_EMAIL
    if notify and conn.problem_notified_at is None and owner is not None:
        send_sobrus_problem(
            to=owner.email,
            name=owner.name or owner.email,
            needs_password=code == "sobrusBadCredentials",
            app_url=f"{settings.FRONTEND_URL}/sobrus",
        )
        conn.problem_notified_at = _now()
    db.commit()


def _finish(db: Session, run: SobrusRun, status: str, error_code: str | None = None) -> None:
    run.status = status
    run.error_code = error_code
    run.phase = None
    run.ended_at = _now()
    run.events = [
        *run.events,
        {"at": _now().isoformat(), "code": f"run_{status}", **({"error": error_code} if error_code else {})},
    ]
    db.commit()


def execute(run_id: int) -> None:
    """Runs one claimed run to its end; never raises (the worker goes on with the next one)."""
    with SessionLocal() as db:
        run = db.get(SobrusRun, run_id)
        if run is None:
            return
        conn = db.query(SobrusConnection).filter_by(pharmacy_id=run.pharmacy_id).first()
        if conn is None:
            _finish(db, run, "error", "sobrusNotConnected")
            return
        owner = db.get(User, conn.created_by) if conn.created_by else None
        robot: Robot | None = None
        try:
            robot = Robot(db, run, conn, owner)
            robot.login()
            if run.mode == "full":
                robot.full()
            elif run.mode == "new":
                robot.new()
            elif run.mode == "range":
                robot.period(run.date_from, run.date_to)
            if run.mode != "check":
                robot.stock()
            robot._save_session()  # cookies refreshed during the run
            conn.status = "active"
            conn.last_error_code = None
            conn.failed_nights = 0
            conn.problem_notified_at = None
            if run.mode in ("full", "new"):  # up to today: the nightly run starts from it
                conn.last_success_at = _now()
            db.commit()
            _finish(db, run, "success")
        except Cancelled:
            _finish(db, run, "cancelled")
        except SobrusError as e:
            db.rollback()
            _problem(db, run, conn, owner, e.code)
            _finish(db, run, "error", e.code)
        except Exception:
            log.exception("sobrus run %s failed", run_id)
            db.rollback()
            _finish(db, run, "error", "serverError")
        finally:
            if robot is not None:
                robot.client.close()
