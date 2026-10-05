"""signup_requests: « Créer un compte » waiting for the admin (T4)

Revision ID: 0023
Revises: 0022
Create Date: 2026-10-04

A pharmacist fills /auth/signup: a new pharmacy + its owner, or an owner / employee
joining a pharmacy by its code. The request waits here until the admin accepts it
(pharmacy + account created) or refuses it; nobody logs in before that.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("signup_requests"):
        return
    op.create_table(
        "signup_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("role", sa.String(), nullable=False),
        sa.Column("full_name", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("phone", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("pharmacy_code", sa.String(), nullable=True),
        sa.Column("pharmacy_name", sa.String(), nullable=True),
        sa.Column("pharmacy_city", sa.String(), nullable=True),
        sa.Column("pharmacy_address", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("decided_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.CheckConstraint("role IN ('owner', 'employee')", name="ck_signup_requests_role"),
        sa.CheckConstraint("status IN ('pending', 'accepted', 'refused')", name="ck_signup_requests_status"),
    )
    op.create_index("ix_signup_requests_email", "signup_requests", ["email"])
    op.create_index("ix_signup_requests_status", "signup_requests", ["status"])


def downgrade() -> None:
    op.drop_table("signup_requests")
