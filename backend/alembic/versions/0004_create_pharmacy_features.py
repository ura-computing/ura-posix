"""create_pharmacy_features

Pharmacy-level feature flags (normalizes pharmacies.options JSON).
Backfills from existing JSON (no-op when options is empty / null).

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-20

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004"
down_revision: Union[str, Sequence[str], None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ALLOWED_FEATURES = (
    "rapports", "import", "achats", "ventes",
    "stock", "analyse", "accounting", "bl_exclusions",
)


def upgrade() -> None:
    op.create_table(
        "pharmacy_features",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pharmacy_id", sa.Integer(), sa.ForeignKey("pharmacies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("feature", sa.String(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.CheckConstraint(f"feature IN {ALLOWED_FEATURES}", name="ck_pharmacy_features_feature"),
        sa.UniqueConstraint("pharmacy_id", "feature", name="uq_pharmacy_features_pharmacy_feature"),
    )
    op.create_index("ix_pharmacy_features_pharmacy_id", "pharmacy_features", ["pharmacy_id"])

    # Backfill from pharmacies.options (JSON dict {feature: bool}).
    # No-op when options is null or empty.
    op.execute("""
        INSERT INTO pharmacy_features (pharmacy_id, feature, enabled)
        SELECT p.id, kv.key, COALESCE((kv.value)::boolean, false)
        FROM pharmacies p, LATERAL json_each_text(p.options) AS kv
        WHERE p.options IS NOT NULL
          AND kv.key IN ('rapports','import','achats','ventes','stock','analyse','accounting','bl_exclusions')
    """)


def downgrade() -> None:
    op.drop_index("ix_pharmacy_features_pharmacy_id", "pharmacy_features")
    op.drop_table("pharmacy_features")