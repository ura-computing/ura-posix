"""track import-batch creator + soft-delete columns

Revision ID: 0014
Revises: 0013
Create Date: 2026-06-24

Adds three nullable columns to `import_batches`:
  - created_by_user_id  → who did the import (FK users.id, ON DELETE SET NULL)
  - deleted_at          → when it was soft-deleted (NULL = active)
  - deleted_by_user_id  → who soft-deleted it (FK users.id, ON DELETE SET NULL)

Per-role list scoping + delete authz filter on `created_by_user_id`, so it gets
an index.

Pre-migration rows backfill to NULL — frontend renders "—" for them.
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())
    existing = {c["name"] for c in insp.get_columns("import_batches")}

    if "created_by_user_id" not in existing:
        op.add_column(
            "import_batches",
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        )
        op.create_foreign_key(
            "fk_import_batches_created_by_user_id_users",
            "import_batches", "users",
            ["created_by_user_id"], ["id"],
            ondelete="SET NULL",
        )
        op.create_index(
            "ix_import_batches_created_by_user_id",
            "import_batches", ["created_by_user_id"],
        )

    if "deleted_at" not in existing:
        op.add_column(
            "import_batches",
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        )

    if "deleted_by_user_id" not in existing:
        op.add_column(
            "import_batches",
            sa.Column("deleted_by_user_id", sa.Integer(), nullable=True),
        )
        op.create_foreign_key(
            "fk_import_batches_deleted_by_user_id_users",
            "import_batches", "users",
            ["deleted_by_user_id"], ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    op.drop_constraint("fk_import_batches_deleted_by_user_id_users", "import_batches", type_="foreignkey")
    op.drop_column("import_batches", "deleted_by_user_id")
    op.drop_column("import_batches", "deleted_at")
    op.drop_index("ix_import_batches_created_by_user_id", table_name="import_batches")
    op.drop_constraint("fk_import_batches_created_by_user_id_users", "import_batches", type_="foreignkey")
    op.drop_column("import_batches", "created_by_user_id")
