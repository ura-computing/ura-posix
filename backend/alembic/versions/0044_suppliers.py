"""« Fournisseurs »: one supplier list shared by every pharmacy, filled from Sobrus (sobrus_runs mode `suppliers`).

Revision ID: 0044
Revises: 0043
Create Date: 2026-11-25

Downgrade: the table is dropped, the `suppliers` runs deleted.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0044"
down_revision = "0043"
branch_labels = None
depends_on = None


def _set_mode_check(modes: tuple[str, ...]) -> None:
    # IF EXISTS: a DB built by `create_all` may not have the named constraint (see 0016).
    op.execute("ALTER TABLE sobrus_runs DROP CONSTRAINT IF EXISTS ck_sobrus_runs_mode")
    op.create_check_constraint("ck_sobrus_runs_mode", "sobrus_runs", f"mode IN {modes}")


def upgrade() -> None:
    op.create_table(
        "suppliers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("name_key", sa.String(), nullable=False, unique=True),
        sa.Column("kind", sa.String(), nullable=True),
        sa.Column("sobrus_id", sa.String(), nullable=True),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("email", sa.String(), nullable=True),
        sa.Column("address", sa.String(), nullable=True),
        sa.Column("city", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("kind IS NULL OR kind IN ('laboratoire', 'grossiste', 'societe')", name="ck_suppliers_kind"),
    )
    _set_mode_check(("full", "new", "check", "range", "products", "suppliers"))


def downgrade() -> None:
    op.execute("DELETE FROM sobrus_runs WHERE mode = 'suppliers'")
    _set_mode_check(("full", "new", "check", "range", "products"))
    op.drop_table("suppliers")
