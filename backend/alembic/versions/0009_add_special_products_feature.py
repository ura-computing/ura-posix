"""add special_products to ALLOWED_FEATURES + ALLOWED_PERMISSIONS

Owner-managed product exclusions ('produits spéciaux') need a feature flag
+ permission. Extends the CHECK constraints on pharmacy_features.feature
and user_permissions.permission to include the new value.

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-23
"""
from typing import Sequence, Union

from alembic import op


revision: str = "0009"
down_revision: Union[str, Sequence[str], None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_FEATURES_NEW = (
    "rapports", "import", "achats", "ventes",
    "stock", "analyse", "accounting", "bl_exclusions",
    "special_products",
)
_FEATURES_OLD = (
    "rapports", "import", "achats", "ventes",
    "stock", "analyse", "accounting", "bl_exclusions",
)


def upgrade() -> None:
    # pharmacy_features.feature CHECK constraint
    op.drop_constraint("ck_pharmacy_features_feature", "pharmacy_features", type_="check")
    op.create_check_constraint(
        "ck_pharmacy_features_feature",
        "pharmacy_features",
        f"feature IN {_FEATURES_NEW}",
    )
    # user_permissions.permission CHECK constraint
    op.drop_constraint("ck_user_permissions_permission", "user_permissions", type_="check")
    op.create_check_constraint(
        "ck_user_permissions_permission",
        "user_permissions",
        f"permission IN {_FEATURES_NEW}",
    )


def downgrade() -> None:
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
