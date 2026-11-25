"""« Fournisseurs »: what ordering needs (contact, ordering channel, delivery days, cut-off, lead time, payment,
transport fees), a note, and « Archiver ». Empty = « inconnu » on the screen (the board gives none of them yet).

Revision ID: 0050
Revises: 0049
Create Date: 2026-11-25

Downgrade: the columns are dropped.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0050"
down_revision = "0049"
branch_labels = None
depends_on = None

_CHANNELS = ("phone", "fax", "email", "whatsapp", "edi", "delegate")
_COLUMNS = (
    ("contact_name", sa.String()),
    ("order_channel", sa.String()),
    ("delivery_days", sa.JSON()),
    ("cutoff_time", sa.String()),
    ("lead_time_days", sa.Integer()),
    ("payment_terms", sa.String()),
    ("transport_fee", sa.Float()),
    ("free_transport_from", sa.Float()),
    ("note", sa.String()),
    ("archived_at", sa.DateTime(timezone=True)),
)


def upgrade() -> None:
    for name, kind in _COLUMNS:
        op.add_column("suppliers", sa.Column(name, kind, nullable=True))
    op.create_check_constraint(
        "ck_suppliers_order_channel", "suppliers", f"order_channel IS NULL OR order_channel IN {_CHANNELS}"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS ck_suppliers_order_channel")
    for name, _ in reversed(_COLUMNS):
        op.drop_column("suppliers", name)
