"""Store requests: drop « urgency ». The owner is no longer asked (2026-11-24); every row held « flexible ».

Revision ID: 0043
Revises: 0042
Create Date: 2026-11-25

Downgrade: the column comes back, every row « flexible ».
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0043"
down_revision = "0042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("store_website_requests", "urgency")


def downgrade() -> None:
    op.add_column(
        "store_website_requests",
        sa.Column("urgency", sa.String(), nullable=False, server_default="flexible"),
    )
