"""create payment_entries table (Comptabilité — manual monthly bookkeeping)

Revision ID: 0012
Revises: 0011
Create Date: 2026-06-24

The Comptabilité page lets the owner record monthly totals per payment method
(TPE / Espèces / Chèques / Virement) — totals that don't come from Sobrus
CSVs. Upserted by (pharmacy_id, month, method). Idempotent against existing
apcm-pharma DBs (skipped when the table already exists)."""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    if insp.has_table("payment_entries"):
        return  # apcm-pharma DBs may have the same table from the old code
    op.create_table(
        "payment_entries",
        sa.Column("id",                   sa.Integer(), nullable=False),
        sa.Column("pharmacy_id",          sa.Integer(), nullable=False),
        sa.Column("month",                sa.String(),  nullable=False),
        sa.Column("method",               sa.String(),  nullable=False),
        sa.Column("pharmacie_amount",     sa.Float(),   nullable=False, server_default="0"),
        sa.Column("parapharmacie_amount", sa.Float(),   nullable=False, server_default="0"),
        sa.Column("count",                sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at",           sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at",           sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["pharmacy_id"], ["pharmacies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("pharmacy_id", "month", "method", name="uq_payment_entries_pharmacy_month_method"),
    )
    op.create_index("ix_payment_entries_pharmacy_month", "payment_entries", ["pharmacy_id", "month"])


def downgrade() -> None:
    op.drop_index("ix_payment_entries_pharmacy_month", table_name="payment_entries")
    op.drop_table("payment_entries")
