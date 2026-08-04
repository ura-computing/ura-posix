"""Tokenized search helpers (PG-006).

Pharmacists type search queries like:
  "doliprane 1000"     → two tokens, both must match somewhere (AND)
  "societe para"       → matches "Société PARA LA CDP" (accent-insensitive)

Search is **strict substring** — accent- and case-insensitive — with an explicit
`*` grammar:

  "med"      → contains "med"                 (ILIKE %med%)
  "*med"     → contains "med"                 (ILIKE %med%)
  "med*"     → starts with "med"              (ILIKE med%)
  "*a*b*c"   → contains a OR b OR c            (%a% OR %b% OR %c%)

Rule per token: split on `*`; keep non-empty parts.
  - 1 part, token ends with `*` (not starts) → starts-with   `part%`
  - 1 part otherwise                         → contains       `%part%`
  - 2+ parts                                 → OR of contains `%p%` for each p

Multiple whitespace-separated tokens are ANDed (every token must match somewhere).
Builds on the Postgres `unaccent` extension (enabled in the db).
"""
from __future__ import annotations

import re
from typing import Iterable

from sqlalchemy import func, or_, true
from sqlalchemy.sql.elements import ColumnElement

from csv_parse import strip_accents
from models import Medicament


_TOKEN_SPLIT = re.compile(r"\s+")   # split on whitespace only — `*` is grammar, not a separator here
_LIKE_ESCAPE = "\\"                  # ILIKE escape char for literal % and _


def tokenize_search(query: str | None) -> list[str]:
    """Split on whitespace. Lowercase. Dedupe (order preserved).
    `*` is preserved inside tokens (it drives the grammar, handled downstream)."""
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
    """Escape ILIKE metacharacters (`%`, `_`, and the escape char itself) so user
    input can't act as a wildcard by accident."""
    return (
        literal.replace(_LIKE_ESCAPE, _LIKE_ESCAPE * 2)
        .replace("%", _LIKE_ESCAPE + "%")
        .replace("_", _LIKE_ESCAPE + "_")
    )


def _token_to_pattern(token: str) -> str:
    """Single ILIKE pattern for one token (legacy wrapper used by tests).
    Returns '' for lone `*` (caller must handle the "match all" semantic)."""
    parts = _token_to_ilike_patterns(token)
    return parts[0] if parts else ""


def _token_to_ilike_patterns(token: str) -> list[str]:
    """ILIKE patterns for one token per the `*` grammar (see module docstring).
    Returns one pattern (contains/starts) or several (OR of contains)."""
    parts = [p for p in token.split("*") if p]
    if not parts:
        return []                                    # lone "*" → matches everything (handled by caller)
    if len(parts) == 1:
        seg = _like_escape(parts[0])
        if token.endswith("*") and not token.startswith("*"):
            return [f"{seg}%"]                        # starts with
        return [f"%{seg}%"]                           # contains
    return [f"%{_like_escape(p)}%" for p in parts]    # OR of contains


def _token_to_regex_sql(token: str) -> str:
    """Postgres regex for one token per the `*` grammar, word-anchored (\\m/\\M).
    - `rino*` → `\\mrino` (starts with)
    - `*enil` → `enil\\M` (ends with)
    - `ri*il` → `\\mri[^[:space:]]*il\\M` (infix, within one word)
    - bare `cin` → `\\mcin\\M` (exact word match)
    Metacharacters (`.`, `(`, `)`, etc.) are regex-escaped."""
    parts = [p for p in token.split("*") if p]
    if not parts:
        return ""                                    # lone "*" → match all

    def _re_escape(s: str) -> str:
        return re.escape(s)

    if len(parts) == 1:
        seg = _re_escape(parts[0])
        if token.endswith("*") and not token.startswith("*"):
            return r"\m" + seg                        # starts with
        if token.startswith("*") and not token.endswith("*"):
            return seg + r"\M"                        # ends with
        return r"\m" + seg + r"\M"                    # exact word

    # Infix: a*b → \ma[^[:space:]]*b\M
    inner = r"[^[:space:]]*".join(_re_escape(p) for p in parts)
    return r"\m" + inner + r"\M"


def _pattern_ilike(column, token: str, *, unaccent: bool) -> ColumnElement[bool]:
    """Accent-optional, case-insensitive match against `column` for one token,
    following the `*` grammar.
    Simple tokens (prefix/suffix/contains) → ILIKE.
    Infix tokens (a*b) → per-word Postgres regex (~*) so they don't cross word boundaries."""
    tok = strip_accents(token).lower() if unaccent else token
    col = func.unaccent(column) if unaccent else column
    parts = [p for p in tok.split("*") if p]
    if not parts:
        return true()                                 # lone "*" → no constraint
    if len(parts) >= 2:
        # Infix: use per-word regex so a*b must match within ONE word
        regex = _token_to_regex_sql(tok)
        return col.op("~*")(regex) if regex else true()
    patterns = _token_to_ilike_patterns(tok)
    return or_(*(col.ilike(p, escape=_LIKE_ESCAPE) for p in patterns))


def matches_all_tokens(text: str | None, tokens: Iterable[str]) -> bool:
    """Python twin of the SQL search (for endpoints that filter materialized lists).
    Every token must match `text` (accent/case-insensitive) per the `*` grammar:
    contains / starts-with / word-anchored infix (mirrors `_token_to_regex_sql`)."""
    norm = strip_accents(text or "").lower()

    def _tok_ok(raw: str) -> bool:
        tok = strip_accents(raw).lower()
        parts = [p for p in tok.split("*") if p]
        if not parts:
            return True                               # lone "*"
        if len(parts) == 1:
            if tok.endswith("*") and not tok.startswith("*"):
                return norm.startswith(parts[0])       # starts with
            return parts[0] in norm                    # contains
        # 2+ parts: infix a*b*c → must match WITHIN ONE WORD
        # Build a regex: \mpart1[^[:space:]]*part2[^[:space:]]*part3\M
        inner = r"[^\s]*".join(re.escape(p) for p in parts)
        pattern = re.compile(inner)
        words = _TOKEN_SPLIT.split(norm)
        return any(pattern.search(w) for w in words)   # at least one word must contain the infix

    return all(_tok_ok(t) for t in tokens)


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
    (typically Achat.supplier + Achat.delivery_ref). Strict substring with the
    `*` grammar — no fuzzy matching."""
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
