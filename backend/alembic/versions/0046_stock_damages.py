"""« Stock abîmé »: boxes declared damaged (`stock_damages`) + the feature `damaged`, ON for every pharmacy / user.

Revision ID: 0046
Revises: 0045
Create Date: 2026-11-25

Like every non-premium feature, a new pharmacy / user gets it ON (ALLOWED_FEATURES); this turns it ON for the
existing ones too (same as 0033). Downgrade: the table, the switches and the feature are dropped.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0046"
down_revision = "0045"
branch_labels = None
depends_on = None

_FEATURES_OLD = (
    "rapports",
    "import",
    "achats",
    "ventes",
    "stock",
    "analyse",
    "accounting",
    "alertes",
    "special_products",
    "produits",
    "sobrus",
    "labels",
    "orders",
)
_FEATURES_NEW = (*_FEATURES_OLD, "damaged")


def _set_checks(features: tuple[str, ...]) -> None:
    # IF EXISTS: a DB built by `create_all` may not have the named constraints (see 0016).
    op.execute("ALTER TABLE pharmacy_features DROP CONSTRAINT IF EXISTS ck_pharmacy_features_feature")
    op.create_check_constraint("ck_pharmacy_features_feature", "pharmacy_features", f"feature IN {features}")
    op.execute("ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS ck_user_permissions_permission")
    op.create_check_constraint("ck_user_permissions_permission", "user_permissions", f"permission IN {features}")


def upgrade() -> None:
    op.create_table(
        "stock_damages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pharmacy_id", sa.Integer(), sa.ForeignKey("pharmacies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("medicament_id", sa.Integer(), sa.ForeignKey("medicaments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("note", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_by_name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("quantity > 0", name="ck_stock_damages_quantity"),
        sa.CheckConstraint(
            "status IN ('pending', 'returned', 'destroyed', 'back_on_sale')", name="ck_stock_damages_status"
        ),
    )
    op.create_index("ix_stock_damages_pharmacy_medicament", "stock_damages", ["pharmacy_id", "medicament_id"])
    _set_checks(_FEATURES_NEW)
    op.execute("""
        INSERT INTO pharmacy_features (pharmacy_id, feature, enabled)
        SELECT p.id, 'damaged', TRUE FROM pharmacies p
        WHERE NOT EXISTS (SELECT 1 FROM pharmacy_features pf WHERE pf.pharmacy_id = p.id AND pf.feature = 'damaged')
    """)
    op.execute("""
        INSERT INTO user_permissions (user_id, permission, enabled)
        SELECT u.id, 'damaged', TRUE FROM users u
        WHERE u.role IN ('owner', 'employee')
          AND NOT EXISTS (SELECT 1 FROM user_permissions up WHERE up.user_id = u.id AND up.permission = 'damaged')
    """)


def downgrade() -> None:
    op.execute("DELETE FROM pharmacy_features WHERE feature = 'damaged'")
    op.execute("DELETE FROM user_permissions WHERE permission = 'damaged'")
    _set_checks(_FEATURES_OLD)
    op.drop_table("stock_damages")
