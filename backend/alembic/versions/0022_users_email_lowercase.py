"""users: emails stored trimmed and in lower case (T1)

Revision ID: 0022
Revises: 0021
Create Date: 2026-10-04

Login and « email déjà utilisé » now compare the typed email trimmed and in lower
case (`app/core/utils.normalize_email`). Stored emails get the same spelling, so
« Ali@Gmail.com » keeps logging in as « ali@gmail.com ». Two accounts that would
end up with the same email are left as they are and listed in the migration log:
the admin decides which one stays.

Downgrade: nothing to undo (the old spelling is not kept).
"""

from __future__ import annotations

import logging
from collections import defaultdict

import sqlalchemy as sa
from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None

log = logging.getLogger("alembic.runtime.migration")


def upgrade() -> None:
    bind = op.get_bind()
    by_email: dict[str, list[tuple[int, str]]] = defaultdict(list)
    for user_id, email in bind.execute(sa.text("SELECT id, email FROM users")).all():
        by_email[email.strip().lower()].append((user_id, email))
    for email, accounts in by_email.items():
        if len(accounts) > 1:
            log.warning("0022: same email once in lower case, left unchanged: %s", accounts)
            continue
        user_id, stored = accounts[0]
        if stored != email:
            bind.execute(sa.text("UPDATE users SET email = :email WHERE id = :id"), {"email": email, "id": user_id})


def downgrade() -> None:
    pass
