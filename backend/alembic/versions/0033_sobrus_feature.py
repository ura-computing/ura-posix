"""extend CHECK constraints with `sobrus` + turn it ON for existing pharmacies / users

Revision ID: 0033
Revises: 0032
Create Date: 2026-10-29

« Connexion Sobrus » becomes an access like the others: the admin gives it to a pharmacy or takes
it away (pharmacy_features), the owner has it (user_permissions). Like every feature, a new
pharmacy / user gets it ON (ALLOWED_FEATURES); this turns it ON for the existing ones too (same as
0024). The CHECK keeps `bl_exclusions` (see 0016) so old rows stay valid.
"""

from typing import Sequence, Union

from alembic import op
from sqlalchemy import text


revision: str = "0033"
down_revision: Union[str, Sequence[str], None] = "0032"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


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
    "alertes",
    "produits",
)
_FEATURES_NEW = (*_FEATURES_OLD, "sobrus")


def _set_checks(features: tuple[str, ...]) -> None:
    conn = op.get_bind()
    # IF EXISTS: a DB built by `create_all` may not have the named constraints (see 0016).
    conn.execute(text("ALTER TABLE pharmacy_features DROP CONSTRAINT IF EXISTS ck_pharmacy_features_feature"))
    op.create_check_constraint("ck_pharmacy_features_feature", "pharmacy_features", f"feature IN {features}")
    conn.execute(text("ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS ck_user_permissions_permission"))
    op.create_check_constraint("ck_user_permissions_permission", "user_permissions", f"permission IN {features}")


def upgrade() -> None:
    _set_checks(_FEATURES_NEW)
    conn = op.get_bind()
    conn.execute(
        text("""
        INSERT INTO pharmacy_features (pharmacy_id, feature, enabled)
        SELECT p.id, 'sobrus', TRUE
        FROM   pharmacies p
        WHERE  NOT EXISTS (
            SELECT 1 FROM pharmacy_features pf
            WHERE  pf.pharmacy_id = p.id AND pf.feature = 'sobrus'
        )
    """)
    )
    # Every owner / employee, active or not (employees never use it: the routes are owner-only).
    conn.execute(
        text("""
        INSERT INTO user_permissions (user_id, permission, enabled)
        SELECT u.id, 'sobrus', TRUE
        FROM   users u
        WHERE  u.role IN ('owner', 'employee')
          AND  NOT EXISTS (
            SELECT 1 FROM user_permissions up
            WHERE  up.user_id = u.id AND up.permission = 'sobrus'
          )
    """)
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("DELETE FROM user_permissions WHERE permission = 'sobrus'"))
    conn.execute(text("DELETE FROM pharmacy_features WHERE feature = 'sobrus'"))
    _set_checks(_FEATURES_OLD)
