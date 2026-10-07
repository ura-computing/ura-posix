"""pharmacy_product_edits: the owner's own values for a product (« Produits », « Modifier »)

Revision ID: 0027
Revises: 0026
Create Date: 2026-10-07

One row per pharmacy × product, one nullable column per editable field (NULL = not edited).
Shown in « Produits » only; imports never write here, so a hand edit wins until the owner
clicks « Revenir à la valeur importée ». The type (pharmacie / parapharmacie) is not editable.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0027"
down_revision = "0026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("pharmacy_product_edits"):
        return
    op.create_table(
        "pharmacy_product_edits",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pharmacy_id", sa.Integer(), sa.ForeignKey("pharmacies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("medicament_id", sa.Integer(), sa.ForeignKey("medicaments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product", sa.String(), nullable=True),
        sa.Column("laboratoire", sa.String(), nullable=True),
        sa.Column("category", sa.String(), nullable=True),
        sa.Column("tva", sa.String(), nullable=True),
        sa.Column("ppv", sa.Float(), nullable=True),
        sa.Column("pph", sa.Float(), nullable=True),
        sa.Column("zone", sa.String(), nullable=True),
        sa.Column("current_stock", sa.Integer(), nullable=True),
        sa.Column("stock_min", sa.Integer(), nullable=True),
        sa.Column("stock_max", sa.Integer(), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("barcode1", sa.String(), nullable=True),
        sa.Column("barcode2", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.UniqueConstraint("pharmacy_id", "medicament_id", name="uq_pharmacy_product_edit"),
    )
    op.create_index("ix_pharmacy_product_edits_pharmacy_id", "pharmacy_product_edits", ["pharmacy_id"])
    op.create_index("ix_pharmacy_product_edits_medicament_id", "pharmacy_product_edits", ["medicament_id"])


def downgrade() -> None:
    op.drop_table("pharmacy_product_edits")
