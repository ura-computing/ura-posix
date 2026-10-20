"""product_notes (« Observations ») + audit_logs (« Historique des modifications »)

Revision ID: 0029
Revises: 0028
Create Date: 2026-10-20

- `product_notes`: a pharmacy's notes on a product, shown in a window when its page opens.
- `audit_logs`: who changed what (imports, product edits, observations), kept as proof: never
  edited or deleted. The imports already made are written in it now (from `import_batches`: who,
  when, file, lines; then the deletion when the import was deleted), so the history does not
  start empty. Imports still running are left out (they log when they end).

Downgrade: drops both tables.
"""

from __future__ import annotations

import json

import sqlalchemy as sa
from alembic import op

revision = "0029"
down_revision = "0028"
branch_labels = None
depends_on = None

# import_batches.status → the action of its end.
ENDS = {"success": "import_done", "cancelled": "import_cancelled", "error": "import_failed"}


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("product_notes"):
        op.create_table(
            "product_notes",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("pharmacy_id", sa.Integer(), sa.ForeignKey("pharmacies.id", ondelete="CASCADE"), nullable=False),
            sa.Column(
                "medicament_id", sa.Integer(), sa.ForeignKey("medicaments.id", ondelete="CASCADE"), nullable=False
            ),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("author_name", sa.String(), nullable=False),
            sa.Column("text", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_product_notes_pharmacy_id", "product_notes", ["pharmacy_id"])
        op.create_index("ix_product_notes_medicament_id", "product_notes", ["medicament_id"])
    if inspector.has_table("audit_logs"):
        return
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pharmacy_id", sa.Integer(), sa.ForeignKey("pharmacies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("user_name", sa.String(), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("medicament_id", sa.Integer(), sa.ForeignKey("medicaments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_audit_logs_pharmacy_created", "audit_logs", ["pharmacy_id", "created_at"])
    op.create_index("ix_audit_logs_medicament_id", "audit_logs", ["medicament_id"])

    bind = op.get_bind()
    batches = bind.execute(
        sa.text(
            "SELECT b.id, b.pharmacy_id, b.file_type, b.filename, b.rows_inserted, b.rows_skipped, b.status, "
            "b.error_message, COALESCE(b.last_chunk_at, b.imported_at), b.created_by_user_id, "
            "COALESCE(c.name, c.email, ''), b.deleted_at, b.deleted_by_user_id, COALESCE(d.name, d.email, '') "
            "FROM import_batches b "
            "LEFT JOIN users c ON c.id = b.created_by_user_id "
            "LEFT JOIN users d ON d.id = b.deleted_by_user_id "
            "ORDER BY b.id"
        )
    ).all()
    insert = sa.text(
        "INSERT INTO audit_logs (pharmacy_id, user_id, user_name, action, details, created_at) "
        "VALUES (:pharmacy, :user, :name, :action, CAST(:details AS JSON), :at)"
    )
    for (
        batch_id,
        pharmacy,
        kind,
        file,
        inserted,
        skipped,
        status,
        error,
        ended,
        by,
        by_name,
        deleted,
        del_by,
        del_name,
    ) in batches:
        action = ENDS.get(status)
        if action:
            details = {"batch_id": batch_id, "type": kind, "file": file, "imported": inserted, "skipped": skipped}
            if action == "import_failed":
                details["error"] = error
            bind.execute(
                insert,
                {
                    "pharmacy": pharmacy,
                    "user": by,
                    "name": by_name,
                    "action": action,
                    "details": json.dumps(details),
                    "at": ended,
                },
            )
        if deleted is not None:
            bind.execute(
                insert,
                {
                    "pharmacy": pharmacy,
                    "user": del_by,
                    "name": del_name,
                    "action": "import_deleted",
                    "details": json.dumps({"batch_id": batch_id, "type": kind, "file": file}),
                    "at": deleted,
                },
            )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("product_notes")
