"""create category_suffixes table

Revision ID: 0008
Revises: 0007
Create Date: 2026-06-21

Page 3 (Ventes) prerequisite — global table mapping a category name to its
transaction reference suffix + colour key. Drives the SuffixBadge column
appended to N° Transaction cells. Owner-managed CRUD.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if insp.has_table("category_suffixes"):
        return
    op.create_table(
        "category_suffixes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("category", sa.String(), nullable=False, unique=True),
        sa.Column("suffix", sa.String(), nullable=False),
        sa.Column("color", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("category_suffixes")
