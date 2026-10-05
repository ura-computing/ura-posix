"""import batches: time of the last chunk received

Revision ID: 0020
Revises: 0019
Create Date: 2026-10-03

`last_chunk_at` = when the newest chunk of an import arrived. A batch still
`in_progress` with no chunk for 1 minute is shown as `interrupted` (browser
closed or refreshed before the last chunk). Older rows stay NULL: the list falls
back to `imported_at`.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    existing = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("import_batches")}
    if "last_chunk_at" not in existing:
        op.add_column("import_batches", sa.Column("last_chunk_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("import_batches", "last_chunk_at")
