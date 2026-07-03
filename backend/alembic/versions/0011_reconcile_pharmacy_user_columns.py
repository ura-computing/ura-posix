"""reconcile pharmacy + user columns (apcm-pharma legacy gaps)

Revision ID: 0011
Revises: 0010
Create Date: 2026-06-23

Some apcm-pharma deployments never received the runtime ALTER TABLE hooks the
old main.py used to add `pharmacies.city` / `pharmacies.code` (older code
versions, alternative bootstrap paths). The current refactor models expect
those columns, plus address/phone/email on pharmacies and reset_token/
reset_token_expires on users.

This migration reconciles the shape. Every add_column is guarded by
Inspector.has_column so it's idempotent against:
  - the apcm-pharma DBs that DID get the runtime ALTERs (no-op)
  - the apcm-pharma DBs that DIDN'T (adds the missing columns)
  - fresh refactor DBs that took the create_all+stamp path (no-op — columns
    already exist on the model-shaped table)
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


_PHARMACY_COLS = (
    ("city",    sa.Column("city",    sa.String(), nullable=True)),
    ("code",    sa.Column("code",    sa.String(), nullable=True)),
    ("address", sa.Column("address", sa.String(), nullable=True)),
    ("phone",   sa.Column("phone",   sa.String(), nullable=True)),
    ("email",   sa.Column("email",   sa.String(), nullable=True)),
)

_USER_COLS = (
    ("reset_token",         sa.Column("reset_token",         sa.String(), nullable=True)),
    ("reset_token_expires", sa.Column("reset_token_expires", sa.DateTime(timezone=True), nullable=True)),
)


def _has(insp: sa.Inspector, table: str, col: str) -> bool:
    return any(c["name"] == col for c in insp.get_columns(table))


def _has_index(insp: sa.Inspector, table: str, name: str) -> bool:
    return any(i["name"] == name for i in insp.get_indexes(table))


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())

    for name, col in _PHARMACY_COLS:
        if not _has(insp, "pharmacies", name):
            op.add_column("pharmacies", col)

    # Unique index on pharmacies.code — matches the model's unique=True.
    if not _has_index(insp, "pharmacies", "ix_pharmacies_code"):
        op.create_index("ix_pharmacies_code", "pharmacies", ["code"], unique=True)

    for name, col in _USER_COLS:
        if not _has(insp, "users", name):
            op.add_column("users", col)


def downgrade() -> None:
    # Best-effort reversal. Drop everything we might have added. Safe to
    # call on any DB shape because alembic doesn't enforce schema match.
    op.drop_index("ix_pharmacies_code", table_name="pharmacies")
    for name, _ in _USER_COLS:
        op.drop_column("users", name)
    for name, _ in _PHARMACY_COLS:
        op.drop_column("pharmacies", name)
