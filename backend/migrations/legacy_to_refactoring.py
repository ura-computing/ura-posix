"""Legacy → Refactoring one-shot migration.

Runs against a production DB that predates alembic (the old apcm-pharma
`dev` branch's schema). Non-destructive: adds missing tables + columns +
constraints + indexes, backfills the new normalized tables from the
legacy JSON columns, then stamps at alembic head 0017. **Existing data
is untouched.**

Guarantees:
- Every step is idempotent: safe to re-run mid-flight.
- No DROP TABLE, no DROP COLUMN, no DELETE. Legacy columns
  (`pharmacies.options`, `users.permissions`, `users.google_id`,
  `users.pharmacy_name`, `users.profile_complete`) are kept intact for
  orphan-safety; the new code just ignores them.
- Pre-check aborts if the DB looks empty (use `bootstrap.py` instead)
  or already MANAGED (`alembic_version` present — use `alembic upgrade
  head` instead).
- Post-check asserts row counts on legacy tables didn't change.

Usage:
    cd backend && DATABASE_URL=... uv run python migrations/legacy_to_refactoring.py

For the demo DB (`apcm_demo`):
    APP_ENV=demo uv run python migrations/legacy_to_refactoring.py
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

# Make `from database import ...` etc. resolvable when run as a script.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, inspect, text

import database
from database import Base
import models  # noqa: F401 — registers every table on Base.metadata

# Override the app's engine with one that has explicit connect_args. This is
# needed for DigitalOcean managed Postgres where SQLAlchemy strips the URL
# query params (gssencmode, connect_timeout) before handing off to psycopg2,
# causing the initial connection to hang on GSSAPI negotiation. Setting them
# via connect_args guarantees psycopg2 sees them.
import os

_MIGRATION_CONNECT_ARGS = {
    "connect_timeout": 60,
    "gssencmode": "disable",
    "sslmode": "require",
    "application_name": "legacy_to_refactoring",
}
database.engine = create_engine(
    os.environ["DATABASE_URL"],
    pool_pre_ping=True,
    connect_args=_MIGRATION_CONNECT_ARGS,
)
engine = database.engine


# ── Configuration ───────────────────────────────────────────────────────────

# Dev's feature-flag JSON keys → refactoring's names. The only rename is
# `achat` (singular) → `achats` (plural). Other keys already match.
FEATURE_KEY_RENAMES = {"achat": "achats"}

# Refactoring's feature-flag names.
REFACTORING_FEATURES = (
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

# Dev only had these 5 features. Refactoring adds analyse / accounting /
# special_products / alertes. Decision: for any pharmacy/user that had
# AT LEAST ONE dev feature enabled, grant these new features too so
# they can use the new tabs without an admin re-grant. Set to False to
# leave the new features disabled and let admin grant them manually.
GRANT_NEW_FEATURES_TO_MIGRATED = True
NEW_FEATURES_TO_GRANT = ("analyse", "accounting", "special_products", "alertes")

# On some deployments the dev app bypassed permission checks for owners
# (role-based access), so the `permissions` JSON column stayed empty even
# though the owner had full access via the UI. Refactoring enforces the
# 3-layer intersection for owners too, so we grant a baseline set to every
# active owner + every pharmacy. Idempotent: skips rows that already exist.
GRANT_OWNER_BASELINE = True
BASELINE_FEATURES = (
    "rapports",
    "import",
    "achats",
    "ventes",
    "stock",
    "analyse",
    "accounting",
    "special_products",
    "alertes",
)


# ── Pre-check ───────────────────────────────────────────────────────────────


def _pre_check() -> dict:
    """Snapshot the DB state; abort if the DB is in a state this script
    isn't designed for."""
    insp = inspect(engine)
    has_pharmacies = insp.has_table("pharmacies")
    has_alembic = insp.has_table("alembic_version")

    if not has_pharmacies:
        print("✗ No `pharmacies` table found. This looks like an EMPTY database.")
        print("  Use `python bootstrap.py` for empty DBs, not this script.")
        sys.exit(1)
    if has_alembic:
        print("✗ `alembic_version` table already exists. This DB is already MANAGED.")
        print("  Use `alembic upgrade head` for managed DBs, not this script.")
        sys.exit(1)

    with engine.connect() as c:
        snap = {
            "pharmacies": c.execute(text("SELECT COUNT(*) FROM pharmacies")).scalar(),
            "users": c.execute(text("SELECT COUNT(*) FROM users")).scalar(),
            "medicaments": c.execute(text("SELECT COUNT(*) FROM medicaments")).scalar()
            if insp.has_table("medicaments")
            else 0,
            "achats": c.execute(text("SELECT COUNT(*) FROM achats")).scalar() if insp.has_table("achats") else 0,
            "ventes": c.execute(text("SELECT COUNT(*) FROM ventes")).scalar() if insp.has_table("ventes") else 0,
        }
        if insp.has_table("payment_entries"):
            snap["payment_entries"] = c.execute(text("SELECT COUNT(*) FROM payment_entries")).scalar()
        if insp.has_table("import_batches"):
            snap["import_batches"] = c.execute(text("SELECT COUNT(*) FROM import_batches")).scalar()
    return snap


# ── Schema-alignment helpers ────────────────────────────────────────────────


def _ensure_extensions() -> None:
    """Postgres extensions needed by search.py. IF NOT EXISTS = idempotent."""
    with engine.begin() as c:
        c.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm;"))
        c.execute(text("CREATE EXTENSION IF NOT EXISTS unaccent;"))


def _add_missing_columns() -> None:
    """Add every column that refactoring's models have but a legacy dev DB
    doesn't. Uses ADD COLUMN IF NOT EXISTS so this is safe to re-run.

    Mirrors alembic migrations 0001, 0002, 0007, 0011, 0013, 0014 — but
    consolidated so we're not dependent on the alembic runner's ordering
    (some legacy migrations have has_column guards that only work with
    alembic's env)."""
    with engine.begin() as c:
        # 0001 — pharmacies.version (optimistic locking)
        c.execute(text("ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 0"))
        # 0013 — pharmacies.archived_at (soft-delete)
        c.execute(text("ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL"))
        # 0011 — pharmacies address/phone/email (city + code likely already there via dev's runtime DDL)
        c.execute(text("ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS city    VARCHAR"))
        c.execute(text("ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS code    VARCHAR"))
        c.execute(text("ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS address VARCHAR"))
        c.execute(text("ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS phone   VARCHAR"))
        c.execute(text("ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS email   VARCHAR"))

        # 0002 — users token_version, version, last_login_at, created_by (self-FK SET NULL)
        c.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0"))
        c.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS version       INT NOT NULL DEFAULT 0"))
        c.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NULL"))
        c.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by    INT NULL"))
        # Add the self-FK only if it doesn't already exist. `information_schema`
        # lookup, then conditional ALTER.
        exists = c.execute(
            text("""
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'users' AND constraint_name = 'users_created_by_fkey'
        """)
        ).first()
        if not exists:
            c.execute(
                text("""
                ALTER TABLE users
                ADD CONSTRAINT users_created_by_fkey
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
            """)
            )
        # 0011 — users reset_token + reset_token_expires
        c.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token         VARCHAR NULL"))
        c.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ NULL"))

        # 0007 — import_batches status + error_message
        c.execute(text("ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'success'"))
        c.execute(text("ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS error_message VARCHAR NULL"))
        # 0014 — import_batches created_by_user_id / deleted_at / deleted_by_user_id + FKs + index
        c.execute(text("ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS created_by_user_id INT NULL"))
        c.execute(text("ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS deleted_at         TIMESTAMPTZ NULL"))
        c.execute(text("ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS deleted_by_user_id INT NULL"))
        for name, col in (
            ("fk_import_batches_created_by_user_id_users", "created_by_user_id"),
            ("fk_import_batches_deleted_by_user_id_users", "deleted_by_user_id"),
        ):
            exists = c.execute(
                text("""
                SELECT 1 FROM information_schema.table_constraints
                WHERE table_name = 'import_batches' AND constraint_name = :name
            """),
                {"name": name},
            ).first()
            if not exists:
                c.execute(
                    text(f"""
                    ALTER TABLE import_batches
                    ADD CONSTRAINT {name}
                    FOREIGN KEY ({col}) REFERENCES users(id) ON DELETE SET NULL
                """)
                )
        c.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_import_batches_created_by_user_id ON import_batches (created_by_user_id)"
            )
        )


def _create_missing_tables() -> None:
    """create_all is idempotent — adds only missing tables. Never drops.
    Creates: sessions, pharmacy_features, user_permissions,
    store_website_requests, store_customizations. On dev those all
    don't exist. On dev, medicaments/achats/ventes/pharmacy_stock/etc.
    already exist — create_all leaves them alone."""
    Base.metadata.create_all(bind=engine)


def _add_payment_entries_unique() -> None:
    """Migration 0012 skips payment_entries when it exists (dev has it),
    which means the unique constraint on (pharmacy_id, month, method)
    was never added. Adding it explicitly. Guard on existence check."""
    with engine.begin() as c:
        exists = c.execute(
            text("""
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'payment_entries'
              AND constraint_name = 'uq_payment_entries_pharmacy_month_method'
        """)
        ).first()
        if not exists:
            # Check for existing duplicates that would block the constraint.
            dupes = c.execute(
                text("""
                SELECT COUNT(*) FROM (
                    SELECT pharmacy_id, month, method
                    FROM payment_entries
                    GROUP BY pharmacy_id, month, method
                    HAVING COUNT(*) > 1
                ) d
            """)
            ).scalar()
            if dupes and dupes > 0:
                print(f"  ⚠ Found {dupes} duplicate (pharmacy_id, month, method) groups in payment_entries.")
                print("    Cannot add the unique constraint. De-dup first, then re-run.")
                return
            c.execute(
                text("""
                ALTER TABLE payment_entries
                ADD CONSTRAINT uq_payment_entries_pharmacy_month_method
                UNIQUE (pharmacy_id, month, method)
            """)
            )
        c.execute(
            text("""
            CREATE INDEX IF NOT EXISTS ix_payment_entries_pharmacy_month
            ON payment_entries (pharmacy_id, month)
        """)
        )


def _add_check_constraints() -> None:
    """Migration 0016's final CHECK constraint state. DROP IF EXISTS then
    CREATE handles both the freshly-created (via create_all above) and
    the already-migrated cases."""
    features_sql = "', '".join(REFACTORING_FEATURES)
    with engine.begin() as c:
        c.execute(text("ALTER TABLE pharmacy_features DROP CONSTRAINT IF EXISTS ck_pharmacy_features_feature"))
        c.execute(
            text(
                f"ALTER TABLE pharmacy_features ADD CONSTRAINT ck_pharmacy_features_feature CHECK (feature IN ('{features_sql}'))"
            )
        )
        c.execute(text("ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS ck_user_permissions_permission"))
        c.execute(
            text(
                f"ALTER TABLE user_permissions ADD CONSTRAINT ck_user_permissions_permission CHECK (permission IN ('{features_sql}'))"
            )
        )


def _add_store_website_partial_index() -> None:
    """Migration 0017's partial unique index. create_all can't reproduce
    postgresql_where predicates, so we add it explicitly. IF NOT EXISTS
    for idempotency."""
    with engine.begin() as c:
        c.execute(
            text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_request_per_pharmacy
            ON store_website_requests (pharmacy_id)
            WHERE state <> 'cloturee'
        """)
        )


# ── Backfills ───────────────────────────────────────────────────────────────


def _rename_json_key(conn, table: str, col: str, old: str, new: str) -> int:
    """Rename a top-level key inside a JSON column across every row."""
    result = conn.execute(
        text(f"""
        UPDATE {table}
        SET {col} = (
            (({col})::jsonb - :old)
            || jsonb_build_object(:new, (({col})::jsonb) -> :old)
        )::json
        WHERE {col} IS NOT NULL
          AND ({col})::jsonb ? :old
    """),
        {"old": old, "new": new},
    )
    return result.rowcount


def _rename_legacy_feature_keys() -> tuple[int, int]:
    """Rename `achat` → `achats` in pharmacies.options and users.permissions
    JSON before the backfill INSERTs run — otherwise dev's `achat` key
    would be silently dropped by the WHERE filter in the backfill SQL."""
    with engine.begin() as c:
        p, u = 0, 0
        for old, new in FEATURE_KEY_RENAMES.items():
            p += _rename_json_key(c, "pharmacies", "options", old, new)
            u += _rename_json_key(c, "users", "permissions", old, new)
    return p, u


def _backfill_pharmacy_features() -> int:
    """Unpack pharmacies.options JSON into pharmacy_features rows."""
    with engine.begin() as c:
        result = c.execute(
            text("""
            INSERT INTO pharmacy_features (pharmacy_id, feature, enabled)
            SELECT p.id, kv.key, COALESCE((kv.value)::boolean, false)
            FROM pharmacies p, LATERAL json_each_text(p.options) AS kv
            WHERE p.options IS NOT NULL
              AND kv.key IN ('rapports','import','achats','ventes','stock',
                             'analyse','accounting','special_products','alertes')
              AND NOT EXISTS (
                SELECT 1 FROM pharmacy_features pf
                WHERE pf.pharmacy_id = p.id AND pf.feature = kv.key
              )
        """)
        )
    return result.rowcount


def _backfill_user_permissions() -> int:
    """Unpack users.permissions JSON into user_permissions rows."""
    with engine.begin() as c:
        result = c.execute(
            text("""
            INSERT INTO user_permissions (user_id, permission, enabled)
            SELECT u.id, kv.key, COALESCE((kv.value)::boolean, false)
            FROM users u, LATERAL json_each_text(u.permissions) AS kv
            WHERE u.permissions IS NOT NULL
              AND kv.key IN ('rapports','import','achats','ventes','stock',
                             'analyse','accounting','special_products','alertes')
              AND NOT EXISTS (
                SELECT 1 FROM user_permissions up
                WHERE up.user_id = u.id AND up.permission = kv.key
              )
        """)
        )
    return result.rowcount


def _grant_new_features() -> tuple[int, int]:
    """For any pharmacy/user with AT LEAST ONE feature enabled, grant the
    new refactoring-only features so they can use the new tabs without
    admin re-grant. Skips pharmacies/users with zero features (intentionally
    locked out)."""
    if not GRANT_NEW_FEATURES_TO_MIGRATED:
        return 0, 0
    with engine.begin() as c:
        pf_total = 0
        up_total = 0
        for feat in NEW_FEATURES_TO_GRANT:
            r = c.execute(
                text("""
                INSERT INTO pharmacy_features (pharmacy_id, feature, enabled)
                SELECT DISTINCT pf.pharmacy_id, :feat, TRUE
                FROM pharmacy_features pf
                WHERE pf.enabled = TRUE
                  AND NOT EXISTS (
                    SELECT 1 FROM pharmacy_features pf2
                    WHERE pf2.pharmacy_id = pf.pharmacy_id AND pf2.feature = :feat
                  )
            """),
                {"feat": feat},
            )
            pf_total += r.rowcount
            r = c.execute(
                text("""
                INSERT INTO user_permissions (user_id, permission, enabled)
                SELECT DISTINCT up.user_id, :feat, TRUE
                FROM user_permissions up
                WHERE up.enabled = TRUE
                  AND NOT EXISTS (
                    SELECT 1 FROM user_permissions up2
                    WHERE up2.user_id = up.user_id AND up2.permission = :feat
                  )
            """),
                {"feat": feat},
            )
            up_total += r.rowcount
    return pf_total, up_total


def _grant_owner_baseline() -> tuple[int, int]:
    """Grant every pharmacy every baseline feature + every active owner every
    baseline permission. Covers deployments where dev bypassed permission
    checks for owners and the legacy JSON columns stayed empty. Idempotent."""
    if not GRANT_OWNER_BASELINE:
        return 0, 0
    with engine.begin() as c:
        pf_total = 0
        up_total = 0
        for feat in BASELINE_FEATURES:
            r = c.execute(
                text("""
                INSERT INTO pharmacy_features (pharmacy_id, feature, enabled)
                SELECT p.id, :feat, TRUE
                FROM pharmacies p
                WHERE NOT EXISTS (
                    SELECT 1 FROM pharmacy_features pf
                    WHERE pf.pharmacy_id = p.id AND pf.feature = :feat
                )
            """),
                {"feat": feat},
            )
            pf_total += r.rowcount
            r = c.execute(
                text("""
                INSERT INTO user_permissions (user_id, permission, enabled)
                SELECT u.id, :feat, TRUE
                FROM users u
                WHERE u.role = 'owner' AND u.status = 'active'
                  AND NOT EXISTS (
                    SELECT 1 FROM user_permissions up
                    WHERE up.user_id = u.id AND up.permission = :feat
                  )
            """),
                {"feat": feat},
            )
            up_total += r.rowcount
    return pf_total, up_total


def _backfill_product_type() -> int:
    """Migration 0010: classify medicaments as pharmacie / parapharmacie
    based on category regex."""
    with engine.begin() as c:
        r1 = c.execute(
            text("""
            UPDATE medicaments
            SET product_type = 'pharmacie'
            WHERE product_type IS NULL
              AND lower(category) ~ '(edicament|édicament|oméopath|omeopath|iététique|ietetique)'
        """)
        )
        r2 = c.execute(
            text("""
            UPDATE medicaments
            SET product_type = 'parapharmacie'
            WHERE product_type IS NULL
        """)
        )
    return r1.rowcount + r2.rowcount


def _backfill_import_batch_creators() -> int:
    """Migration 0015: attribute pre-migration import_batches to the
    pharmacy's unique active owner. Skipped for pharmacies with 0 or 2+
    active owners (ambiguous)."""
    with engine.begin() as c:
        result = c.execute(
            text("""
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
        """)
        )
    return result.rowcount


# ── Finalization ────────────────────────────────────────────────────────────


def _stamp_alembic_head() -> None:
    """Mark the DB as being at alembic head (0017). After this, future
    `alembic upgrade head` calls will see the DB as MANAGED and no-op
    until new migrations are added."""
    result = subprocess.run(
        ["alembic", "stamp", "head"],
        cwd=Path(__file__).resolve().parent.parent,
        check=False,
    )
    if result.returncode != 0:
        print(f"✗ alembic stamp head failed with exit {result.returncode}")
        sys.exit(result.returncode)


def _post_check(before: dict) -> None:
    """Verify no legacy data was lost + print the new counts."""
    with engine.connect() as c:
        after = {
            "pharmacies": c.execute(text("SELECT COUNT(*) FROM pharmacies")).scalar(),
            "users": c.execute(text("SELECT COUNT(*) FROM users")).scalar(),
            "medicaments": c.execute(text("SELECT COUNT(*) FROM medicaments")).scalar(),
            "achats": c.execute(text("SELECT COUNT(*) FROM achats")).scalar(),
            "ventes": c.execute(text("SELECT COUNT(*) FROM ventes")).scalar(),
            "payment_entries": c.execute(text("SELECT COUNT(*) FROM payment_entries")).scalar(),
            "import_batches": c.execute(text("SELECT COUNT(*) FROM import_batches")).scalar(),
            "pharmacy_features": c.execute(text("SELECT COUNT(*) FROM pharmacy_features")).scalar(),
            "user_permissions": c.execute(text("SELECT COUNT(*) FROM user_permissions")).scalar(),
            "sessions": c.execute(text("SELECT COUNT(*) FROM sessions")).scalar(),
        }

    print()
    print("=" * 60)
    print("VERIFICATION")
    print("=" * 60)
    for k, v in after.items():
        was = before.get(k, "-")
        marker = " " if isinstance(was, int) and was == v else "▲"
        print(f"  {marker} {k:22} {str(was):>8}  →  {str(v):>8}")

    # Sanity: no data was lost.
    for k in ("pharmacies", "users", "medicaments", "achats", "ventes"):
        if k in before:
            assert after[k] == before[k], (
                f"DATA LOSS on {k}: {before[k]} → {after[k]}. This should NEVER happen — investigate immediately."
            )
    print()
    print("✓ Legacy row counts preserved. No data lost.")


# ── main ────────────────────────────────────────────────────────────────────


def main() -> None:
    print("=" * 60)
    print("Legacy → Refactoring migration")
    print("=" * 60)
    print(f"  DATABASE_URL: {engine.url.render_as_string(hide_password=True)}")
    print(f"  GRANT_NEW_FEATURES_TO_MIGRATED: {GRANT_NEW_FEATURES_TO_MIGRATED}")
    print()

    print("▸ Pre-check + snapshot")
    before = _pre_check()
    for k, v in before.items():
        print(f"    {k}: {v}")
    print()

    print("▸ 1/10  CREATE EXTENSION pg_trgm + unaccent")
    _ensure_extensions()

    print("▸ 2/10  ADD COLUMN IF NOT EXISTS on shared tables")
    _add_missing_columns()

    print("▸ 3/10  create_all — new tables (sessions, pharmacy_features, user_permissions, store_website_*)")
    _create_missing_tables()

    print("▸ 4/10  Add missing payment_entries unique constraint (migration 0012 skipped on legacy DBs)")
    _add_payment_entries_unique()

    print("▸ 5/10  Rename legacy JSON key `achat` → `achats` before backfill")
    p_renamed, u_renamed = _rename_legacy_feature_keys()
    print(f"       pharmacies renamed: {p_renamed}, users renamed: {u_renamed}")

    print("▸ 6/10  Backfill pharmacy_features + user_permissions from legacy JSON")
    pf = _backfill_pharmacy_features()
    up = _backfill_user_permissions()
    print(f"       pharmacy_features inserted: {pf}")
    print(f"       user_permissions inserted:  {up}")

    if GRANT_NEW_FEATURES_TO_MIGRATED:
        print(f"▸ 7a/11 Grant new features {list(NEW_FEATURES_TO_GRANT)} to migrated users")
        pf_n, up_n = _grant_new_features()
        print(f"       pharmacy_features inserted: {pf_n}")
        print(f"       user_permissions inserted:  {up_n}")
    else:
        print("▸ 7a/11 Skip — GRANT_NEW_FEATURES_TO_MIGRATED is False")

    if GRANT_OWNER_BASELINE:
        print("▸ 7b/11 Grant baseline features to every pharmacy + every active owner")
        pf_b, up_b = _grant_owner_baseline()
        print(f"       pharmacy_features inserted: {pf_b}")
        print(f"       user_permissions inserted:  {up_b}")
    else:
        print("▸ 7b/11 Skip — GRANT_OWNER_BASELINE is False")

    print("▸ 8/11  Backfill medicaments.product_type (regex on category)")
    n = _backfill_product_type()
    print(f"       medicaments updated: {n}")

    print("▸ 9/11  Backfill import_batches.created_by_user_id (single-owner attribution)")
    n = _backfill_import_batch_creators()
    print(f"       import_batches updated: {n}")

    print("▸ 10/11 Add CHECK constraints + store-website partial unique index + alembic stamp head")
    _add_check_constraints()
    _add_store_website_partial_index()
    _stamp_alembic_head()

    _post_check(before)

    print()
    print("=" * 60)
    print("✓ Migration complete.")
    print("=" * 60)
    print("  DB is now MANAGED at alembic head.")
    print("  Future backend boots hit bootstrap.py's MANAGED branch")
    print("  (alembic upgrade head — a no-op until new revisions land).")
    print()
    print("  Legacy columns kept for orphan-safety:")
    print("    - pharmacies.options   (JSON, now unused)")
    print("    - users.permissions    (JSON, now unused)")
    print("    - users.google_id      (only refactoring won't set it)")
    print("    - users.pharmacy_name  (denormalized cache)")
    print("    - users.profile_complete")
    print("    - catalog_requests + catalog_requests.* (whole table)")
    print()


if __name__ == "__main__":
    main()
