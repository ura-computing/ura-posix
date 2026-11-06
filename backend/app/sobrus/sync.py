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

Every run but `check` / `products` ends with today's stock (a snapshot, not dated lines: the wizard's « Stock »
upsert); its rows are not counted in `lines_added` (= new achats + ventes). Sobrus sends the stock as
JSON (its page builds the CSV in the browser): `_stock_rows` turns it into the CSV's rows. Then the « Clôture de
caisse » of the run's days (`closing`, JSON report, one call per month, one row per day; only the owner's Sobrus
login may read it: refused = noted on the connection, the run goes on).

  products  (the admin, per pharmacy) Sobrus' product list page by page into the catalogue: a new PID is added,
            a known one only gets its empty fields filled; logged in the pharmacy's « Historique ».

Each step is written on the run (`phase`, counters, `events`) so the page shows it live. A problem
updates the connection: password refused → `invalid` (never retried), Sobrus asks a check →
`needs_login`; the owner gets one email per problem."""

from __future__ import annotations

import json
import logging
import os
import time
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from itertools import batched

from sqlalchemy import and_, case, func, literal_column, or_
from sqlalchemy.dialects.postgresql import insert

from cryptography.fernet import InvalidToken
from sqlalchemy.orm import Session

from app.core.audit import AuditAction, log_action
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.email_service import send_sobrus_problem
from app.core.models import ImportBatch, Medicament, SobrusCashClosing, SobrusConnection, SobrusRun, User
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
from app.sobrus.catalog_import import chain_since, queue_next, tried
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
# « Tout l'historique »: the closing from 1 January of last year (1 call per month; older days: « Choisir les dates »).
CLOSING_FULL_YEARS = 1
# Sobrus gives 21 products per page, whatever page size is asked (tested 2026-11-06), and no total: pages are fetched
# PRODUCTS_PARALLEL at a time, PRODUCTS_BATCH per database write.
# Measured on the real Sobrus (200 pages): 1 at a time 108 ms / page, 2 = 60 ms (a few 429), 3 = 52 ms (many 429).
PRODUCTS_PARALLEL = int(os.environ.get("SOBRUS_PRODUCTS_PARALLEL", "2"))
PRODUCTS_BACKOFF_S = (1, 2, 4, 8, 16, 30)  # a 429 on a product page: its rate limit, seconds (the login's are minutes)
PRODUCTS_BATCH = 40
PRODUCTS_MAX_PAGES = 10000  # 210 000 products: never an endless loop on a Sobrus that repeats its last page
PRODUCT_COLUMNS = "laboratory_supplier_id,product_dci_id"
# Catalogue fields a fetch may fill (only when empty): medicament column → Sobrus product → value.
PRODUCT_FILL = ("barcode1", "tva", "ppv", "pph", "category", "laboratoire", "dci", "galenic_form")


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


def _num(v) -> float:
    """Sobrus amounts come as text or numbers, sometimes null."""
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def _label(ref) -> str | None:
    """A Sobrus reference {ID, label} → its label (None when empty)."""
    return (ref or {}).get("label") or None if isinstance(ref, dict) else None


def _closing_rows(data: dict, methods: dict[str, dict]) -> list[dict]:
    """Sobrus' cash desk closing report (`by_day=1`: every block keyed by day) → one row per day with a sale line."""
    customers = data.get("customers_info") or {}
    rows = []
    for day, st in (data.get("sales_stats") or {}).items():
        by_method = {}
        for method_id, amounts in ((data.get("income_by_method") or {}).get(day) or {}).items():
            m = methods.get(str(method_id), {"code": str(method_id), "label": str(method_id)})
            values = {k: _num((amounts or {}).get(k)) for k in ("settlements", "advances", "expenses", "other")}
            values["cash_sales"] = _num((amounts or {}).get("payments_on_cash_sales"))
            if any(values.values()):
                by_method[m["code"]] = {"label": m["label"], **values}
        by_customer = [
            {
                "name": (customers.get(str(cid)) or {}).get("name") or str(cid),
                "credit": _num(amount),
                "balance": _num((customers.get(str(cid)) or {}).get("balance")),
            }
            for cid, amount in ((data.get("credit_sales_stats_by_customer") or {}).get(day) or {}).items()
        ]
        rows.append(
            {
                "day": date.fromisoformat(day[:10]),
                "invoices": int(_num(st.get("invoices_count"))),
                "total": _num(st.get("total")),
                "paid": _num(st.get("paid")),
                "unpaid": _num(st.get("unpaid")),
                "discount": _num(st.get("total_discount")),
                "cash_sales": _num(st.get("total_cash_sales")),
                "credit_sales": _num(st.get("total_credit_sales")),
                "unpaid_credit": _num(st.get("total_unpaid_credit_sales")),
                "returns": _num(st.get("total_sales_returns")),
                "net": _num(st.get("net")),
                "gross_total": _num(st.get("gross_total")),
                "by_method": by_method,
                "by_customer": sorted(by_customer, key=lambda c: -c["credit"]),
            }
        )
    return rows


def _product_values(p: dict) -> dict:
    """One product of Sobrus' list → the catalogue's columns (same text as its CSV exports: « TVA (20.00%) »)."""
    price = lambda v: _num(v) if v not in (None, "") else None  # noqa: E731
    return {
        "product": (p.get("name") or "").strip(),
        "barcode1": (p.get("barcode") or "").strip() or None,
        "tva": _label(p.get("sale_tax_id")),
        "ppv": price(p.get("sale_price")),
        "pph": price(p.get("purchase_price")),
        "category": _label(p.get("product_category_id")),
        "laboratoire": _label(p.get("laboratory_supplier_id")),
        "dci": _label(p.get("product_dci_id")),
        "galenic_form": _label(p.get("product_galenic_form_id")),
    }


def _months(start: date, end: date) -> list[tuple[date, date]]:
    """2026-01-15 → 2026-03-02 = (01-15, 01-31), (02-01, 02-28), (03-01, 03-02)."""
    out = []
    first = start
    while first <= end:
        nxt = date(first.year + first.month // 12, first.month % 12 + 1, 1)
        out.append((first, min(end, nxt - timedelta(days=1))))
        first = nxt
    return out


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

    def new_start(self) -> date:
        """The nightly run's first day: the last success − NEW_DAYS_BACK (1 January when never)."""
        last = today()
        since = (
            self.conn.last_success_at.astimezone(PHARMACY_TZ).date()
            if self.conn.last_success_at
            else date(last.year, 1, 1)
        )
        return min(since - timedelta(days=NEW_DAYS_BACK), last)

    def new(self) -> None:
        last = today()
        start = self.new_start()
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

    def _get(self, path: str, params: dict) -> dict | list:
        """A JSON read: 429 = the login's waits then again; session over = logged in again once (refused again:
        SessionExpired goes up, the caller decides)."""
        for wait in (*BUSY_WAITS, None):
            try:
                try:
                    return self.client.get_json(path, params)
                except SessionExpired:
                    self.login(force=True)
                    return self.client.get_json(path, params)
            except SobrusError as e:
                if e.code != "sobrusBusy" or wait is None:
                    raise
                _event(self.db, self.run, "login_busy", n=int(wait))
                self._wait(wait)
        raise SobrusError("sobrusBusy")  # not reached: the loop returns or raises

    def closing(self, start: date, end: date) -> None:
        """The « Clôture de caisse » of these days, one call per month, one row per day (replaced). Refused (only the
        owner's Sobrus login may read it) or failed: noted, the run goes on (its achats / ventes are in)."""
        months = _months(start, end)
        try:
            methods = {
                str(m.get("id")): {"code": m.get("name") or str(m.get("id")), "label": m.get("label") or ""}
                for m in self._get("/paymentmethods", {})
            }
            days = 0
            for i, (first, last) in enumerate(months):
                if _cancel_requested(self.db, self.run):
                    raise Cancelled()
                _set(
                    self.db,
                    self.run,
                    phase="closing",
                    kind=None,
                    year=first.year,
                    chunk_current=i + 1,
                    chunk_total=len(months),
                )
                params = {"start_date": first.isoformat(), "end_date": last.isoformat(), "by_day": 1, "advanced": 1}
                rows = _closing_rows(self._get("/reports/cashdeskclosing", params).get("data") or {}, methods)
                for row in rows:
                    values = {**row, "pharmacy_id": self.run.pharmacy_id, "fetched_at": _now()}
                    stmt = insert(SobrusCashClosing).values(**values)
                    self.db.execute(
                        stmt.on_conflict_do_update(
                            constraint="uq_sobrus_cash_closings_pharmacy_day",
                            set_={k: stmt.excluded[k] for k in values if k not in ("pharmacy_id", "day")},
                        )
                    )
                days += len(rows)
                self.db.commit()
        except SessionExpired:
            self.conn.closing_access = False
            _event(self.db, self.run, "closing_no_access")
            return
        except SobrusError as e:
            self.db.rollback()
            log.warning("Sobrus closing %s → %s: %s", start, end, e.code)
            _event(self.db, self.run, "closing_failed", error=e.code)
            return
        except (KeyError, TypeError, ValueError, AttributeError):  # not the JSON Sobrus sends today
            self.db.rollback()
            log.exception("Sobrus closing %s → %s: unexpected answer", start, end)
            _event(self.db, self.run, "closing_failed", error="sobrusExportFailed")
            return
        self.conn.closing_access = True
        _event(self.db, self.run, "closing_done", start=start.isoformat(), end=end.isoformat(), n=days)

    def _fetch_pages(self, pages: list[int]) -> list[list[dict]]:
        """These product pages from Sobrus, PRODUCTS_PARALLEL at a time (a request ≈ 70 ms, so waiting for each one in
        turn was most of the time). Only HTTP in the threads (the database session stays here); a page refused is asked
        again here: 429 → after a short wait, session over → after a new login (`_get`)."""
        params = lambda page: {"extra_columns": PRODUCT_COLUMNS, "page": page, "limit": 21}  # noqa: E731
        with ThreadPoolExecutor(max_workers=PRODUCTS_PARALLEL) as pool:
            futures = [pool.submit(self.client.get_json, "/products", params(page)) for page in pages]
        out = []
        for page, future in zip(pages, futures):
            try:
                answer = future.result()
            except SobrusError as e:
                if e.code != "sobrusBusy":
                    raise
                answer = self._product_page_again(params(page))
            except SessionExpired:
                try:
                    answer = self._get("/products", params(page))  # logs in again once
                except SessionExpired as refused:  # this account may not list the products: the next one is tried
                    raise SobrusError("sobrusNoAccess") from refused
            out.append((answer.get("data") if isinstance(answer, dict) else None) or [])
        return out

    def _product_page_again(self, params: dict) -> dict | list:
        """A page Sobrus refused with 429 (its rate limit, not the login's): asked again after 1 s, 2 s, 4 s…"""
        for wait in PRODUCTS_BACKOFF_S:
            time.sleep(wait)
            try:
                return self.client.get_json("/products", params)
            except SobrusError as e:
                if e.code != "sobrusBusy":
                    raise
        raise SobrusError("sobrusBusy")

    def _upsert_products(self, found: dict[str, dict]) -> tuple[int, int]:
        """One statement for a batch: a new PID is inserted, a known one gets only its empty fields (never the admin's
        values, never the name). → (added, filled)."""
        stmt = insert(Medicament).values([{"pid": pid, **values} for pid, values in found.items()])
        new = stmt.excluded
        table = Medicament.__table__.c

        def empty(col):
            return col.is_(None) if col.name in ("ppv", "pph") else or_(col.is_(None), col == "")

        stmt = stmt.on_conflict_do_update(
            index_elements=[table.pid],
            set_={
                **{f: case((empty(table[f]), new[f]), else_=table[f]) for f in PRODUCT_FILL},
                "updated_at": func.now(),
            },
            where=or_(*(and_(empty(table[f]), new[f].is_not(None)) for f in PRODUCT_FILL)),
        ).returning(literal_column("xmax = 0"))
        inserted = [row[0] for row in self.db.execute(stmt)]
        added = sum(1 for x in inserted if x)
        return added, len(inserted) - added

    def products(self) -> None:
        """Sobrus' product list into the catalogue (21 a page, no total: until an empty page): PRODUCTS_BATCH pages
        fetched together, then one upsert (a new PID is added, « non classé » for the admin; a known one only gets its
        empty fields filled), one commit with the progress, one « Arrêter » check. Deactivated products are left out."""
        added = filled = 0
        page = 0
        _set(self.db, self.run, phase="products", kind=None, year=None, chunk_current=0, chunk_total=0)
        while page < PRODUCTS_MAX_PAGES:
            if _cancel_requested(self.db, self.run):
                raise Cancelled()
            pages = list(range(page + 1, min(page + PRODUCTS_BATCH, PRODUCTS_MAX_PAGES) + 1))
            answers = self._fetch_pages(pages)
            found: dict[str, dict] = {}
            last = False
            for number, items in zip(pages, answers):
                if not items:  # the end of the list
                    last = True
                    break
                page = number
                for p in items:
                    if p.get("ID") and p.get("name") and not _label(p.get("deactivation_reason")):
                        found[str(p["ID"])] = _product_values(p)  # a product listed twice: kept once
            if found:
                a, f = self._upsert_products(found)
                added, filled = added + a, filled + f
            _set(self.db, self.run, chunk_current=page, lines_added=added)  # commits the batch
            if last:
                break
        admin = self.db.get(User, self.run.created_by) if self.run.created_by else None
        log_action(
            self.db,
            admin,
            self.run.pharmacy_id,
            AuditAction.SOBRUS_PRODUCTS_FETCHED,
            {"added": added, "filled": filled},
        )
        _event(self.db, self.run, "products_done", n=added, filled=filled)


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
            closing_from = None
            if run.mode == "full":
                robot.full()
                closing_from = date(today().year - CLOSING_FULL_YEARS, 1, 1)
            elif run.mode == "new":
                closing_from = robot.new_start()
                robot.new()
            elif run.mode == "range":
                robot.period(run.date_from, run.date_to)
            elif run.mode == "products":
                robot.products()
            elif run.mode != "check":  # a mode this robot does not know (an older robot after a deploy): never « done »
                raise SobrusError("serverError")
            if run.mode not in ("check", "products"):
                robot.stock()
                if run.mode == "range":
                    robot.closing(run.date_from, run.date_to)
                else:
                    robot.closing(closing_from, today())
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
            if run.mode == "products":  # the admin's catalogue import: the next owner's account
                since = chain_since(run)
                queue_next(db, since, run.created_by, tried(db, since))
        except Exception:
            log.exception("sobrus run %s failed", run_id)
            db.rollback()
            _finish(db, run, "error", "serverError")
        finally:
            if robot is not None:
                robot.client.close()
