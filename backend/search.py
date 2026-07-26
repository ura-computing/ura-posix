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
    """Substring ILIKE pattern for a NO-wildcard token (`%token%`). Used for the
    plain 'contains' case; wildcard tokens go through `_token_to_regex_sql`."""
    return f"%{_like_escape(token)}%"


# POSIX-ERE metacharacters to backslash-escape for Postgres `~*` regex.
_PG_RE_META = re.compile(r"([.\\+?()\[\]{}^$|*])")


def _pg_re_escape(literal: str) -> str:
    return _PG_RE_META.sub(r"\\\1", literal)


def _token_to_regex_sql(token: str) -> str:
    r"""Postgres regex (for `~*`) matching a token WITHIN A SINGLE WORD. `*` is a
    within-word wildcard (`[^[:space:]]*`); the token anchors to the word start
    (`\m`) / end (`\M`) unless it opens / closes with `*`. Anchoring per word (not
    per whole column) is what lets `rinom*ne` match the word "RINOMICINE" inside
    "RINOMICINE ST B10 SACHETS".
      "rinom*"  → \mrinom              (word starts with rinom)
      "*ne"     → ne\M                 (word ends with ne)
      "ri*il"   → \mri[^space]*il\M    (word starts ri, ends il)
    """
    parts = [p for p in token.split("*") if p]
    body = "[^[:space:]]*".join(_pg_re_escape(part) for part in parts)
    start = "" if token.startswith("*") else r"\m"
    end = "" if token.endswith("*") else r"\M"
    return f"{start}{body}{end}"


def _token_to_regex(token: str) -> re.Pattern[str]:
    """Python-side twin of `_token_to_regex_sql` for in-memory matching, tested
    against ONE word at a time (so `^`/`$` anchor the word, matching the SQL
    `\\m`/`\\M` per-word behavior):
      "cin"  → substring within a word   re.escape("cin")
      "cin*" → word starts with          "^cin"
      "*cin" → word ends with            "cin$"
      "c*a"  → word starts "c" ends "a"  "^c.*a$"
    """
    if "*" not in token:
        return re.compile(re.escape(token))
    body = ".*".join(re.escape(part) for part in token.split("*"))
    start = "" if token.startswith("*") else "^"
    end = "" if token.endswith("*") else "$"
    return re.compile(f"{start}{body}{end}")


def matches_all_tokens(text: str | None, tokens: Iterable[str]) -> bool:
    """True when every token matches `text` (accent/case-insensitive, `*`-aware).
    A `*`-anchored token matches PER WORD; a plain token is a substring anywhere.
    Mirrors the SQL search for the endpoints that filter materialized Python lists."""
    norm = strip_accents(text or "").lower()
    words = norm.split()

    def _tok_ok(raw: str) -> bool:
        tok = strip_accents(raw).lower()
        if "*" not in tok:
            return tok in norm                        # substring anywhere
        rx = _token_to_regex(tok)
        return any(rx.search(w) for w in words)        # anchored per word

    return all(_tok_ok(t) for t in tokens)


def _pattern_ilike(column, token: str, *, unaccent: bool) -> ColumnElement[bool]:
    """Accent-optional, case-insensitive match against `column` for one token.
    Wildcard tokens use a per-word Postgres regex (`~*`); plain tokens use a
    substring ILIKE."""
    tok = strip_accents(token).lower() if unaccent else token
    col = func.unaccent(column) if unaccent else column
    if "*" in tok:
        return col.op("~*")(_token_to_regex_sql(tok))
    return col.ilike(_token_to_pattern(tok), escape=_LIKE_ESCAPE)


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
