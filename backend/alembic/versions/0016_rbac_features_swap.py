"""extend CHECK constraints with `alertes` + seed it for existing pharmacies/users

Revision ID: 0016
Revises: 0015
Create Date: 2026-06-24

Adds the `alertes` feature to ALLOWED_FEATURES (Python const removes
`bl_exclusions` simultaneously, but the DB CHECK constraint KEEPS
`bl_exclusions` so any existing orphan rows remain valid — see plan
note: "drop bl_exclusions from FEATURES" means feature-flag is gone,
but data integrity is preserved).

Seeds `alertes=true` on every existing pharmacy + non-admin user so they
don't suddenly lose access to /alertes (which was previously role-only,
not feature-gated) when the route + section gates land.
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = "0016"
down_revision: Union[str, Sequence[str], None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Old set (0009 added special_products); new set adds `alertes`. We keep
# `bl_exclusions` in the DB CHECK even though the Python const drops it,
# so any orphan rows in pharmacy_features / user_permissions stay valid.
_FEATURES_OLD = (
    "rapports",
    "import",
    "achats",
    "ventes",
    "stock",
    "analyse",
    "accounting",
    "bl_exclusions",
    "special_products",
)
_FEATURES_NEW = (
    "rapports",
    "import",
    "achats",
    "ventes",
    "stock",
    "analyse",
    "accounting",
    "bl_exclusions",
    "special_products",
    "alertes",
)


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Extend the CHECK constraints so `alertes` is accepted. Use raw
    #    `DROP CONSTRAINT IF EXISTS` because some environments were
    #    bootstrapped via SQLAlchemy `create_all` (which doesn't generate
    #    the named CHECK constraints from migration 0009) — those DBs have
    #    no constraint to drop.
    conn.execute(text("ALTER TABLE pharmacy_features DROP CONSTRAINT IF EXISTS ck_pharmacy_features_feature"))
    op.create_check_constraint(
        "ck_pharmacy_features_feature",
        "pharmacy_features",
        f"feature IN {_FEATURES_NEW}",
    )
    conn.execute(text("ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS ck_user_permissions_permission"))
    op.create_check_constraint(
        "ck_user_permissions_permission",
        "user_permissions",
        f"permission IN {_FEATURES_NEW}",
    )

    # 2. Seed `alertes=true` for every pharmacy that doesn't already have a row.
    conn.execute(
        text("""
        INSERT INTO pharmacy_features (pharmacy_id, feature, enabled)
        SELECT p.id, 'alertes', TRUE
        FROM   pharmacies p
        WHERE  NOT EXISTS (
            SELECT 1 FROM pharmacy_features pf
            WHERE  pf.pharmacy_id = p.id AND pf.feature = 'alertes'
        )
    """)
    )

    # 3. Seed `alertes=true` for every active non-admin user without an
    #    existing row — preserves their pre-migration access to /alertes.
    conn.execute(
        text("""
        INSERT INTO user_permissions (user_id, permission, enabled)
        SELECT u.id, 'alertes', TRUE
        FROM   users u
        WHERE  u.role IN ('owner', 'employee')
          AND  u.status = 'active'
          AND  NOT EXISTS (
            SELECT 1 FROM user_permissions up
            WHERE  up.user_id = u.id AND up.permission = 'alertes'
          )
    """)
    )


def downgrade() -> None:
    # Roll back the CHECK constraints first; orphan `alertes` rows would
    # block the constraint re-creation, so delete those rows too.
    conn = op.get_bind()
    conn.execute(text("DELETE FROM user_permissions WHERE permission = 'alertes'"))
    conn.execute(text("DELETE FROM pharmacy_features WHERE feature = 'alertes'"))

    op.drop_constraint("ck_pharmacy_features_feature", "pharmacy_features", type_="check")
    op.create_check_constraint(
        "ck_pharmacy_features_feature",
        "pharmacy_features",
        f"feature IN {_FEATURES_OLD}",
    )
    op.drop_constraint("ck_user_permissions_permission", "user_permissions", type_="check")
    op.create_check_constraint(
        "ck_user_permissions_permission",
        "user_permissions",
        f"permission IN {_FEATURES_OLD}",
    )
