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

# pg_trgm `word_similarity` threshold. 0.5 is restrictive enough to ignore
# noise on common French words but loose enough to catch single-letter
# typos in long product names.
_FUZZY_THRESHOLD = 0.5

# Don't fuzzy-match very short tokens — they cause too many false hits.
_FUZZY_MIN_LEN = 4


def product_search_clauses(
    tokens: Iterable[str],
    extra_columns: Iterable[Column] = (),
) -> list[ColumnElement[bool]]:
    """For each token, return an OR clause covering product name + pid +
    barcodes + any *extra_columns* (e.g. `Achat.supplier`), with a
    `word_similarity` fuzzy fallback when the token is long enough.

    Caller is expected to AND the returned clauses (so multiple tokens
    must all match somewhere — Google-style search).
    """
    clauses: list[ColumnElement[bool]] = []
    extra = list(extra_columns)
    for tok in tokens:
        pat = f"%{tok}%"
        ors: list[ColumnElement[bool]] = [
            Medicament.product.ilike(pat),
            Medicament.pid.ilike(pat),
            Medicament.barcode1.ilike(pat),
            Medicament.barcode2.ilike(pat),
        ]
        ors.extend(col.ilike(pat) for col in extra)
        if len(tok) >= _FUZZY_MIN_LEN:
            ors.append(func.word_similarity(tok, Medicament.product) > _FUZZY_THRESHOLD)
        clauses.append(or_(*ors))
    return clauses
