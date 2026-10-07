"""product_infos: photos + description scraped from parapharmacy shops (« Produits »)

Revision ID: 0025
Revises: 0024
Create Date: 2026-10-07

Filled at every start by scripts/load_product_infos.py from backend/data/product_infos.json.
A product finds its row when shown: same PID first, then a same barcode.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("product_infos"):
        return
    op.create_table(
        "product_infos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pid", sa.String(), nullable=True, unique=True),
        sa.Column("barcode1", sa.String(), nullable=True),
        sa.Column("barcode2", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("brand", sa.String(), nullable=True),
        sa.Column("category", sa.String(), nullable=True),
        sa.Column("images", sa.JSON(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("source_url", sa.String(), nullable=True),
    )
    op.create_index("ix_product_infos_barcode1", "product_infos", ["barcode1"])
    op.create_index("ix_product_infos_barcode2", "product_infos", ["barcode2"])


def downgrade() -> None:
    op.drop_table("product_infos")
