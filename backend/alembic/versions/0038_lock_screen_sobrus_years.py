"""Lock screen (users.lock_*, sessions.locked_at), Sobrus email set once (pharmacies.sobrus_email), Sobrus years
already imported (sobrus_imported_years, sobrus_runs.force_reimport)

Revision ID: 0038
Revises: 0037
Create Date: 2026-11-12

- Lock screen: after `lock_seconds` idle the session is locked (`sessions.locked_at`: every call answers 423) until the
  user's 6-digit code (`users.lock_pin_hash`) is typed. Off by default.
- `pharmacies.sobrus_email`: the first Sobrus account connected stays the pharmacy's (filled from today's connections).
- `sobrus_imported_years`: past years the robot imported in full, skipped by the next imports.

Downgrade: drops the table and the columns.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0038"
down_revision = "0037"
branch_labels = None
depends_on = None


def _add_missing(table: str, columns: tuple[sa.Column, ...]) -> None:
    have = {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}
    for column in columns:
        if column.name not in have:
            op.add_column(table, column)


def upgrade() -> None:
    _add_missing(
        "users",
        (
            sa.Column("lock_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("lock_seconds", sa.Integer(), nullable=False, server_default="300"),
            sa.Column("lock_pin_hash", sa.String(), nullable=True),
            sa.Column("lock_failed", sa.Integer(), nullable=False, server_default="0"),
        ),
    )
    _add_missing("sessions", (sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True),))
    _add_missing("pharmacies", (sa.Column("sobrus_email", sa.String(), nullable=True),))
    _add_missing("sobrus_runs", (sa.Column("force_reimport", sa.Boolean(), nullable=False, server_default=sa.false()),))
    op.execute(
        "UPDATE pharmacies p SET sobrus_email = c.email FROM sobrus_connections c "
        "WHERE c.pharmacy_id = p.id AND p.sobrus_email IS NULL"
    )
    if not sa.inspect(op.get_bind()).has_table("sobrus_imported_years"):
        op.create_table(
            "sobrus_imported_years",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("pharmacy_id", sa.Integer(), sa.ForeignKey("pharmacies.id", ondelete="CASCADE"), nullable=False),
            sa.Column("kind", sa.String(), nullable=False),
            sa.Column("year", sa.Integer(), nullable=False),
            sa.Column("batch_id", sa.Integer(), sa.ForeignKey("import_batches.id", ondelete="SET NULL"), nullable=True),
            sa.Column("imported_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("pharmacy_id", "kind", "year", name="uq_sobrus_imported_years"),
        )


def downgrade() -> None:
    op.drop_table("sobrus_imported_years")
    op.drop_column("sobrus_runs", "force_reimport")
    op.drop_column("pharmacies", "sobrus_email")
    op.drop_column("sessions", "locked_at")
    for name in ("lock_failed", "lock_pin_hash", "lock_seconds", "lock_enabled"):
        op.drop_column("users", name)
