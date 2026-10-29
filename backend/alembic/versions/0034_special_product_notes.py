"""pharmacy_medicament_status.notes (« Ajouter une note » on an excluded product)

Revision ID: 0034
Revises: 0033
Create Date: 2026-10-29

Produits spéciaux: every excluded line (product, BL, supplier, product on a BL) takes the owner's
note after the exclusion; BLs, suppliers and BL lines already had one.

Downgrade: drops the column.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0034"
down_revision = "0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("pharmacy_medicament_status")}
    if "notes" not in columns:
        op.add_column("pharmacy_medicament_status", sa.Column("notes", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("pharmacy_medicament_status", "notes")
