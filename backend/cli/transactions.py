"""Transactions category — list achats + ventes for the logged-in pharmacy.

Built primarily so you can verify the Upload cancel-undo flow:
  1. Upload a file via the Uploads category, note the returned batch_id
  2. Come here, "List achats by batch_id" → see N rows
  3. PATCH the batch to cancelled (via Uploads category)
  4. Re-list → expect 0 rows
"""
from __future__ import annotations

from typing import Callable

import questionary

from ._client import request
from ._output import print_request, print_response, success, warn


BACK = "__BACK__"

EP_ACHATS  = "/achats"
EP_VENTES  = "/ventes"
EP_IMPORTS = "/data/imports"

ERR_BAD_BATCH_ID = "batch_id must be an integer."


def _list(endpoint: str, params: dict | None = None) -> None:
    print_request("GET", endpoint, params)
    resp = request("GET", endpoint, params=params or None)
    print_response(resp)
    if resp.status_code == 200:
        d = resp.json()
        p = d.get("pagination", {})
        success(
            f"{len(d.get('data', []))} rows on page {p.get('page')}/{p.get('total_pages')} "
            f"(total = {p.get('total')})"
        )


# ─── Achats ──────────────────────────────────────────────────────────────────

def _list_achats_all() -> None:
    _list(EP_ACHATS, {"page": 1, "limit": 20})


def _list_achats_by_batch() -> None:
    bid = questionary.text("Batch id (from a previous Uploads call)").ask()
    if not bid: return
    try:
        _list(EP_ACHATS, {"batch_id": int(bid), "page": 1, "limit": 50})
    except ValueError:
        warn(ERR_BAD_BATCH_ID)


def _list_achats_by_date() -> None:
    df = questionary.text("date_from (YYYY-MM-DD, blank for none)").ask() or ""
    dt = questionary.text("date_to (YYYY-MM-DD, blank for none)").ask() or ""
    p: dict = {"page": 1, "limit": 20}
    if df.strip(): p["date_from"] = df.strip()
    if dt.strip(): p["date_to"]   = dt.strip()
    _list(EP_ACHATS, p)


def _list_achats_search() -> None:
    q = questionary.text("Search (product, supplier, ref)").ask()
    if not q: return
    _list(EP_ACHATS, {"search": q, "page": 1, "limit": 20})


# ─── Ventes ──────────────────────────────────────────────────────────────────

def _list_ventes_all() -> None:
    _list(EP_VENTES, {"page": 1, "limit": 20})


def _list_ventes_by_batch() -> None:
    bid = questionary.text("Batch id").ask()
    if not bid: return
    try:
        _list(EP_VENTES, {"batch_id": int(bid), "page": 1, "limit": 50})
    except ValueError:
        warn(ERR_BAD_BATCH_ID)


def _list_ventes_search() -> None:
    q = questionary.text("Search (product, client, transaction_ref)").ask()
    if not q: return
    _list(EP_VENTES, {"search": q, "page": 1, "limit": 20})


# ─── Imports history (Page 5) ────────────────────────────────────────────────

def _list_imports() -> None:
    _list(EP_IMPORTS, {"page": 1, "limit": 20})


def _delete_import() -> None:
    bid = questionary.text("ImportBatch id to DELETE (cascades to Achat/Vente rows)").ask()
    if not bid: return
    try:
        bid_i = int(bid)
    except ValueError:
        warn(ERR_BAD_BATCH_ID); return
    confirm = questionary.confirm(f"Delete import {bid_i} + all its rows?").ask()
    if not confirm: return
    print_request("DELETE", f"{EP_IMPORTS}/{bid_i}", None)
    resp = request("DELETE", f"{EP_IMPORTS}/{bid_i}")
    print_response(resp)
    if resp.status_code == 200:
        d = resp.json()
        success(f"Deleted batch {d['id']} ({d['file_type']}) + {d['deleted_rows']} rows")


ENDPOINTS: list[tuple[str, Callable[[], None]]] = [
    ("GET /achats (page 1, 20 rows)",                  _list_achats_all),
    ("GET /achats?batch_id=N  (filter to a batch)",    _list_achats_by_batch),
    ("GET /achats?date_from=&date_to=",                _list_achats_by_date),
    ("GET /achats?search=...",                         _list_achats_search),
    ("GET /ventes (page 1, 20 rows)",                  _list_ventes_all),
    ("GET /ventes?batch_id=N  (filter to a batch)",    _list_ventes_by_batch),
    ("GET /ventes?search=...",                         _list_ventes_search),
    ("GET /data/imports  (full history)",              _list_imports),
    ("DELETE /data/imports/{id}  (cascade-delete)",    _delete_import),
]


def run() -> None:
    while True:
        choices = [questionary.Choice(label, value=fn) for label, fn in ENDPOINTS]
        choices.append(questionary.Choice("← Back", value=BACK))
        pick = questionary.select("Transactions · pick an endpoint", choices=choices).ask()
        if pick is None or pick == BACK:
            return
        pick()