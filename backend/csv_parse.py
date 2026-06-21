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
from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from models import Medicament


# ─── String helpers ───────────────────────────────────────────────────────────

def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


_PCT_RE = re.compile(r"\s*\(\d+\.?\d*%\)")


def strip_percentage(s: str | None) -> str:
    """Drop '(20%)' or '(7.5%)' suffixes from a category name so lookups normalize."""
    if not s:
        return ""
    return _PCT_RE.sub("", s).strip()


_MOJIBAKE_FIXES = {
    "√©": "é", "√®": "è", "√à": "è", "√™": "ê", "√Æ": "î", "√è": "ï",
    "√Ø": "ï", "√†": "à", "√§": "ä", "√≥": "ó", "√µ": "õ", "√º": "ü",
    "√â": "É", "√ä": "Ë", "√Ä": "À", "√î": "Ô", "√ô": "Ù", "√ª": "û",
    "√Ç": "Â", "¬∞": "º", "¬µ": "µ", "¬¥": "´", "¬Æ": "®", "¬©": "©",
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
    s = str(val).strip().replace(" ", "").replace(",", ".")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def parse_int(val: str | None) -> int | None:
    f = parse_float(val)
    return int(f) if f is not None else None


def parse_iso_date(val: str | None) -> date | None:
    """Sobrus stock CSVs use ISO YYYY-MM-DD; achat/vente use VARCHAR strings stored as-is."""
    if not val:
        return None
    s = str(val).strip()
    if not s:
        return None
    try:
        return date.fromisoformat(s[:10])
    except ValueError:
        return None


# ─── CSV parsing ──────────────────────────────────────────────────────────────

def clean_header(h: str) -> str:
    return fix_mojibake(h.strip().strip('"').strip("'")) or ""


def clean_value(v: str) -> str:
    return (fix_mojibake(v.strip().strip('"').strip("'")) or "")


def parse_csv(content: bytes) -> list[dict[str, str]]:
    """Sobrus CSVs use `;` as delimiter. Returns list of dicts keyed by cleaned header."""
    text = _decode(content)
    reader = csv.reader(io.StringIO(text), delimiter=";")
    rows = list(reader)
    if not rows:
        return []
    headers = [clean_header(h) for h in rows[0]]
    out: list[dict[str, str]] = []
    for row in rows[1:]:
        out.append({headers[i]: clean_value(row[i]) for i in range(min(len(headers), len(row)))})
    return out


# ─── Medicament upsert ────────────────────────────────────────────────────────

def upsert_medicament(
    db: Session,
    pid: str,
    product: str,
    tva: str | None = None,
    pph: float | None = None,
    ppv: float | None = None,
    category: str | None = None,
    zone: str | None = None,
) -> Medicament | None:
    """Find or create a Medicament. Match ladder:
       1. exact PID (the Sobrus product id)
       2. accent-stripped + case-insensitive product name

    On match: update tva/pph/ppv/zone if provided. NEVER overwrites an existing
    category — admins curate those.
    On miss: insert new row with all supplied fields.
    Returns the Medicament, or None if neither pid nor product was provided.
    """
    if not pid:
        return None

    med = db.query(Medicament).filter(Medicament.pid == pid).first()
    if med is None and product:
        norm = strip_accents(product).lower().strip()
        for cand in db.query(Medicament).filter(Medicament.product.ilike(f"%{product[:30]}%")).all():
            if strip_accents(cand.product or "").lower().strip() == norm:
                med = cand
                break

    if med:
        if tva      and not med.tva:      med.tva      = tva
        if pph is not None:               med.pph      = pph
        if ppv is not None:               med.ppv      = ppv
        if zone     and not med.zone:     med.zone     = zone
        # Category intentionally NOT overwritten — admin-curated.
        return med

    med = Medicament(
        pid=pid, product=product or pid,
        tva=tva, pph=pph, ppv=ppv,
        category=category, zone=zone,
    )
    db.add(med)
    db.flush()      # populates med.id without committing the parent transaction
    return med


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