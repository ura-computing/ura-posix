"""Notification links without the role: the app now puts every page under its role (/admin/…, /support/…, /owner/…,
/employee/…), so a line keeps only the page and the bell adds the reader's role.

Revision ID: 0042
Revises: 0041
Create Date: 2026-11-24

« /admin/pharmacies?tab=demandes » → « pharmacies?tab=demandes », « /sobrus » → « sobrus ».

Downgrade: nothing (old addresses are gone from the app).
"""

from __future__ import annotations

from alembic import op

revision = "0042"
down_revision = "0041"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE notifications SET link = regexp_replace(link, '^/(admin/)?', '') WHERE link LIKE '/%'")


def downgrade() -> None:
    pass
