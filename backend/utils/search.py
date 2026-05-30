"""Search helpers built on top of `tokenize_search` for product lookup.

Combines case-insensitive substring match across multiple columns with a
PostgreSQL `pg_trgm` `word_similarity` fallback so typos like
`TRANSPAENT` still match `TRANSPARENT`. Also matches product barcodes
(`Medicament.barcode1` / `barcode2`) so users can paste a barcode into
any search box.
"""
from typing import Iterable

from sqlalchemy import Column, func, or_
from sqlalchemy.sql.elements import ColumnElement

from models import Medicament
from utils.strings import strip_accents

# pg_trgm `word_similarity` threshold. 0.5 is restrictive enough to ignore
# noise on common French words but loose enough to catch single-letter
# typos in long product names.
_FUZZY_THRESHOLD = 0.5

# Don't fuzzy-match very short tokens — they cause too many false hits.
_FUZZY_MIN_LEN = 4


def _unaccent_ilike(column: Column, token: str) -> ColumnElement[bool]:
    """Case- and accent-insensitive substring match on `column`.

    Uses the PostgreSQL `unaccent` extension (enabled on boot in main.py) on
    the column; the token is stripped Python-side so we don't have to call
    unaccent on each search input. `ilike` keeps the case-insensitivity.
    """
    pat = f"%{strip_accents(token).lower()}%"
    return func.unaccent(column).ilike(pat)


def supplier_search_clauses(
    tokens: Iterable[str],
    columns: Iterable[Column],
) -> list[ColumnElement[bool]]:
    """For each token, return OR(unaccent_ilike(col, tok) for col in columns).

    Caller is expected to AND the returned clauses, mirroring the behaviour of
    `product_search_clauses`. Designed for the supplier/laboratoire/BL-ref
    search on the Achats page (PG-006) where pharmacists may type fragments
    without accents (`societe para` → `Société PARA LA CDP`) or with `*` as a
    wildcard separator (`soc*cdp`) — the latter is already supported by
    `tokenize_search` which splits on `*`.
    """
    clauses: list[ColumnElement[bool]] = []
    cols = list(columns)
    for tok in tokens:
        clauses.append(or_(*(_unaccent_ilike(col, tok) for col in cols)))
    return clauses


def product_search_clauses(
    tokens: Iterable[str],
    extra_columns: Iterable[Column] = (),
) -> list[ColumnElement[bool]]:
    """For each token, return an OR clause covering product name + pid +
    barcodes + any *extra_columns* (e.g. `Achat.supplier`), with a
    `word_similarity` fuzzy fallback when the token is long enough.

    Text columns (product + extras like supplier) are matched
    accent-insensitively via `unaccent` (PG-006) so `societe` finds `Société`.
    PID + barcodes stay on plain ilike — they're alphanumeric and unaccent
    would just be wasted SQL.

    Caller is expected to AND the returned clauses (so multiple tokens
    must all match somewhere — Google-style search).
    """
    clauses: list[ColumnElement[bool]] = []
    extra = list(extra_columns)
    for tok in tokens:
        raw_pat = f"%{tok}%"
        stripped = strip_accents(tok).lower()
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
