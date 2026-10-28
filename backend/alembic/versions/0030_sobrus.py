"""sobrus_connections + sobrus_runs (« Connexion Sobrus »: the robot imports achats + ventes)

Revision ID: 0030
Revises: 0029
Create Date: 2026-10-28

- `sobrus_connections`: one per pharmacy, the owner's Sobrus login (password + session encrypted).
- `sobrus_runs`: each robot run and its live progress; one queued / running run per pharmacy.

Downgrade: drops both tables.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0030"
down_revision = "0029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("sobrus_connections"):
        op.create_table(
            "sobrus_connections",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column(
                "pharmacy_id",
                sa.Integer(),
                sa.ForeignKey("pharmacies.id", ondelete="CASCADE"),
                nullable=False,
                unique=True,
            ),
            sa.Column("email", sa.String(), nullable=False),
            sa.Column("password_enc", sa.String(), nullable=False),
            sa.Column("session_enc", sa.String(), nullable=True),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("consent_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("last_success_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_error_code", sa.String(), nullable=True),
            sa.Column("problem_notified_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("failed_nights", sa.Integer(), nullable=False, server_default="0"),
            sa.CheckConstraint("status IN ('active', 'needs_login', 'invalid')", name="ck_sobrus_connections_status"),
        )
    if not inspector.has_table("sobrus_runs"):
        op.create_table(
            "sobrus_runs",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("pharmacy_id", sa.Integer(), sa.ForeignKey("pharmacies.id", ondelete="CASCADE"), nullable=False),
            sa.Column("mode", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("cancel_requested", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("phase", sa.String(), nullable=True),
            sa.Column("kind", sa.String(), nullable=True),
            sa.Column("year", sa.Integer(), nullable=True),
            sa.Column("bytes_received", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("chunk_current", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("chunk_total", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("lines_added", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("events", sa.JSON(), nullable=False),
            sa.Column("error_code", sa.String(), nullable=True),
            sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
            sa.CheckConstraint("mode IN ('full', 'new', 'check')", name="ck_sobrus_runs_mode"),
            sa.CheckConstraint(
                "status IN ('queued', 'running', 'success', 'error', 'cancelled')", name="ck_sobrus_runs_status"
            ),
        )
        op.create_index(
            "uq_sobrus_runs_active",
            "sobrus_runs",
            ["pharmacy_id"],
            unique=True,
            postgresql_where=sa.text("status IN ('queued', 'running')"),
        )
        op.create_index("ix_sobrus_runs_pharmacy_created", "sobrus_runs", ["pharmacy_id", "created_at"])


def downgrade() -> None:
    op.drop_table("sobrus_runs")
    op.drop_table("sobrus_connections")
