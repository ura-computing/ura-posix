"""backfill product_type on existing medicaments (F19)

One-time data migration: applies the keyword regex over every Medicament row
where product_type IS NULL. Categories matching the pharma keyword set become
'pharmacie'; everything else becomes 'parapharmacie'.

After this runs, `/admin/catalogue` shows Pharmacie/Parapharmacie pills for
every existing row + the runtime regex in routers/transactions.py can be
dropped (the API reads med.product_type directly).

No DDL — pure UPDATE statements. Reversible (downgrade clears all values).

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-23
"""

from typing import Sequence, Union

from alembic import op


revision: str = "0010"
down_revision: Union[str, Sequence[str], None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: meds whose category matches any pharma keyword → 'pharmacie'.
    # Postgres regex `~` is case-sensitive; we lower() the category to align
    # with `pharma_expr()`'s func.lower(...).contains(...) pattern.
    op.execute("""
        UPDATE medicaments
        SET product_type = 'pharmacie'
        WHERE product_type IS NULL
          AND lower(category) ~ '(edicament|édicament|oméopath|omeopath|iététique|ietetique)'
    """)
    # Step 2: everything else still NULL → 'parapharmacie' (matches the SQL
    # `else_=False` branch in stats_queries.pharma_expr()).
    op.execute("""
        UPDATE medicaments
        SET product_type = 'parapharmacie'
        WHERE product_type IS NULL
    """)


def downgrade() -> None:
    # Best-effort: clear everything. We can't reliably distinguish admin-edited
    # rows from auto-classified ones after the fact, so the downgrade just
    # nukes the column back to NULL. Acceptable for the refactor branch;
    # production should never run this downgrade.
    op.execute("UPDATE medicaments SET product_type = NULL WHERE product_type IS NOT NULL")
