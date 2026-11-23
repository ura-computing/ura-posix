"""Support role (users.role « developer » → « support »), store logo kept in the database

Revision ID: 0039
Revises: 0038
Create Date: 2026-11-23

- Support = the admin's helpers, same rights as the admin. The old « developer » accounts become « support ».
- `store_customizations.logo_data` / `logo_type`: the logo a Support person uploads for a pharmacy's online store.
  Kept in the database: a server's disk is wiped at each deploy, and every service must read it.

Downgrade: « support » → « developer », drops the two columns.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0039"
down_revision = "0038"
branch_labels = None
depends_on = None


def _add_missing(table: str, columns: tuple[sa.Column, ...]) -> None:
    have = {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}
    for column in columns:
        if column.name not in have:
            op.add_column(table, column)


def upgrade() -> None:
    op.execute("UPDATE users SET role = 'support' WHERE role = 'developer'")
    _add_missing(
        "store_customizations",
        (sa.Column("logo_data", sa.LargeBinary(), nullable=True), sa.Column("logo_type", sa.String(), nullable=True)),
    )
    # Logos of the old disk store are gone: their URL would answer 404.
    op.execute("UPDATE store_customizations SET logo_url = NULL WHERE logo_data IS NULL")


def downgrade() -> None:
    op.drop_column("store_customizations", "logo_type")
    op.drop_column("store_customizations", "logo_data")
    op.execute("UPDATE users SET role = 'developer' WHERE role = 'support'")
