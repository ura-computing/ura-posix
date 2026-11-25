"""« Retours clients (avoirs) »: Sobrus' sales returns, read by the worker at every run (`/salesreturns`).

Revision ID: 0045
Revises: 0044
Create Date: 2026-11-25

Downgrade: the table and `sobrus_connections.returns_access` are dropped.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0045"
down_revision = "0044"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sobrus_sales_returns",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pharmacy_id", sa.Integer(), sa.ForeignKey("pharmacies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sobrus_id", sa.String(), nullable=False),
        sa.Column("number", sa.String(), nullable=False),
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("customer", sa.String(), nullable=True),
        sa.Column("refund", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("products", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("pharmacy_id", "sobrus_id", name="uq_sobrus_sales_returns_pharmacy_sobrus"),
    )
    op.create_index("ix_sobrus_sales_returns_pharmacy_day", "sobrus_sales_returns", ["pharmacy_id", "day"])
    op.add_column("sobrus_connections", sa.Column("returns_access", sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column("sobrus_connections", "returns_access")
    op.drop_table("sobrus_sales_returns")
