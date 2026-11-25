"""Orders passed by the admin (D-9): the pharmacy sends its validated order to the admin, who places it with the
supplier (« Passée »), then « Livrée » — or « Annulée » with a reason.

Revision ID: 0054
Revises: 0053
Create Date: 2026-11-25

Downgrade: the columns are dropped.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0054"
down_revision = "0053"
branch_labels = None
depends_on = None

_COLUMNS = (
    ("sent_at", sa.DateTime(timezone=True)),
    ("delivered_at", sa.DateTime(timezone=True)),
    ("cancel_reason", sa.String()),
    ("handled_by_name", sa.String()),
)


def upgrade() -> None:
    for name, kind in _COLUMNS:
        op.add_column("purchase_orders", sa.Column(name, kind, nullable=True))


def downgrade() -> None:
    for name, _ in reversed(_COLUMNS):
        op.drop_column("purchase_orders", name)
