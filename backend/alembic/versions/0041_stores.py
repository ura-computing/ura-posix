"""Online stores: `stores` (domain, secret key hash, shown categories), `store_products` (hidden / promo price),
`store_packs` + `store_pack_items` (several products at one price)

Revision ID: 0041
Revises: 0040
Create Date: 2026-11-23

- One store per pharmacy, made with its request (the existing requests get theirs here).
- The owner changes products, promos, packs, categories at any time, the site live too.

Downgrade: drops the 4 tables.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0041"
down_revision = "0040"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if sa.inspect(op.get_bind()).has_table("stores"):
        return
    op.create_table(
        "stores",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "pharmacy_id", sa.Integer(), sa.ForeignKey("pharmacies.id", ondelete="CASCADE"), nullable=False, unique=True
        ),
        sa.Column(
            "request_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("store_website_requests.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("domain", sa.String(), nullable=True),
        sa.Column("key_hash", sa.String(), nullable=True, unique=True),
        sa.Column("key_created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("shown_categories", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "store_products",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("store_id", sa.Integer(), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("medicament_id", sa.Integer(), sa.ForeignKey("medicaments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("hidden", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("promo_price", sa.Float(), nullable=True),
        sa.UniqueConstraint("store_id", "medicament_id", name="uq_store_products"),
    )
    op.create_table(
        "store_packs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("store_id", sa.Integer(), sa.ForeignKey("stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("hidden", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_table(
        "store_pack_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pack_id", sa.Integer(), sa.ForeignKey("store_packs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("medicament_id", sa.Integer(), sa.ForeignKey("medicaments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
    )
    # The requests already sent get their store (one per pharmacy: its newest request).
    op.execute(
        "INSERT INTO stores (pharmacy_id, request_id) "
        "SELECT DISTINCT ON (pharmacy_id) pharmacy_id, id FROM store_website_requests ORDER BY pharmacy_id, created_at DESC"
    )


def downgrade() -> None:
    for table in ("store_pack_items", "store_packs", "store_products", "stores"):
        op.drop_table(table)
