"""Sobrus « Clôture de caisse » (sobrus_cash_closings + sobrus_connections.closing_access) and the admin's
« Produits Sobrus » (sobrus_runs mode `products`, medicaments.dci / galenic_form)

Revision ID: 0036
Revises: 0035
Create Date: 2026-11-06

Every run of the robot (but `check` / `products`) also reads Sobrus' cash desk closing report, one row per day
(Comptabilité, read-only). Only the owner's Sobrus login may read it: `closing_access` = False shows why it is empty.
Mode `products`: the admin fetches a connected pharmacy's Sobrus products into the catalogue (new PID added, empty
fields filled); Sobrus also gives the DCI and the galenic form, kept on the medicament.

Downgrade: removes the `products` runs, the closings and the 3 columns.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0036"
down_revision = "0035"
branch_labels = None
depends_on = None


def _set_mode_check(modes: tuple[str, ...]) -> None:
    # IF EXISTS: a DB built by `create_all` may not have the named constraint (see 0016).
    op.execute("ALTER TABLE sobrus_runs DROP CONSTRAINT IF EXISTS ck_sobrus_runs_mode")
    op.create_check_constraint("ck_sobrus_runs_mode", "sobrus_runs", f"mode IN {modes}")


def _add_missing(table: str, columns: tuple[tuple[str, sa.types.TypeEngine], ...]) -> None:
    have = {c["name"] for c in sa.inspect(op.get_bind()).get_columns(table)}
    for name, kind in columns:
        if name not in have:
            op.add_column(table, sa.Column(name, kind, nullable=True))


def upgrade() -> None:
    _set_mode_check(("full", "new", "check", "range", "products"))
    _add_missing("medicaments", (("dci", sa.String()), ("galenic_form", sa.String())))
    _add_missing("sobrus_connections", (("closing_access", sa.Boolean()),))
    if not sa.inspect(op.get_bind()).has_table("sobrus_cash_closings"):
        money = [
            sa.Column(name, sa.Float(), nullable=False, server_default="0")
            for name in (
                "total",
                "paid",
                "unpaid",
                "discount",
                "cash_sales",
                "credit_sales",
                "unpaid_credit",
                "returns",
                "net",
                "gross_total",
            )
        ]
        op.create_table(
            "sobrus_cash_closings",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("pharmacy_id", sa.Integer(), sa.ForeignKey("pharmacies.id", ondelete="CASCADE"), nullable=False),
            sa.Column("day", sa.Date(), nullable=False),
            sa.Column("invoices", sa.Integer(), nullable=False, server_default="0"),
            *money,
            sa.Column("by_method", sa.JSON(), nullable=False),
            sa.Column("by_customer", sa.JSON(), nullable=False),
            sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("pharmacy_id", "day", name="uq_sobrus_cash_closings_pharmacy_day"),
        )


def downgrade() -> None:
    op.drop_table("sobrus_cash_closings")
    op.drop_column("sobrus_connections", "closing_access")
    op.drop_column("medicaments", "galenic_form")
    op.drop_column("medicaments", "dci")
    op.execute("DELETE FROM sobrus_runs WHERE mode = 'products'")
    _set_mode_check(("full", "new", "check", "range"))
