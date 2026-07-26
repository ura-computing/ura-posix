"""create pharmacy_supplier_exclusions

Revision ID: 0018
Revises: 0017
Create Date: 2026-07-26

Owner-managed exclusion by supplier (fournisseur) NAME — the achats-side sibling
of pharmacy_bl_exclusions. An excluded supplier's Achat rows drop out of every
aggregate via achat_supplier_filter(). Supplier is free text on Achat.supplier
(no supplier entity), matched accent/case-insensitively.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pharmacy_supplier_exclusions",
        sa.Column("id",          sa.Integer, primary_key=True),
        sa.Column("pharmacy_id", sa.Integer, sa.ForeignKey("pharmacies.id"), nullable=False),
        sa.Column("supplier",    sa.String,  nullable=False),
        sa.Column("notes",       sa.String,  nullable=True),
        sa.Column("created_at",  sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("pharmacy_id", "supplier", name="uq_pharmacy_supplier"),
    )
    op.create_index("ix_pharmacy_supplier_exclusions_pharmacy_id", "pharmacy_supplier_exclusions", ["pharmacy_id"])
    op.create_index("ix_pharmacy_supplier_exclusions_supplier",    "pharmacy_supplier_exclusions", ["supplier"])


def downgrade() -> None:
    op.drop_index("ix_pharmacy_supplier_exclusions_supplier",    table_name="pharmacy_supplier_exclusions")
    op.drop_index("ix_pharmacy_supplier_exclusions_pharmacy_id", table_name="pharmacy_supplier_exclusions")
    op.drop_table("pharmacy_supplier_exclusions")
