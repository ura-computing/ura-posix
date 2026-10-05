"""add status + error_message columns to import_batches

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-22

Page 2 (Upload-file) prerequisite — lets the Imports tab show "Cancelled at
412 / 2000 rows" instead of misleading "Succeeded with 412". `status` defaults
to "success" so existing batches keep their semantics.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    cols = {c["name"] for c in insp.get_columns("import_batches")}

    if "status" not in cols:
        op.add_column(
            "import_batches",
            sa.Column("status", sa.String(), nullable=False, server_default="success"),
        )

    if "error_message" not in cols:
        op.add_column(
            "import_batches",
            sa.Column("error_message", sa.String(), nullable=True),
        )


def downgrade() -> None:
    op.drop_column("import_batches", "error_message")
    op.drop_column("import_batches", "status")
