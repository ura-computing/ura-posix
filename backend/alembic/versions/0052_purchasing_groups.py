"""Purchasing groups (D-5): pharmacies that buy together. None known yet: the screen starts empty.

Revision ID: 0052
Revises: 0051
Create Date: 2026-11-25

Downgrade: the 2 tables are dropped.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0052"
down_revision = "0051"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "purchasing_groups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False, unique=True),
        sa.Column("note", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "purchasing_group_members",
        sa.Column(
            "group_id", sa.Integer(), sa.ForeignKey("purchasing_groups.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("pharmacy_id", sa.Integer(), sa.ForeignKey("pharmacies.id", ondelete="CASCADE"), primary_key=True),
    )


def downgrade() -> None:
    op.drop_table("purchasing_group_members")
    op.drop_table("purchasing_groups")
