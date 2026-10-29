"""pharmacy_bl_line_exclusions (« Exclure un produit d'un BL »)

Revision ID: 0032
Revises: 0031
Create Date: 2026-10-29

One product's lines on one BL, left out of Comptabilité: the same product bought on several BLs,
only some of them excluded. Only those achat lines drop; its other BLs and its ventes stay
(app/accounting/exclusions/service.py). The whole-BL exclusions (pharmacy_bl_exclusions) keep
their rule.

Downgrade: drops the table.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0032"
down_revision = "0031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("pharmacy_bl_line_exclusions"):
        return
    op.create_table(
        "pharmacy_bl_line_exclusions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pharmacy_id", sa.Integer(), sa.ForeignKey("pharmacies.id"), nullable=False),
        sa.Column("delivery_ref", sa.String(), nullable=False),
        sa.Column("medicament_id", sa.Integer(), sa.ForeignKey("medicaments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("pharmacy_id", "delivery_ref", "medicament_id", name="uq_pharmacy_bl_line"),
    )
    op.create_index("ix_pharmacy_bl_line_exclusions_pharmacy_id", "pharmacy_bl_line_exclusions", ["pharmacy_id"])


def downgrade() -> None:
    op.drop_table("pharmacy_bl_line_exclusions")
