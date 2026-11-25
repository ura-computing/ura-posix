"""Supplier conditions (D-2): one rule per row (minimum, tiers, discount, pack, payment discount, transport,
packaging multiple, return rule), the exact products it covers (never « all the lab »), every old version kept.

Revision ID: 0051
Revises: 0050
Create Date: 2026-11-25

Downgrade: the 3 tables are dropped.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0051"
down_revision = "0050"
branch_labels = None
depends_on = None

_KINDS = (
    "minimum_order",
    "qty_tiers",
    "amount_tiers",
    "product_discount",
    "pack",
    "payment_discount",
    "transport",
    "packaging",
    "return_rule",
)
_STATES = ("confirmed", "unverified", "missing")
_BASES = ("units", "mad", "references")


def upgrade() -> None:
    now = sa.func.now()
    op.create_table(
        "supplier_conditions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("supplier_id", sa.Integer(), sa.ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("basis", sa.String(), nullable=True),
        sa.Column("value", sa.Float(), nullable=True),
        sa.Column("days", sa.Integer(), nullable=True),
        sa.Column("tiers", sa.JSON(), nullable=True),
        sa.Column("text", sa.String(), nullable=True),
        sa.Column("valid_from", sa.Date(), nullable=True),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("state", sa.String(), nullable=False, server_default="unverified"),
        sa.Column("source", sa.String(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("updated_by_name", sa.String(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=now),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(f"kind IN {_KINDS}", name="ck_supplier_conditions_kind"),
        sa.CheckConstraint(f"state IN {_STATES}", name="ck_supplier_conditions_state"),
        sa.CheckConstraint(f"basis IS NULL OR basis IN {_BASES}", name="ck_supplier_conditions_basis"),
    )
    op.create_index("ix_supplier_conditions_supplier_id", "supplier_conditions", ["supplier_id"])
    op.create_table(
        "condition_products",
        sa.Column(
            "condition_id", sa.Integer(), sa.ForeignKey("supplier_conditions.id", ondelete="CASCADE"), primary_key=True
        ),
        sa.Column("medicament_id", sa.Integer(), sa.ForeignKey("medicaments.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_table(
        "condition_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "condition_id", sa.Integer(), sa.ForeignKey("supplier_conditions.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("changed_by_name", sa.String(), nullable=False),
        sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False, server_default=now),
    )
    op.create_index("ix_condition_history_condition_id", "condition_history", ["condition_id"])


def downgrade() -> None:
    for table in ("condition_history", "condition_products", "supplier_conditions"):
        op.drop_table(table)
