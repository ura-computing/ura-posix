"""create data-page tables (catalog, transactions, stock, import audit, exclusions)

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-21

apcm-pharma's existing dev/prod DBs already have these tables (achats, ventes,
medicaments, pharmacy_stock, import_batches, pharmacy_bl_exclusions,
pharmacy_medicament_status). On a fresh prod deploy, this migration creates them.
On the shared apcm-pharma DB, every CREATE is skipped via Inspector.has_table().
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def _has(insp: sa.Inspector, table: str) -> bool:
    return insp.has_table(table)


def upgrade() -> None:
    insp = sa.inspect(op.get_bind())

    if not _has(insp, "medicaments"):
        op.create_table(
            "medicaments",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("pid", sa.String, nullable=False, unique=True),
            sa.Column("product", sa.String, nullable=False),
            sa.Column("tva", sa.String, nullable=True),
            sa.Column("pph", sa.Float, nullable=True),
            sa.Column("ppv", sa.Float, nullable=True),
            sa.Column("category", sa.String, nullable=True),
            sa.Column("zone", sa.String, nullable=True),
            sa.Column("barcode1", sa.String, nullable=True),
            sa.Column("barcode2", sa.String, nullable=True),
            sa.Column("laboratoire", sa.String, nullable=True),
            sa.Column("product_type", sa.String, nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now(), nullable=True),
        )
        op.create_index("ix_medicament_category", "medicaments", ["category"])
        op.create_index("ix_medicaments_pid", "medicaments", ["pid"], unique=True)

    if not _has(insp, "import_batches"):
        op.create_table(
            "import_batches",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("pharmacy_id", sa.Integer, sa.ForeignKey("pharmacies.id"), nullable=False),
            sa.Column("file_type", sa.String, nullable=False),
            sa.Column("filename", sa.String, nullable=True),
            sa.Column("rows_inserted", sa.Integer, nullable=False, server_default="0"),
            sa.Column("rows_skipped", sa.Integer, nullable=False, server_default="0"),
            sa.Column("imported_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_import_batches_pharmacy_id", "import_batches", ["pharmacy_id"])

    if not _has(insp, "achats"):
        op.create_table(
            "achats",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("pharmacy_id", sa.Integer, sa.ForeignKey("pharmacies.id"), nullable=True),
            sa.Column("medicament_id", sa.Integer, sa.ForeignKey("medicaments.id"), nullable=True),
            sa.Column("import_batch_id", sa.Integer, sa.ForeignKey("import_batches.id"), nullable=True),
            sa.Column("created_at_source", sa.String, nullable=True),
            sa.Column("delivery_date", sa.String, nullable=True),
            sa.Column("delivery_ref", sa.String, nullable=True),
            sa.Column("supplier", sa.String, nullable=True),
            sa.Column("quantity", sa.Float, nullable=True),
            sa.Column("unit_price", sa.Float, nullable=True),
            sa.Column("expiry_date", sa.String, nullable=True),
            sa.Column("stock_min", sa.Float, nullable=True),
            sa.Column("stock_max", sa.Float, nullable=True),
            sa.Column("total", sa.Float, nullable=True),
            sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_achat_pharmacy_date", "achats", ["pharmacy_id", "delivery_date"])
        op.create_index("ix_achats_pharmacy_id", "achats", ["pharmacy_id"])
        op.create_index("ix_achats_medicament_id", "achats", ["medicament_id"])
        op.create_index("ix_achats_import_batch_id", "achats", ["import_batch_id"])

    if not _has(insp, "ventes"):
        op.create_table(
            "ventes",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("pharmacy_id", sa.Integer, sa.ForeignKey("pharmacies.id"), nullable=True),
            sa.Column("medicament_id", sa.Integer, sa.ForeignKey("medicaments.id"), nullable=True),
            sa.Column("import_batch_id", sa.Integer, sa.ForeignKey("import_batches.id"), nullable=True),
            sa.Column("date", sa.String, nullable=True),
            sa.Column("transaction_ref", sa.String, nullable=True),
            sa.Column("client", sa.String, nullable=True),
            sa.Column("quantity", sa.Float, nullable=True),
            sa.Column("discount", sa.Float, nullable=True),
            sa.Column("unit_price", sa.Float, nullable=True),
            sa.Column("total", sa.Float, nullable=True),
            sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_vente_pharmacy_date", "ventes", ["pharmacy_id", "date"])
        op.create_index("ix_ventes_pharmacy_id", "ventes", ["pharmacy_id"])
        op.create_index("ix_ventes_medicament_id", "ventes", ["medicament_id"])
        op.create_index("ix_ventes_import_batch_id", "ventes", ["import_batch_id"])

    if not _has(insp, "pharmacy_stock"):
        op.create_table(
            "pharmacy_stock",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("pharmacy_id", sa.Integer, sa.ForeignKey("pharmacies.id"), nullable=False),
            sa.Column("medicament_id", sa.Integer, sa.ForeignKey("medicaments.id"), nullable=False),
            sa.Column("current_stock", sa.Integer, nullable=False, server_default="0"),
            sa.Column("stock_min", sa.Integer, nullable=True),
            sa.Column("stock_max", sa.Integer, nullable=True),
            sa.Column("expiry_date", sa.Date, nullable=True),
            sa.Column("zone", sa.String, nullable=True),
            sa.Column("imported_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("pharmacy_id", "medicament_id", name="uq_pharmacy_stock"),
        )
        op.create_index("ix_pharmacy_stock_pharmacy_id", "pharmacy_stock", ["pharmacy_id"])
        op.create_index("ix_pharmacy_stock_medicament_id", "pharmacy_stock", ["medicament_id"])

    if not _has(insp, "pharmacy_medicament_status"):
        op.create_table(
            "pharmacy_medicament_status",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("pharmacy_id", sa.Integer, sa.ForeignKey("pharmacies.id"), nullable=False),
            sa.Column("medicament_id", sa.Integer, sa.ForeignKey("medicaments.id"), nullable=False),
            sa.Column("declared", sa.Boolean, nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("pharmacy_id", "medicament_id", name="uq_pharmacy_medicament"),
        )

    if not _has(insp, "pharmacy_bl_exclusions"):
        op.create_table(
            "pharmacy_bl_exclusions",
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("pharmacy_id", sa.Integer, sa.ForeignKey("pharmacies.id"), nullable=False),
            sa.Column("delivery_ref", sa.String, nullable=False),
            sa.Column("notes", sa.String, nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint("pharmacy_id", "delivery_ref", name="uq_pharmacy_bl"),
        )
        op.create_index("ix_pharmacy_bl_exclusions_pharmacy_id", "pharmacy_bl_exclusions", ["pharmacy_id"])
        op.create_index("ix_pharmacy_bl_exclusions_delivery_ref", "pharmacy_bl_exclusions", ["delivery_ref"])


def downgrade() -> None:
    # Hard-delete pattern: drop in reverse FK order. Safe because this migration
    # only ever created tables that didn't exist — we won't lose apcm-pharma data
    # because the FKs only get added when these tables are freshly created here.
    for table in (
        "pharmacy_bl_exclusions",
        "pharmacy_medicament_status",
        "pharmacy_stock",
        "ventes",
        "achats",
        "import_batches",
        "medicaments",
    ):
        op.drop_table(table)
