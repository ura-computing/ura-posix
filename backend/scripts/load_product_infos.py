"""Load the scraped product photos + descriptions into `product_infos` (« Produits »).

Runs at every start (entrypoint.sh, `make migrate`): replaces every row in one transaction,
so the table always equals the file. Takes < 1 s.

File: `backend/data/product_infos.json` (env PRODUCT_INFOS_FILE = another one, e.g. the E2E
fixture). Same shape as the scraper's export, other keys ignored:

    {"products": [{"pid": 177883, "barcode1": "3282770388916", "barcode2": null, "name": "…",
                   "brand": "A-Derma", "category": "Soins visage", "images": ["https://…"],
                   "description": "…", "details": [{"label": "Gamme", "value": "…"}], "source_url": "…"}]}

A PID or a barcode belongs to ONE row: products with a PID first, then the one with the
most photos (two shop pages can carry the same barcode). A product left with no PID and
no barcode can't match anything: skipped.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # backend/ → `import app…`

from sqlalchemy import delete, insert, text

from app.core.database import SessionLocal
from app.core.models import ProductInfo

DEFAULT_FILE = Path(__file__).resolve().parent.parent / "data" / "product_infos.json"


def _text(value: object) -> str | None:
    s = str(value).strip() if value is not None else ""
    return s or None


def to_rows(products: list[dict]) -> list[dict]:
    """File products → `product_infos` rows, in priority order (= id order)."""
    ordered = sorted(
        enumerate(products),
        key=lambda ip: (ip[1].get("pid") is None, -len(ip[1].get("images") or []), ip[0]),
    )
    seen_pids: set[str] = set()
    seen_codes: set[str] = set()
    rows: list[dict] = []
    for _, p in ordered:
        pid = _text(p.get("pid"))
        if pid in seen_pids:
            pid = None
        codes = [c if c not in seen_codes else None for c in (_text(p.get("barcode1")), _text(p.get("barcode2")))]
        if not pid and not any(codes):
            continue
        seen_pids.update([pid] if pid else [])
        seen_codes.update(c for c in codes if c)
        rows.append(
            {
                "pid": pid,
                "barcode1": codes[0],
                "barcode2": codes[1],
                "name": _text(p.get("name")) or "",
                "brand": _text(p.get("brand")),
                "category": _text(p.get("category")),
                # Only web addresses: the page puts them in <img src>.
                "images": [
                    u for u in p.get("images") or [] if isinstance(u, str) and u.startswith(("https://", "http://"))
                ],
                "description": _text(p.get("description")),
                "details": [
                    {"label": _text(d.get("label")), "value": _text(d.get("value"))}
                    for d in p.get("details") or []
                    if isinstance(d, dict) and _text(d.get("label")) and _text(d.get("value"))
                ],
                "source_url": _text(p.get("source_url")),
            }
        )
    return rows


def main() -> None:
    path = Path(os.environ.get("PRODUCT_INFOS_FILE") or DEFAULT_FILE)
    rows = to_rows(json.loads(path.read_text(encoding="utf-8"))["products"])
    db = SessionLocal()
    try:
        # Two containers starting together: one load at a time (else both insert → duplicate PID).
        db.execute(text("SELECT pg_advisory_xact_lock(hashtext('product_infos'))"))
        db.execute(delete(ProductInfo))
        if rows:
            db.execute(insert(ProductInfo), rows)
        db.commit()
    finally:
        db.close()
    print(f"▸ product_infos: {len(rows)} produits ({path.name})")


if __name__ == "__main__":
    main()
