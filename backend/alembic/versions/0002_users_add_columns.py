"""users_add_columns

Adds token_version, version, last_login_at, created_by to users.

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-20

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002"
down_revision: Union[str, Sequence[str], None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("version", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("created_by", sa.Integer(), nullable=True))
    op.create_foreign_key("users_created_by_fkey", "users", "users", ["created_by"], ["id"], ondelete="SET NULL")


def downgrade() -> None:
    op.drop_constraint("users_created_by_fkey", "users", type_="foreignkey")
    op.drop_column("users", "created_by")
    op.drop_column("users", "last_login_at")
    op.drop_column("users", "version")
    op.drop_column("users", "token_version")
