"""create_user_permissions

User-level permission flags (normalizes users.permissions JSON).
Backfills from existing JSON (no-op when permissions is empty / null).

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-20

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0005"
down_revision: Union[str, Sequence[str], None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ALLOWED_PERMISSIONS = (
    "rapports",
    "import",
    "achats",
    "ventes",
    "stock",
    "analyse",
    "accounting",
    "bl_exclusions",
)


def upgrade() -> None:
    op.create_table(
        "user_permissions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("permission", sa.String(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.CheckConstraint(f"permission IN {ALLOWED_PERMISSIONS}", name="ck_user_permissions_permission"),
        sa.UniqueConstraint("user_id", "permission", name="uq_user_permissions_user_permission"),
    )
    op.create_index("ix_user_permissions_user_id", "user_permissions", ["user_id"])

    op.execute("""
        INSERT INTO user_permissions (user_id, permission, enabled)
        SELECT u.id, kv.key, COALESCE((kv.value)::boolean, false)
        FROM users u, LATERAL json_each_text(u.permissions) AS kv
        WHERE u.permissions IS NOT NULL
          AND kv.key IN ('rapports','import','achats','ventes','stock','analyse','accounting','bl_exclusions')
    """)


def downgrade() -> None:
    op.drop_index("ix_user_permissions_user_id", "user_permissions")
    op.drop_table("user_permissions")
