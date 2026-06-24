"""add `archived_at` to pharmacies (soft-delete column)

Revision ID: 0013
Revises: 0012
Create Date: 2026-06-23

Admin's pharmacy management page does a SOFT delete (per locked spec) — the row
stays, related transactions/stock/payments still link to it, but it disappears
from default listings. `archived_at` is the marker.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    existing = {c["name"] for c in insp.get_columns("pharmacies")}
    if "archived_at" not in existing:
        op.add_column("pharmacies", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("pharmacies", "archived_at")
