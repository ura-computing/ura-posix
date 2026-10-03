"""Search (PG-006): one grammar, in SQL. Frontend copy for in-memory lists: `utils/text.ts`.

The query is split on spaces; EVERY token must match (AND). Case-insensitive;
accent-insensitive on text (name, supplier, client, reference: "societe" finds
"Société"); pid / barcodes are compared as typed. Strict — no fuzzy matching;
`%` and `_` are literal.

  doli    → contains "doli"                    "Doliprane 1000" ✓
  *doli   → contains "doli" (same)
  doli*   → the text starts with "doli"         "Doliprane" ✓   "Le Doliprane" ✗
  ra*ol   → one word starting "ra", ending "ol"  "Rabeprazol 20" ✓  "Rabeprazole" ✗
  *       → everything

Use `product_search_clauses` / `supplier_search_clauses` (Postgres unaccent).
"""

from __future__ import annotations

import re
from typing import Iterable

from sqlalchemy import func, or_, true
from sqlalchemy.sql.elements import ColumnElement

from csv_parse import strip_accents
from models import Medicament


_TOKEN_SPLIT = re.compile(r"\s+")  # split on whitespace only — `*` is grammar, not a separator here
_LIKE_ESCAPE = "\\"  # ILIKE escape char for literal % and _


def tokenize_search(query: str | None) -> list[str]:
    """Split on whitespace. Lowercase. Dedupe (order preserved).
    `*` is preserved inside tokens (it drives the grammar, handled downstream)."""
    if not query:
        return []
    seen: set[str] = set()
    out: list[str] = []
    for raw in _TOKEN_SPLIT.split(query.strip()):
        tok = raw.strip().lower()
        if tok and tok not in seen:
            seen.add(tok)
            out.append(tok)
    return out


def _parts(token: str) -> list[str]:
    return [p for p in token.split("*") if p]


def _starts_with(token: str) -> bool:
    """`doli*` (one part, trailing `*` only) → starts-with; otherwise contains."""
    return len(_parts(token)) == 1 and token.endswith("*") and not token.startswith("*")


def _like_escape(literal: str) -> str:
    """Escape ILIKE metacharacters (`%`, `_`, and the escape char itself) so user
    input can't act as a wildcard by accident."""
    return (
        literal.replace(_LIKE_ESCAPE, _LIKE_ESCAPE * 2)
        .replace("%", _LIKE_ESCAPE + "%")
        .replace("_", _LIKE_ESCAPE + "_")
    )


def _pattern_ilike(column, token: str, *, unaccent: bool) -> ColumnElement[bool]:
    """One column, one token (grammar: module docstring)."""
    tok = strip_accents(token).lower() if unaccent else token
    col = func.unaccent(column) if unaccent else column
    parts = _parts(tok)
    if not parts:
        return true()  # lone "*" → no constraint
    if len(parts) > 1:  # ra*ol → inside ONE word (\m … \M)
        return col.op("~*")(r"\m" + r"[^[:space:]]*".join(re.escape(p) for p in parts) + r"\M")
    seg = _like_escape(parts[0])
    return col.ilike(f"{seg}%" if _starts_with(tok) else f"%{seg}%", escape=_LIKE_ESCAPE)


def supplier_search_clauses(
    tokens: Iterable[str],
    columns: Iterable,
) -> list[ColumnElement[bool]]:
    """For each token: OR(unaccent_ilike(col, tok) for col in columns).
    Caller ANDs the clauses (every token must match somewhere).

    Designed for supplier / delivery-ref / generic-text search where the
    columns don't include pid/barcodes."""
    cols = list(columns)
    return [or_(*(_pattern_ilike(col, tok, unaccent=True) for col in cols)) for tok in tokens]


def product_search_clauses(
    tokens: Iterable[str],
    extra_columns: Iterable = (),
) -> list[ColumnElement[bool]]:
    """Product search across name + pid + barcodes + any extra columns
    (typically Achat.supplier + Achat.delivery_ref)."""
    clauses: list[ColumnElement[bool]] = []
    extra = list(extra_columns)
    for tok in tokens:
        ors: list[ColumnElement[bool]] = [
            _pattern_ilike(Medicament.product, tok, unaccent=True),
            _pattern_ilike(Medicament.pid, tok, unaccent=False),
            _pattern_ilike(Medicament.barcode1, tok, unaccent=False),
            _pattern_ilike(Medicament.barcode2, tok, unaccent=False),
        ]
        ors.extend(_pattern_ilike(col, tok, unaccent=True) for col in extra)
        clauses.append(or_(*ors))
    return clauses
