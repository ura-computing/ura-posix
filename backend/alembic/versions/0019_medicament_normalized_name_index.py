"""immutable_unaccent wrapper + expression index on medicaments normalized name

Revision ID: 0019
Revises: 0018
Create Date: 2026-09-24

`existing_by_name()` (csv_parse.py) filters `medicaments` on
lower(regexp_replace(trim(unaccent(product)), '\\s+', ' ', 'g')) — the same
normalization `normalized_name()` does in Python — on every achat/vente/stock
import chunk that resolves an unmatched PID. `medicaments` is a single GLOBAL
catalog shared by every pharmacy, and that expression had no supporting
index, so the query fell back to a full sequential table scan (re-running
unaccent/regexp_replace/lower over every row) on every chunk of every
import platform-wide. Under concurrent load this held DB connections open
long enough to exhaust the app's connection pool (QueuePoolTimeout) for
unrelated tenants.

Postgres's built-in `unaccent(text)` is STABLE (not IMMUTABLE — it depends on
the current text search configuration), so it can't be used directly in a
B-tree expression index. The standard workaround: a thin SQL wrapper that
pins the dictionary explicitly and is safe to mark IMMUTABLE.

`csv_parse._normalized_name_expr` is updated alongside this migration to call
`immutable_unaccent(...)` instead of `unaccent(...)` so the query expression
matches the indexed expression exactly (Postgres matches expression indexes
syntactically) and the planner actually picks up the index.

CREATE INDEX CONCURRENTLY can't run inside the transaction Alembic normally
wraps each migration in, hence `autocommit_block()`.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


INDEX_NAME = "ix_medicaments_normalized_name"


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent;")
    # Schema-qualified: Postgres 17+ runs index expressions (CREATE INDEX,
    # REINDEX, ANALYZE) with search_path = pg_catalog, pg_temp, so a bare
    # `unaccent` isn't found there. Same body as bootstrap.py.
    op.execute("""
        CREATE OR REPLACE FUNCTION immutable_unaccent(text)
        RETURNS text AS
        $$
            SELECT public.unaccent('public.unaccent'::regdictionary, $1)
        $$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;
    """)

    # CONCURRENTLY avoids holding a write-blocking lock on `medicaments`
    # while the index builds — safe to run against a live prod table.
    with op.get_context().autocommit_block():
        # A failed earlier attempt of this migration (unqualified body on
        # Postgres 17) leaves an INVALID index with this name; IF NOT EXISTS
        # would then skip the build. This migration only runs where it never
        # finished, so dropping first is safe.
        op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {INDEX_NAME};")
        op.execute(f"""
            CREATE INDEX CONCURRENTLY IF NOT EXISTS {INDEX_NAME}
            ON medicaments (
                lower(regexp_replace(trim(immutable_unaccent(product)), '\\s+', ' ', 'g'))
            );
        """)


def downgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {INDEX_NAME};")
    op.execute("DROP FUNCTION IF EXISTS immutable_unaccent(text);")
