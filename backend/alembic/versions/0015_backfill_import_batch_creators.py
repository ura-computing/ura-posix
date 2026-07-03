"""backfill `created_by_user_id` on pre-migration import_batches

Revision ID: 0015
Revises: 0014
Create Date: 2026-06-24

Migration 0014 added `created_by_user_id` as nullable so existing rows could
sit at NULL. The owner-scope filter in `/v1/data/imports` accepts NULL as
"pharmacy-orphan legacy batch" so those rows still surface, but the
"Importé par" column displays "—" — ugly for any pharmacy that had imports
before 0014 shipped.

This migration backfills the column for pharmacies where the attribution is
UNAMBIGUOUS — exactly one active owner. For pharmacies with 0 active owners
(orphan state) or 2+ active owners (we can't pick), rows stay NULL and keep
showing "—".

The set-based UPDATE+FROM is idempotent: rerunning it does nothing because the
WHERE clause excludes already-populated rows.

Downgrade is a no-op — once a NULL has been replaced with an owner id, we have
no record of which rows were originally NULL.
"""
from __future__ import annotations

from alembic import op
from sqlalchemy import text


revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # NOTE: per-pharmacy owner candidates live in `users`, not in the
    # `import_batches` JOIN — pulling them in a separate subquery avoids
    # multiplying the count by the batch-row fan-out (which would otherwise
    # make `COUNT(u.id) = 1` impossible for any pharmacy with > 1 NULL batch).
    op.get_bind().execute(text("""
        UPDATE import_batches
        SET    created_by_user_id = sub.owner_id
        FROM (
            SELECT pharmacy_id, MIN(id) AS owner_id
            FROM   users
            WHERE  role = 'owner' AND status = 'active'
            GROUP  BY pharmacy_id
            HAVING COUNT(*) = 1
        ) sub
        WHERE  import_batches.pharmacy_id = sub.pharmacy_id
          AND  import_batches.created_by_user_id IS NULL
    """))


def downgrade() -> None:
    # Lossy: can't tell which rows we filled vs. which were always set.
    pass
