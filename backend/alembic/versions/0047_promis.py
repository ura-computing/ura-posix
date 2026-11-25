"""« Promis »: customers, promis, their lines and steps + the feature `promis`, ON for every pharmacy / user.

Revision ID: 0047
Revises: 0046
Create Date: 2026-11-25

Downgrade: the 4 tables, the switches and the feature are dropped.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0047"
down_revision = "0046"
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
    "damaged",
)
_FEATURES_NEW = (*_FEATURES_OLD, "promis")
_STATES = (
    "created",
    "to_order",
    "ordered",
    "received",
    "incident",
    "ready",
    "picked_up",
    "expired",
    "returned",
    "cancelled",
)


def _set_checks(features: tuple[str, ...]) -> None:
    # IF EXISTS: a DB built by `create_all` may not have the named constraints (see 0016).
    op.execute("ALTER TABLE pharmacy_features DROP CONSTRAINT IF EXISTS ck_pharmacy_features_feature")
    op.create_check_constraint("ck_pharmacy_features_feature", "pharmacy_features", f"feature IN {features}")
    op.execute("ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS ck_user_permissions_permission")
    op.create_check_constraint("ck_user_permissions_permission", "user_permissions", f"permission IN {features}")


def upgrade() -> None:
    now = sa.func.now()
    op.create_table(
        "customers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pharmacy_id", sa.Integer(), sa.ForeignKey("pharmacies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("phone", sa.String(), nullable=True),
        sa.Column("whatsapp_ok", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("note", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=now),
    )
    op.create_index("ix_customers_pharmacy_name", "customers", ["pharmacy_id", "name"])
    op.create_table(
        "promis",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pharmacy_id", sa.Integer(), sa.ForeignKey("pharmacies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("state", sa.String(), nullable=False, server_default="created"),
        sa.Column("unreachable", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("note", sa.String(), nullable=True),
        sa.Column("ready_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("pickup_deadline", sa.Date(), nullable=True),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_by_name", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=now),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("pharmacy_id", "number", name="uq_promis_pharmacy_number"),
        sa.CheckConstraint(f"state IN {_STATES}", name="ck_promis_state"),
    )
    op.create_index("ix_promis_pharmacy_state", "promis", ["pharmacy_id", "state"])
    op.create_table(
        "promis_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("promis_id", sa.Integer(), sa.ForeignKey("promis.id", ondelete="CASCADE"), nullable=False),
        sa.Column("medicament_id", sa.Integer(), sa.ForeignKey("medicaments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("reserved_qty", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("shelf_place", sa.String(), nullable=True),
        sa.Column("unit_price", sa.Float(), nullable=True),
        sa.Column("counter_discount", sa.Float(), nullable=False, server_default="0"),
        sa.CheckConstraint("quantity > 0", name="ck_promis_lines_quantity"),
    )
    op.create_index("ix_promis_lines_medicament", "promis_lines", ["medicament_id"])
    op.create_table(
        "promis_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("promis_id", sa.Integer(), sa.ForeignKey("promis.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_state", sa.String(), nullable=True),
        sa.Column("to_state", sa.String(), nullable=False),
        sa.Column("actor_name", sa.String(), nullable=False),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("at", sa.DateTime(timezone=True), nullable=False, server_default=now),
    )
    op.create_index("ix_promis_events_promis_id", "promis_events", ["promis_id"])
    _set_checks(_FEATURES_NEW)
    op.execute("""
        INSERT INTO pharmacy_features (pharmacy_id, feature, enabled)
        SELECT p.id, 'promis', TRUE FROM pharmacies p
        WHERE NOT EXISTS (SELECT 1 FROM pharmacy_features pf WHERE pf.pharmacy_id = p.id AND pf.feature = 'promis')
    """)
    op.execute("""
        INSERT INTO user_permissions (user_id, permission, enabled)
        SELECT u.id, 'promis', TRUE FROM users u
        WHERE u.role IN ('owner', 'employee')
          AND NOT EXISTS (SELECT 1 FROM user_permissions up WHERE up.user_id = u.id AND up.permission = 'promis')
    """)


def downgrade() -> None:
    op.execute("DELETE FROM pharmacy_features WHERE feature = 'promis'")
    op.execute("DELETE FROM user_permissions WHERE permission = 'promis'")
    _set_checks(_FEATURES_OLD)
    for table in ("promis_events", "promis_lines", "promis", "customers"):
        op.drop_table(table)
