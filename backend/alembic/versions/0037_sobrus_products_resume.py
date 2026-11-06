"""sobrus_connections.products_page: where the admin's Sobrus product import resumes

Revision ID: 0037
Revises: 0036
Create Date: 2026-11-06

An import of Sobrus' product list cut before the end (« Arrêter », worker restart, error) keeps its last saved page
here; the next one starts there instead of page 1. Reading the whole list clears it.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0037"
down_revision = "0036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("sobrus_connections")}
    if "products_page" not in columns:
        op.add_column("sobrus_connections", sa.Column("products_page", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("sobrus_connections", "products_page")
