"""pharmacy_stock.import_batch_id: deleting a stock import removes the stock it wrote

Revision ID: 0026
Revises: 0025
Create Date: 2026-10-07

Before: deleting (or cancelling) a stock import kept its rows, so a deleted file's
products stayed in Stock, Produits, Péremptions. Now each row remembers the stock import
that wrote it last. Existing rows: the pharmacy's latest stock import still in place
(the stock shown today came from it); none → NULL.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "import_batch_id" in {c["name"] for c in sa.inspect(op.get_bind()).get_columns("pharmacy_stock")}:
        return
    op.add_column(
        "pharmacy_stock",
        sa.Column(
            "import_batch_id",
            sa.Integer(),
            sa.ForeignKey("import_batches.id", name="pharmacy_stock_import_batch_id_fkey", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_pharmacy_stock_import_batch_id", "pharmacy_stock", ["import_batch_id"])
    op.execute(
        sa.text("""
        UPDATE pharmacy_stock s
        SET    import_batch_id = (
            SELECT b.id FROM import_batches b
            WHERE  b.pharmacy_id = s.pharmacy_id AND b.file_type = 'stock'
              AND  b.status = 'success' AND b.deleted_at IS NULL
            ORDER  BY b.imported_at DESC, b.id DESC
            LIMIT  1
        )
    """)
    )


def downgrade() -> None:
    op.drop_index("ix_pharmacy_stock_import_batch_id", table_name="pharmacy_stock")
    op.drop_column("pharmacy_stock", "import_batch_id")
