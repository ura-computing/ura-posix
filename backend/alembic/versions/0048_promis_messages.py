"""« Promis » messages: each WhatsApp message a person sent to the customer (created, ready, reminder, returned), so
the dashboard knows which ones are still due today.

Revision ID: 0048
Revises: 0047
Create Date: 2026-11-25

Downgrade: the table is dropped.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0048"
down_revision = "0047"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "promis_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("promis_id", sa.Integer(), sa.ForeignKey("promis.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("sent_by_name", sa.String(), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("kind IN ('created', 'ready', 'reminder', 'returned')", name="ck_promis_messages_kind"),
    )
    op.create_index("ix_promis_messages_promis_id", "promis_messages", ["promis_id"])


def downgrade() -> None:
    op.drop_table("promis_messages")
