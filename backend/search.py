"""Tokenized search helpers (PG-006).

Pharmacists type search queries like:
  "doliprane 1000"     → two tokens, both must match somewhere (AND)
  "societe para"       → matches "Société PARA LA CDP" (accent-insensitive)

Search is **strict substring** — accent- and case-insensitive — with an
explicit `*` wildcard for anchoring:

  "cin"    → contains "cin"            (ILIKE %cin%)
  "cin*"   → starts with "cin"         (ILIKE cin%)
  "*cin"   → ends with "cin"           (ILIKE %cin)
  "c*a"    → starts with "c", ends "a" (ILIKE c%a)

Multiple whitespace-separated tokens are ANDed (every token must match
somewhere). `*` is a wildcard *inside* a token, not a separator.

Builds on the Postgres `unaccent` extension (enabled in the db).
Used by /achats and /ventes search + suggestions endpoints.
"""
from __future__ import annotations

import re
from typing import Iterable

from sqlalchemy import func, or_
from sqlalchemy.sql.elements import ColumnElement

from csv_parse import strip_accents
from models import Medicament


_TOKEN_SPLIT = re.compile(r"\s+")   # split on whitespace only — `*` is a wildcard
_LIKE_ESCAPE = "\\"                  # ILIKE escape char for literal % and _


def tokenize_search(query: str | None) -> list[str]:
    """Split on whitespace. Lowercase. Dedupe (order preserved).
    `*` is preserved inside tokens (it is a wildcard, handled downstream)."""
    if not query:
        return []
    seen: set[str] = set()
    out:  list[str] = []
    for raw in _TOKEN_SPLIT.split(query.strip()):
        tok = raw.strip().lower()
        if tok and tok not in seen:
            seen.add(tok)
            out.append(tok)
    return out


def _like_escape(literal: str) -> str:
    """Escape ILIKE metacharacters (`%`, `_`, and the escape char itself) in a
    literal text chunk so user input can't act as a wildcard by accident."""
    return (
        literal.replace(_LIKE_ESCAPE, _LIKE_ESCAPE * 2)
        .replace("%", _LIKE_ESCAPE + "%")
        .replace("_", _LIKE_ESCAPE + "_")
    )


def _token_to_pattern(token: str) -> str:
    """Convert a search token into an ILIKE pattern.

    A `*` in the token becomes a SQL `%` wildcard; the literal chunks around it
    are escaped. A token with NO `*` matches as a substring (`%token%`)."""
    if "*" in token:
        return "%".join(_like_escape(part) for part in token.split("*"))
    return f"%{_like_escape(token)}%"


def _pattern_ilike(column, token: str, *, unaccent: bool) -> ColumnElement[bool]:
    """Accent-optional, case-insensitive ILIKE against `column` for one token."""
    if unaccent:
        col = func.unaccent(column)
        pat = _token_to_pattern(strip_accents(token).lower())
    else:
        col = column
        pat = _token_to_pattern(token)
    return col.ilike(pat, escape=_LIKE_ESCAPE)


def supplier_search_clauses(
    tokens: Iterable[str],
    columns: Iterable,
) -> list[ColumnElement[bool]]:
    """For each token: OR(unaccent_ilike(col, tok) for col in columns).
    Caller ANDs the clauses (Google-style — every token must match somewhere).

    Designed for supplier / delivery-ref / generic-text search where the
    columns don't include pid/barcodes."""
    cols = list(columns)
    return [or_(*(_pattern_ilike(col, tok, unaccent=True) for col in cols)) for tok in tokens]


def product_search_clauses(
    tokens: Iterable[str],
    extra_columns: Iterable = (),
) -> list[ColumnElement[bool]]:
    """Product search across name + pid + barcodes + any extra columns
    (typically Achat.supplier + Achat.delivery_ref). Strict substring with
    `*` wildcard support — no fuzzy matching."""
    clauses: list[ColumnElement[bool]] = []
    extra = list(extra_columns)
    for tok in tokens:
        ors: list[ColumnElement[bool]] = [
            _pattern_ilike(Medicament.product,  tok, unaccent=True),
            _pattern_ilike(Medicament.pid,      tok, unaccent=False),
            _pattern_ilike(Medicament.barcode1, tok, unaccent=False),
            _pattern_ilike(Medicament.barcode2, tok, unaccent=False),
        ]
        ors.extend(_pattern_ilike(col, tok, unaccent=True) for col in extra)
        clauses.append(or_(*ors))
    return clauses
