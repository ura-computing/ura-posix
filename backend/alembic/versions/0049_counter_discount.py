"""« Remise comptoir »: the owner's counter discount per product (%), on « Prix et marge »; shown in « Promis ».

Revision ID: 0049
Revises: 0048
Create Date: 2026-11-25

Downgrade: the column is dropped.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0049"
down_revision = "0048"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pharmacy_product_edits", sa.Column("counter_discount", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("pharmacy_product_edits", "counter_discount")
