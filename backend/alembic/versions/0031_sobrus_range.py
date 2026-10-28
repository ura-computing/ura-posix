"""sobrus_runs: mode `range` (« Importer une période ») + date_from / date_to + heartbeat_at

Revision ID: 0031
Revises: 0030
Create Date: 2026-10-28

The owner picks a start and an end date; the robot imports them year by year (Sobrus exports
1 year at most): 2014-03-01 → 2025-08-01 = 2025-01-01 → 2025-08-01, 2024, …, 2014-03-01 → 2014-12-31.
`heartbeat_at`: written at every step of a running run; silent 10 min = its robot stopped (deploy,
restart) → the run is closed as interrupted (app/sobrus/worker.py).

Downgrade: removes the `range` runs and the 3 columns.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0031"
down_revision = "0030"
branch_labels = None
depends_on = None


def _set_mode_check(modes: tuple[str, ...]) -> None:
    # IF EXISTS: a DB built by `create_all` may not have the named constraint (see 0016).
    op.execute("ALTER TABLE sobrus_runs DROP CONSTRAINT IF EXISTS ck_sobrus_runs_mode")
    op.create_check_constraint("ck_sobrus_runs_mode", "sobrus_runs", f"mode IN {modes}")


def upgrade() -> None:
    columns = {c["name"] for c in sa.inspect(op.get_bind()).get_columns("sobrus_runs")}
    for name, kind in (("date_from", sa.Date()), ("date_to", sa.Date()), ("heartbeat_at", sa.DateTime(timezone=True))):
        if name not in columns:
            op.add_column("sobrus_runs", sa.Column(name, kind, nullable=True))
    _set_mode_check(("full", "new", "check", "range"))


def downgrade() -> None:
    op.execute("DELETE FROM sobrus_runs WHERE mode = 'range'")
    _set_mode_check(("full", "new", "check"))
    op.drop_column("sobrus_runs", "heartbeat_at")
    op.drop_column("sobrus_runs", "date_to")
    op.drop_column("sobrus_runs", "date_from")
