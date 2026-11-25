"""Our own orders (D-7): « Commandes du jour », one draft per supplier, its lines (suggested / chosen quantity, why,
which group). Validated orders keep a frozen copy of what was decided (D-9 sends them).

Revision ID: 0053
Revises: 0052
Create Date: 2026-11-25

Downgrade: the 2 tables are dropped.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0053"
down_revision = "0052"
branch_labels = None
depends_on = None

_STATES = ("draft", "validated", "sent", "confirmed", "partial", "refused", "delivered", "cancelled")
_GROUPS = ("urgent", "restock", "promis", "check")


def upgrade() -> None:
    now = sa.func.now()
    op.create_table(
        "purchase_orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pharmacy_id", sa.Integer(), sa.ForeignKey("pharmacies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("supplier_id", sa.Integer(), sa.ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True),
        sa.Column("state", sa.String(), nullable=False, server_default="draft"),
        sa.Column("frozen", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=now),
        sa.Column("validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("validated_by_name", sa.String(), nullable=True),
        sa.CheckConstraint(f"state IN {_STATES}", name="ck_purchase_orders_state"),
    )
    op.create_index("ix_purchase_orders_pharmacy_state", "purchase_orders", ["pharmacy_id", "state"])
    op.create_table(
        "purchase_order_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("medicament_id", sa.Integer(), sa.ForeignKey("medicaments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("suggested", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("edited", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("group", sa.String(), nullable=False, server_default="restock"),
        sa.Column("for_shelf", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("for_promis", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("customers", sa.JSON(), nullable=True),
        sa.Column("unit_price", sa.Float(), nullable=True),
        sa.UniqueConstraint("order_id", "medicament_id", name="uq_purchase_order_lines_product"),
        sa.CheckConstraint("quantity > 0", name="ck_purchase_order_lines_quantity"),
        sa.CheckConstraint(f'"group" IN {_GROUPS}', name="ck_purchase_order_lines_group"),
    )
    op.create_index("ix_purchase_order_lines_order_id", "purchase_order_lines", ["order_id"])


def downgrade() -> None:
    op.drop_table("purchase_order_lines")
    op.drop_table("purchase_orders")
