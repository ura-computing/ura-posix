"""signup_requests: a waiting « Créer un compte » gets its `pending` account

Revision ID: 0028
Revises: 0027
Create Date: 2026-10-16

A sign-up now creates a `pending` user at once (no pharmacy, no permission): the person logs
in and sees an empty menu until the admin clicks « Accepter ». Requests still waiting from
before get the same: the newest request of each email that has no account yet gets its
pending user (sign-up password, name, phone, role) and is linked to it.

Downgrade: nothing to undo (« Accepter » / « Refuser » handle these accounts).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0028"
down_revision = "0027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    waiting = bind.execute(
        sa.text(
            "SELECT DISTINCT ON (r.email) r.id, r.email, r.full_name, r.phone, r.password_hash, r.role "
            "FROM signup_requests r "
            "WHERE r.status = 'pending' AND r.user_id IS NULL "
            "AND NOT EXISTS (SELECT 1 FROM users u WHERE u.email = r.email) "
            "ORDER BY r.email, r.created_at DESC, r.id DESC"
        )
    ).all()
    for req_id, email, name, phone, password_hash, role in waiting:
        user_id = bind.execute(
            sa.text(
                "INSERT INTO users (email, name, phone, password_hash, role, status, token_version, version) "
                "VALUES (:email, :name, :phone, :hash, :role, 'pending', 0, 0) RETURNING id"
            ),
            {"email": email, "name": name, "phone": phone, "hash": password_hash, "role": role},
        ).scalar_one()
        bind.execute(sa.text("UPDATE signup_requests SET user_id = :u WHERE id = :id"), {"u": user_id, "id": req_id})


def downgrade() -> None:
    pass
