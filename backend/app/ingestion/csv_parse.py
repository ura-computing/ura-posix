"""CSV ingestion helpers for /v1/uploads/*.

Ported from apcm-pharma's `utils/strings.py` + `routers/uploads.py` shared
helpers. Everything Sobrus-specific lives here so each upload endpoint stays
small and obvious.

Key invariants preserved from apcm-pharma:
- Mojibake fix (Sobrus exports occasionally double-encode UTF-8 via macroman).
- Medicament upsert ladder: PID → accent-stripped product-name match. Never
  overwrites an existing category (admins curate those).
- CSV delimiter is `;` (Sobrus default).
"""

from __future__ import annotations

import csv
import io
import re
import unicodedata
from collections.abc import Iterable
from datetime import date, datetime
from functools import lru_cache
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.errors import ErrorCode, error_body
from app.core.models import Medicament


# ─── String helpers ───────────────────────────────────────────────────────────


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


_PCT_RE = re.compile(r"\s*\(\d+\.?\d*%\)")


def strip_percentage(s: str | None) -> str:
    """Drop '(20%)' or '(7.5%)' suffixes from a category name so lookups normalize."""
    if not s:
        return ""
    return _PCT_RE.sub("", s).strip()


@lru_cache(maxsize=4096)  # pure; called once per exported row (45k), few distinct categories
def suffix_key(category: str | None) -> str:
    """Category-suffix match key, ignoring accents, case, extra spaces and the
    « (x%) » part: « Médicament (33.930%) » and « medicament » → "medicament"."""
    return " ".join(strip_accents(strip_percentage(category)).lower().split())


# ─── Product-type classifier ──────────────────────────────────────────────────
# Single Python-side source of truth for Pharmacie/Parapharmacie classification
# at WRITE time (catalog import only). Same keyword set as query_parts.pharma_expr()
# uses in its SQL fallback. Catalogue is the source of truth — see F19 plan.

_PHARMA_KEYWORDS = (
    "edicament",
    "édicament",
    "oméopath",
    "omeopath",
    "iététique",
    "ietetique",
)


def classify_product_type(category: str | None) -> str:
    """Auto-classify a Medicament as 'pharmacie' or 'parapharmacie' from its
    category string. Called by the catalog CSV import handler only — achat/vente
    imports do NOT classify (catalogue is the source of truth).

    Categories without any pharma keyword default to 'parapharmacie' (matches
    the SQL `else_=False` branch in pharma_expr()). Empty/None category also
    defaults to parapharmacie — admin can override later via the catalog UI."""
    if not category:
        return "parapharmacie"
    cat = category.lower()
    return "pharmacie" if any(kw in cat for kw in _PHARMA_KEYWORDS) else "parapharmacie"


_MOJIBAKE_FIXES = {
    "√©": "é",
    "√®": "è",
    "√à": "è",
    "√™": "ê",
    "√Æ": "î",
    "√è": "ï",
    "√Ø": "ï",
    "√†": "à",
    "√§": "ä",
    "√≥": "ó",
    "√µ": "õ",
    "√º": "ü",
    "√â": "É",
    "√ä": "Ë",
    "√Ä": "À",
    "√î": "Ô",
    "√ô": "Ù",
    "√ª": "û",
    "√Ç": "Â",
    "¬∞": "º",
    "¬µ": "µ",
    "¬¥": "´",
    "¬Æ": "®",
    "¬©": "©",
    "¬†": " ",
}


def fix_mojibake(s: str | None) -> str | None:
    """Reverse double-encoded mojibake (UTF-8 → macroman/cp1252 → UTF-8 again)."""
    if not s or ("√" not in s and "¬" not in s):
        return s
    for enc in ("cp1252", "macroman"):
        try:
            fixed = s.encode(enc).decode("utf-8")
            if "√" not in fixed and "¬" not in fixed:
                return fixed
        except (UnicodeEncodeError, UnicodeDecodeError):
            continue
    for bad, good in _MOJIBAKE_FIXES.items():
        s = s.replace(bad, good)
    return s


# ─── Scalar parsers (tolerant of Sobrus formatting quirks) ───────────────────


def _decode(content: bytes) -> str:
    """Try BOM-aware UTF-8, then plain UTF-8, then Latin-1 fallback."""
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return content.decode(enc)
        except UnicodeDecodeError:
            continue
    raise ValueError("Impossible de décoder le fichier — encodage inconnu")


def parse_float(val: str | None) -> float | None:
    if not val:
        return None
    s = "".join(str(val).split()).replace(",", ".")  # every space, also the no-break one: « 1 234,50 »
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def parse_int(val: str | None) -> int | None:
    f = parse_float(val)
    return int(f) if f is not None else None


# Sobrus writes ISO (2026-01-23, 2026-01-23 14:19:05). A file opened and saved again
# by hand (Excel, Numbers) comes back day first: 23/1/26, 23/01/2026 14:19.
_DATE_RE = re.compile(
    r"(?:(?P<y>\d{4}) ?[-/.] ?(?P<m>\d{1,2}) ?[-/.] ?(?P<d>\d{1,2})"
    r"|(?P<dd>\d{1,2}) ?[-/.] ?(?P<mm>\d{1,2}) ?[-/.] ?(?P<yy>\d{4}|\d{2}))"
    r"(?:[T ](?P<H>\d{1,2}):(?P<M>\d{2})(?::(?P<S>\d{2})(?:[.,]\d+)?)?)?"
)


@lru_cache(maxsize=8192)  # pure; the same few hundred dates repeat on every line
def _parse_datetime(val: str) -> datetime | None:
    s = " ".join(val.split()).strip("\"' ")  # spaces anywhere, also the no-break one
    m = _DATE_RE.fullmatch(s)
    if not m:
        return None
    if m["y"]:
        y, mo, d = int(m["y"]), int(m["m"]), int(m["d"])
    else:
        y, mo, d = int(m["yy"]), int(m["mm"]), int(m["dd"])
        if y < 100:
            y += 2000
    try:
        return datetime(y, mo, d, int(m["H"] or 0), int(m["M"] or 0), int(m["S"] or 0))
    except ValueError:  # 31/02/2026, 25:00
        return None


def parse_date(val: str | None) -> date | None:
    """« 2026-01-23 », « 23/1/26 », « 23/01/2026 » → date(2026, 1, 23). Unreadable (« 31/02/2026 », « hier ») → None."""
    dt = _parse_datetime(val) if val else None
    return dt.date() if dt else None


def normalize_date(val: str | None) -> str | None:
    """Dates stored as text (ventes.date, achats.delivery_date …): « 23/1/26 » → "2026-01-23"."""
    d = parse_date(val)
    return d.isoformat() if d else None


def normalize_datetime(val: str | None) -> str | None:
    """achats.created_at_source: « 23/1/26 14:19 » → "2026-01-23 14:19:00"."""
    dt = _parse_datetime(val) if val else None
    return dt.isoformat(sep=" ") if dt else None


# ─── CSV parsing ──────────────────────────────────────────────────────────────


def clean_header(h: str) -> str:
    return fix_mojibake(h.strip().strip('"').strip("'")) or ""


def clean_value(v: str) -> str:
    return fix_mojibake(v.strip().strip('"').strip("'")) or ""


def _detect_delimiter(first_line: str) -> str:
    """Pick `;` or `,` based on the header line. Counts separators outside
    quoted regions (RFC 4180 double quotes). Tie or both-zero → fall back to
    `;` since Sobrus exports use it; hand-crafted test files that use `,`
    will out-count `;` and switch automatically."""
    in_q = False
    sc = cc = 0
    for ch in first_line:
        if ch == '"':
            in_q = not in_q
        elif not in_q:
            if ch == ";":
                sc += 1
            elif ch == ",":
                cc += 1
    return "," if cc > sc else ";"


def parse_csv(content: bytes, delimiter: str | None = None) -> list[dict[str, str]]:
    """Single fan-in for ALL CSV reads. Handles encoding detection, mojibake fix,
    and dict-shaped output keyed by cleaned headers.

    Sobrus achat/vente/stock CSVs use `;`; the catalog CSV uses `,`. Pass
    `delimiter=` to lock the choice; otherwise the header line is sniffed
    via `_detect_delimiter`. Mojibake fix is applied to every header AND
    every cell value (via `clean_header` / `clean_value`)."""
    text = _decode(content)
    if delimiter is None:
        delimiter = _detect_delimiter(text.split("\n", 1)[0])
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    rows = list(reader)
    if not rows:
        return []
    headers = [clean_header(h) for h in rows[0]]
    out: list[dict[str, str]] = []
    for row in rows[1:]:
        out.append({headers[i]: clean_value(row[i]) for i in range(min(len(headers), len(row)))})
    return out


def parse_catalog_csv(content: bytes) -> tuple[list[dict], list[dict]]:
    """Parse a Sobrus catalog CSV (`Nom,Categorie,TVA,PPV,PPH,Code barre 1,
    Code barre 2,Laboratoire`). Returns (rows, errors).

    Goes through `parse_csv()` so mojibake fix + encoding detection are
    handled identically to achat/vente/stock imports. Each output row is a
    dict matching MedicamentCreate fields with a derived synthetic `pid`."""
    rows = parse_csv(content, delimiter=",")
    seen_pids: set[str] = set()
    errors: list[dict] = []
    out: list[dict] = []
    for i, raw in enumerate(rows, start=2):  # row 1 = header
        name = (raw.get("Nom") or "").strip()
        if not name:
            errors.append(error_body(ErrorCode.ROW_MISSING_NAME, f"Ligne {i}: nom manquant", line=i))
            continue
        bc1 = (raw.get("Code barre 1") or "").strip() or None
        bc2 = (raw.get("Code barre 2") or "").strip() or None
        pid = _derive_pid(bc1, name, seen_pids)
        seen_pids.add(pid)
        out.append(
            {
                "pid": pid,
                "product": name,
                "category": (raw.get("Categorie") or "").strip() or None,
                "tva": (raw.get("TVA") or "").strip() or None,
                "ppv": parse_float(raw.get("PPV")),
                "pph": parse_float(raw.get("PPH")),
                "barcode1": bc1,
                "barcode2": bc2,
                "laboratoire": (raw.get("Laboratoire") or "").strip() or None,
            }
        )
    return out, errors


def _derive_pid(barcode1: str | None, product: str, seen_pids: set[str]) -> str:
    """Synthetic PID for the catalog import. Match ladder:
    1. barcode1 if non-empty, ≥8 chars, AND not already seen this batch
    2. normalized product name (accent-stripped + lowercased + single-spaced)"""
    bc = (barcode1 or "").strip()
    if bc and len(bc) >= 8 and bc not in seen_pids:
        return bc
    return normalized_name(product)


# ─── Normalized-name dedup (shared by the achat/vente + catalog imports) ───────


def normalized_name(product: str | None) -> str:
    """Accent-stripped, lowercased, single-spaced product name — THE dedup key
    that keeps the same product from forking into two Medicament rows with
    different PIDs (the achat/vente import uses a Sobrus numeric PID; the catalog
    import derives its PID from the barcode or this very name)."""
    return re.sub(r"\s+", " ", strip_accents(product or "").lower().strip())


# SQL expression producing the same key as normalized_name() for a column, so an
# in-memory set of keys can be matched in ONE query (no per-row N+1).
#
# Uses immutable_unaccent() (migration 0019), not the built-in unaccent() —
# Postgres's own unaccent is STABLE, not IMMUTABLE, so it can't be indexed.
# This must keep matching the expression indexed by
# ix_medicaments_normalized_name exactly, or Postgres silently falls back to
# a full table scan on medicaments (a single catalog shared by every
# pharmacy) on every import chunk platform-wide.
def _normalized_name_expr(column):
    return func.lower(func.regexp_replace(func.trim(func.immutable_unaccent(column)), r"\s+", " ", "g"))


def _prefer_lab_row(candidate: Medicament, current: Medicament) -> bool:
    """Collision tie-break: prefer the row that already carries a laboratoire (the
    catalogue copy we want to merge onto), else the lowest id — deterministic."""
    cand_lab, cur_lab = bool(candidate.laboratoire), bool(current.laboratoire)
    if cand_lab != cur_lab:
        return cand_lab
    return (candidate.id or 0) < (current.id or 0)


def existing_by_name(db: Session, products: Iterable[str | None]) -> dict[str, Medicament]:
    """One-query map {normalized_name → Medicament} for the given product names.
    Used by both import paths to merge onto an existing row instead of creating a
    duplicate when a same-named product already exists under a different PID."""
    keys = {normalized_name(p) for p in products if p}
    keys.discard("")
    if not keys:
        return {}
    out: dict[str, Medicament] = {}
    for m in db.query(Medicament).filter(_normalized_name_expr(Medicament.product).in_(list(keys))).all():
        k = normalized_name(m.product)
        cur = out.get(k)
        if cur is None or _prefer_lab_row(m, cur):
            out[k] = m
    return out


# ─── Sobrus column lookup (tolerant of column reordering) ─────────────────────


def col(row: dict[str, Any], *names: str) -> str | None:
    """Look up a value by trying multiple column-name variants. Returns the first
    truthy match or None. Used so the parsers tolerate small Sobrus header drift."""
    for n in names:
        v = row.get(n)
        if v:
            return v
    return None


# Regex helpers (filename validation — same patterns as the frontend wizard).
ACHAT_FILENAME_RE = re.compile(r"^Sobrus - Achats \d{4}-\d{2}-\d{2} - \d{4}-\d{2}-\d{2}( \(\d+\))?\.csv$", re.I)
VENTE_FILENAME_RE = re.compile(r"^Sobrus - Ventes \d{4}-\d{2}-\d{2} - \d{4}-\d{2}-\d{2}( \(\d+\))?\.csv$", re.I)
STOCK_FILENAME_RE = re.compile(r"^Sobrus - Stock \d{8}( \(\d+\))?\.csv$", re.I)
