"""Tokenized search helpers (PG-006).

Pharmacists type search queries like:
  "doliprane 1000"     → two tokens, both must match somewhere
  "societe para"       → matches "Société PARA LA CDP" (accent-insensitive)
  "soc*cdp"            → wildcard split — same effect as above
  "transpaent"         → matches "transparent" via word_similarity (typo)

Builds on Postgres `unaccent` + `pg_trgm` extensions (enabled in the db).
Used by /achats and /ventes search + suggestions endpoints.
"""
from __future__ import annotations

import re
from typing import Iterable

from sqlalchemy import func, or_
from sqlalchemy.sql.elements import ColumnElement

from csv_parse import strip_accents
from models import Medicament


_FUZZY_THRESHOLD = 0.5   # pg_trgm word_similarity cutoff
_FUZZY_MIN_LEN   = 4     # don't fuzzy-match very short tokens (false positives)
_TOKEN_SPLIT     = re.compile(r"[\s*]+")


def tokenize_search(query: str | None) -> list[str]:
    """Split on whitespace and `*`. Lowercase. Dedupe (order preserved)."""
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


def _unaccent_ilike(column, token: str) -> ColumnElement[bool]:
    """Case + accent insensitive substring match. The column gets unaccent()'d
    in SQL; the token is stripped Python-side to avoid double unaccent calls."""
    pat = f"%{strip_accents(token).lower()}%"
    return func.unaccent(column).ilike(pat)


def supplier_search_clauses(
    tokens: Iterable[str],
    columns: Iterable,
) -> list[ColumnElement[bool]]:
    """For each token: OR(unaccent_ilike(col, tok) for col in columns).
    Caller ANDs the clauses (Google-style — every token must match somewhere).

    Designed for supplier / delivery-ref / generic-text search where the
    columns don't include pid/barcodes."""
    cols = list(columns)
    return [or_(*(_unaccent_ilike(col, tok) for col in cols)) for tok in tokens]


def product_search_clauses(
    tokens: Iterable[str],
    extra_columns: Iterable = (),
) -> list[ColumnElement[bool]]:
    """Product search across name + pid + barcodes + any extra columns
    (typically Achat.supplier + Achat.delivery_ref). Adds a fuzzy
    `word_similarity` fallback when the token is ≥4 chars."""
    clauses: list[ColumnElement[bool]] = []
    extra = list(extra_columns)
    for tok in tokens:
        raw_pat      = f"%{tok}%"
        stripped     = strip_accents(tok).lower()
        stripped_pat = f"%{stripped}%"
        ors: list[ColumnElement[bool]] = [
            func.unaccent(Medicament.product).ilike(stripped_pat),
            Medicament.pid.ilike(raw_pat),
            Medicament.barcode1.ilike(raw_pat),
            Medicament.barcode2.ilike(raw_pat),
        ]
        ors.extend(func.unaccent(col).ilike(stripped_pat) for col in extra)
        if len(tok) >= _FUZZY_MIN_LEN:
            ors.append(
                func.word_similarity(stripped, func.unaccent(Medicament.product)) > _FUZZY_THRESHOLD
            )
        clauses.append(or_(*ors))
    return clauses