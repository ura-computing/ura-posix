"""sales / purchases: dates typed by hand rewritten as ISO text (B8)

Revision ID: 0021
Revises: 0020
Create Date: 2026-10-04

A Sobrus file opened and saved again by hand (Excel, Numbers) has day-first dates:
« 23/1/26 », « 23/1/26 14:19 ». They were stored as-is, so the period filters
(text compared with « 2026-01-01 ») put them in the wrong place and a « 23/1/26 »
cast to a date broke the page. Imports now store ISO text
(`app/ingestion/csv_parse.normalize_date`); this rewrites the lines already stored
the same way: « 23/1/26 » → « 2026-01-23 », unreadable → NULL. Only the few
non-ISO values are touched (one UPDATE per column). The parser is copied here on
purpose: a migration never imports app code.

Downgrade: nothing to undo (the old spelling is not kept).
"""

from __future__ import annotations

import re
from datetime import datetime

import sqlalchemy as sa
from alembic import op

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None

_DATE_RE = re.compile(
    r"(?:(?P<y>\d{4}) ?[-/.] ?(?P<m>\d{1,2}) ?[-/.] ?(?P<d>\d{1,2})"
    r"|(?P<dd>\d{1,2}) ?[-/.] ?(?P<mm>\d{1,2}) ?[-/.] ?(?P<yy>\d{4}|\d{2}))"
    r"(?:[T ](?P<H>\d{1,2}):(?P<M>\d{2})(?::(?P<S>\d{2})(?:[.,]\d+)?)?)?"
)

# (table, column, keep the time, Postgres regex of the values already right)
_COLUMNS = [
    ("ventes", "date", False, r"^\d{4}-\d{2}-\d{2}$"),
    ("achats", "delivery_date", False, r"^\d{4}-\d{2}-\d{2}$"),
    ("achats", "expiry_date", False, r"^\d{4}-\d{2}-\d{2}$"),
    ("achats", "created_at_source", True, r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$"),
]


def _normalize(val: str, with_time: bool) -> str | None:
    m = _DATE_RE.fullmatch(" ".join(val.split()).strip("\"' "))
    if not m:
        return None
    if m["y"]:
        y, mo, d = int(m["y"]), int(m["m"]), int(m["d"])
    else:
        y, mo, d = int(m["yy"]), int(m["mm"]), int(m["dd"])
        if y < 100:
            y += 2000
    try:
        dt = datetime(y, mo, d, int(m["H"] or 0), int(m["M"] or 0), int(m["S"] or 0))
    except ValueError:
        return None
    return dt.isoformat(sep=" ") if with_time else dt.date().isoformat()


def upgrade() -> None:
    bind = op.get_bind()
    for table, column, with_time, iso in _COLUMNS:
        olds = (
            bind.execute(
                sa.text(f'SELECT DISTINCT "{column}" FROM {table} WHERE "{column}" IS NOT NULL AND "{column}" !~ :iso'),
                {"iso": iso},
            )
            .scalars()
            .all()
        )
        if not olds:
            continue
        bind.execute(
            sa.text(
                f'UPDATE {table} t SET "{column}" = m.new '
                "FROM unnest(CAST(:olds AS text[]), CAST(:news AS text[])) AS m(old, new) "
                f'WHERE t."{column}" = m.old'
            ),
            {"olds": olds, "news": [_normalize(v, with_time) for v in olds]},
        )


def downgrade() -> None:
    pass
