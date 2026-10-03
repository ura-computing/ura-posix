"""create store_website_requests + store_customizations

Revision ID: 0017
Revises: 0016
Create Date: 2026-06-27

Two tables backing "Ma boutique en ligne":

- store_website_requests — the owner's landing-page brief and lifecycle
  state. UUID PK so preview URLs aren't guessable.
- store_customizations — 1:1 with a request, the developer-authored
  styling state. Split from the request so the owner never accidentally
  sees the dev's WIP palette.

Constraint: partial unique index guarantees one active (non-cloturee)
request per pharmacy. Owners with a closed prior request can open a
fresh one.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "store_website_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("pharmacy_id", sa.Integer(), sa.ForeignKey("pharmacies.id"), nullable=False),
        sa.Column("owner_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("store_name", sa.String(), nullable=False),
        sa.Column("slogan", sa.String(), nullable=True),
        sa.Column("brand_palette", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("phone", sa.String(), nullable=False),
        sa.Column("custom_domain", sa.String(), nullable=True),
        sa.Column("urgency", sa.String(), nullable=False),
        sa.Column("vision", sa.String(), nullable=True),
        sa.Column("state", sa.String(), nullable=False, server_default="soumise"),
        sa.Column("claimed_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_store_website_requests_pharmacy_id", "store_website_requests", ["pharmacy_id"])
    op.create_index("ix_store_website_requests_owner_id", "store_website_requests", ["owner_id"])
    op.create_index("ix_store_website_requests_state", "store_website_requests", ["state"])
    op.create_index("ix_store_website_requests_claimed_by", "store_website_requests", ["claimed_by_id"])
    # One active (non-closed) request per pharmacy. A closed prior request
    # is fine — owner can spin up a fresh one when they want a redesign.
    op.create_index(
        "uq_one_active_request_per_pharmacy",
        "store_website_requests",
        ["pharmacy_id"],
        unique=True,
        postgresql_where=sa.text("state <> 'cloturee'"),
    )

    op.create_table(
        "store_customizations",
        sa.Column(
            "request_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("store_website_requests.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("template", sa.String(), nullable=False, server_default="lumiere"),
        sa.Column("sections", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("brand_colors", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("logo_url", sa.String(), nullable=True),
        sa.Column("font_pairing", sa.String(), nullable=False, server_default="moderne"),
        sa.Column("featured_category_ids", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("store_customizations")
    op.drop_index("uq_one_active_request_per_pharmacy", table_name="store_website_requests")
    op.drop_index("ix_store_website_requests_claimed_by", table_name="store_website_requests")
    op.drop_index("ix_store_website_requests_state", table_name="store_website_requests")
    op.drop_index("ix_store_website_requests_owner_id", table_name="store_website_requests")
    op.drop_index("ix_store_website_requests_pharmacy_id", table_name="store_website_requests")
    op.drop_table("store_website_requests")
