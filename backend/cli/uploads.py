"""Uploads category. End-to-end CSV ingestion via /v1/uploads/*.

Sample fixtures live in ./_fixtures/ — small 3-row CSVs that look like real
Sobrus exports. Re-running an endpoint with the same fixture is the easiest way
to confirm dedup works (second run returns inserted=0, skipped=N).
"""
from __future__ import annotations

from pathlib import Path
from typing import Callable

import questionary

from ._client import request
from ._output import print_request, print_response, success, warn


BACK = "__BACK__"

FIXTURES = Path(__file__).parent / "_fixtures"
ACHAT_CSV  = FIXTURES / "Sobrus - Achats 2026-06-01 - 2026-06-22.csv"
VENTE_CSV  = FIXTURES / "Sobrus - Ventes 2026-06-01 - 2026-06-22.csv"
STOCK_CSV  = FIXTURES / "Sobrus - Stock 20260622.csv"


def _upload_file(endpoint: str, path: Path, batch_id: int | None = None) -> None:
    if not path.exists():
        warn(f"Fixture missing: {path}")
        return
    files = {"file": (path.name, path.read_bytes(), "text/csv")}
    data  = {"batch_id": str(batch_id)} if batch_id else None
    label = f"POST {endpoint}  (file={path.name}{', batch_id=' + str(batch_id) if batch_id else ''})"
    print_request("POST", endpoint, {"file": path.name, "batch_id": batch_id})
    resp = request("POST", endpoint, files=files, data=data)
    print_response(resp)
    if resp.status_code == 200:
        d = resp.json()
        if "inserted" in d:
            success(f"{label} → inserted={d.get('inserted')}, skipped={d.get('skipped')}, batch_id={d.get('batch_id')}")
        elif "skipped_unknown" in d:
            success(
                f"{label} → inserted={d.get('inserted')}, unknown PIDs={len(d.get('skipped_unknown', []))}, "
                f"batch_id={d.get('batch_id')}"
            )


def _upload_achat()      -> None: _upload_file("/uploads/achat", ACHAT_CSV)
def _upload_vente()      -> None: _upload_file("/uploads/vente", VENTE_CSV)
def _upload_stock()      -> None: _upload_file("/uploads/stock", STOCK_CSV)


def _upload_achat_again() -> None:
    """Run the SAME achat file twice and confirm dedup: second run inserts 0."""
    warn("Tip: run 'POST /uploads/achat' first to seed. This call should report inserted=0.")
    _upload_file("/uploads/achat", ACHAT_CSV)


def _upload_with_batch_id() -> None:
    """Simulate the chunked-upload pattern: upload twice with the same batch_id.
    Confirms only ONE ImportBatch row is created across the 2 calls."""
    bid = questionary.text("batch_id to thread (leave blank to skip)").ask()
    if not bid:
        return
    try:
        n = int(bid)
    except ValueError:
        warn("batch_id must be an integer.")
        return
    _upload_file("/uploads/achat", ACHAT_CSV, batch_id=n)


def _upload_achat_json() -> None:
    """Simulate the Chrome extension's JSON ingest (rows array, no multipart)."""
    if not ACHAT_CSV.exists():
        warn(f"Fixture missing: {ACHAT_CSV}")
        return
    import csv
    with ACHAT_CSV.open() as f:
        rows = list(csv.DictReader(f, delimiter=";"))
    body = {"rows": rows, "filename": ACHAT_CSV.name}
    print_request("POST", "/uploads/achat-json", {"rows": f"<{len(rows)} rows>", "filename": ACHAT_CSV.name})
    resp = request("POST", "/uploads/achat-json", json=body)
    print_response(resp)
    if resp.status_code == 200:
        d = resp.json()
        success(f"inserted={d.get('inserted')}, skipped={d.get('skipped')}, batch_id={d.get('batch_id')}")


def _patch_batch_cancel() -> None:
    """Mark a batch as cancelled. Use a batch_id you got from a previous upload call."""
    bid = questionary.text("Batch id to cancel").ask()
    if not bid: return
    try:
        n = int(bid)
    except ValueError:
        warn("Must be an integer.")
        return
    body = {"status": "cancelled"}
    print_request("PATCH", f"/uploads/batches/{n}", body)
    resp = request("PATCH", f"/uploads/batches/{n}", json=body)
    print_response(resp)
    if resp.status_code == 200:
        d = resp.json()
        success(f"batch {d['id']} → status='{d['status']}'")


def _unauthorized_when_no_import_perm() -> None:
    """Reminder: owner without `import` permission gets 403. Admin always passes."""
    warn("Log in as admin@gmail.com for these tests — owner without 'import' permission gets 403.")
    warn("If you see 403, your user's effective permissions don't include 'import'.")


ENDPOINTS: list[tuple[str, Callable[[], None]]] = [
    ("POST /uploads/achat (multipart, fixture CSV)",         _upload_achat),
    ("POST /uploads/achat (run again — expect 0 inserted, 3 skipped)", _upload_achat_again),
    ("POST /uploads/achat (with batch_id — chunked simulation)",       _upload_with_batch_id),
    ("POST /uploads/vente (multipart, fixture CSV)",         _upload_vente),
    ("POST /uploads/stock (multipart, fixture CSV)",         _upload_stock),
    ("POST /uploads/achat-json (Chrome extension shape)",    _upload_achat_json),
    ("PATCH /uploads/batches/{id} (cancel a batch)",         _patch_batch_cancel),
    ("?  Permission gate (read this if you see 403)",        _unauthorized_when_no_import_perm),
]


def run() -> None:
    while True:
        choices = [questionary.Choice(label, value=fn) for label, fn in ENDPOINTS]
        choices.append(questionary.Choice("← Back", value=BACK))
        pick = questionary.select("Uploads · pick an endpoint", choices=choices).ask()
        if pick is None or pick == BACK:
            return
        pick()