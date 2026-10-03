-- Legacy → Refactoring migration (raw SQL edition).
--
-- Runs the same operations as legacy_to_refactoring.py, but as pure SQL so
-- we can execute it via psql when the Python driver can't establish a
-- connection to DigitalOcean managed Postgres.
--
-- Every statement is idempotent (IF NOT EXISTS / NOT EXISTS guards),
-- so this script is safe to re-run if it fails mid-flight.
--
-- Run:
--     PGGSSENCMODE=disable psql "$PROD_DB_URL" -f migrations/legacy_to_refactoring.sql
--
-- ═══════════════════════════════════════════════════════════════════
-- PHASE 1: Extensions (should already exist on prod, IF NOT EXISTS just in case)
-- ═══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ═══════════════════════════════════════════════════════════════════
-- PHASE 2: ADD COLUMN IF NOT EXISTS on shared tables
-- ═══════════════════════════════════════════════════════════════════

-- pharmacies: version (opt-lock) + archived_at (soft-delete) + city/code/etc.
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS version     INT NOT NULL DEFAULT 0;
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS city        VARCHAR;
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS code        VARCHAR;
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS address     VARCHAR;
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS phone       VARCHAR;
ALTER TABLE pharmacies ADD COLUMN IF NOT EXISTS email       VARCHAR;

-- users: token_version + version + last_login_at + created_by (self-FK SET NULL)
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version       INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS version             INT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at       TIMESTAMPTZ NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by          INT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token         VARCHAR NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMPTZ NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'users' AND constraint_name = 'users_created_by_fkey'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_created_by_fkey
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- import_batches: status + error_message + created_by/deleted_by FKs
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS status             VARCHAR NOT NULL DEFAULT 'success';
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS error_message      VARCHAR NULL;
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS created_by_user_id INT NULL;
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS deleted_at         TIMESTAMPTZ NULL;
ALTER TABLE import_batches ADD COLUMN IF NOT EXISTS deleted_by_user_id INT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'import_batches'
          AND constraint_name = 'fk_import_batches_created_by_user_id_users'
    ) THEN
        ALTER TABLE import_batches
            ADD CONSTRAINT fk_import_batches_created_by_user_id_users
            FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'import_batches'
          AND constraint_name = 'fk_import_batches_deleted_by_user_id_users'
    ) THEN
        ALTER TABLE import_batches
            ADD CONSTRAINT fk_import_batches_deleted_by_user_id_users
            FOREIGN KEY (deleted_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_import_batches_created_by_user_id
    ON import_batches (created_by_user_id);

-- ═══════════════════════════════════════════════════════════════════
-- PHASE 3: CREATE new tables
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sessions (
    id                 SERIAL PRIMARY KEY,
    user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR NOT NULL UNIQUE,
    device_label       VARCHAR,
    ip                 VARCHAR,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at         TIMESTAMPTZ NOT NULL
);
CREATE INDEX        IF NOT EXISTS ix_sessions_user_id             ON sessions (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_sessions_refresh_token_hash  ON sessions (refresh_token_hash);


CREATE TABLE IF NOT EXISTS pharmacy_features (
    id          SERIAL PRIMARY KEY,
    pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    feature     VARCHAR NOT NULL,
    enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_pharmacy_features_pharmacy_feature UNIQUE (pharmacy_id, feature)
);
CREATE INDEX IF NOT EXISTS ix_pharmacy_features_pharmacy_id ON pharmacy_features (pharmacy_id);


CREATE TABLE IF NOT EXISTS user_permissions (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR NOT NULL,
    enabled    BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_user_permissions_user_permission UNIQUE (user_id, permission)
);
CREATE INDEX IF NOT EXISTS ix_user_permissions_user_id ON user_permissions (user_id);


CREATE TABLE IF NOT EXISTS store_website_requests (
    id             UUID PRIMARY KEY,
    pharmacy_id    INTEGER NOT NULL REFERENCES pharmacies(id),
    owner_id       INTEGER NOT NULL REFERENCES users(id),
    store_name     VARCHAR NOT NULL,
    slogan         VARCHAR,
    brand_palette  JSON NOT NULL DEFAULT '[]',
    phone          VARCHAR NOT NULL,
    custom_domain  VARCHAR,
    urgency        VARCHAR NOT NULL,
    vision         VARCHAR,
    state          VARCHAR NOT NULL DEFAULT 'soumise',
    claimed_by_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    claimed_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_store_website_requests_pharmacy_id ON store_website_requests (pharmacy_id);
CREATE INDEX IF NOT EXISTS ix_store_website_requests_owner_id    ON store_website_requests (owner_id);
CREATE INDEX IF NOT EXISTS ix_store_website_requests_state       ON store_website_requests (state);
CREATE INDEX IF NOT EXISTS ix_store_website_requests_claimed_by  ON store_website_requests (claimed_by_id);


CREATE TABLE IF NOT EXISTS store_customizations (
    request_id            UUID PRIMARY KEY REFERENCES store_website_requests(id) ON DELETE CASCADE,
    template              VARCHAR NOT NULL DEFAULT 'lumiere',
    sections              JSON NOT NULL DEFAULT '{}',
    brand_colors          JSON NOT NULL DEFAULT '{}',
    logo_url              VARCHAR,
    font_pairing          VARCHAR NOT NULL DEFAULT 'moderne',
    featured_category_ids JSON NOT NULL DEFAULT '[]',
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════
-- PHASE 4: Payment entries unique constraint (migration 0012 skipped on legacy)
-- ═══════════════════════════════════════════════════════════════════

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'payment_entries'
          AND constraint_name = 'uq_payment_entries_pharmacy_month_method'
    ) THEN
        ALTER TABLE payment_entries
            ADD CONSTRAINT uq_payment_entries_pharmacy_month_method
            UNIQUE (pharmacy_id, month, method);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_payment_entries_pharmacy_month
    ON payment_entries (pharmacy_id, month);

-- ═══════════════════════════════════════════════════════════════════
-- PHASE 5: Rename legacy JSON key `achat` → `achats`
-- ═══════════════════════════════════════════════════════════════════

UPDATE pharmacies
SET options = (
    (((options)::jsonb - 'achat')
    || jsonb_build_object('achats', ((options)::jsonb) -> 'achat'))
)::json
WHERE options IS NOT NULL AND ((options)::jsonb) ? 'achat';

UPDATE users
SET permissions = (
    (((permissions)::jsonb - 'achat')
    || jsonb_build_object('achats', ((permissions)::jsonb) -> 'achat'))
)::json
WHERE permissions IS NOT NULL AND ((permissions)::jsonb) ? 'achat';

-- ═══════════════════════════════════════════════════════════════════
-- PHASE 6: Backfill pharmacy_features + user_permissions from legacy JSON
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO pharmacy_features (pharmacy_id, feature, enabled)
SELECT p.id, kv.key, COALESCE((kv.value)::boolean, false)
FROM pharmacies p, LATERAL json_each_text(p.options) AS kv
WHERE p.options IS NOT NULL
  AND kv.key IN ('rapports','import','achats','ventes','stock',
                 'analyse','accounting','special_products','alertes')
  AND NOT EXISTS (
    SELECT 1 FROM pharmacy_features pf
    WHERE pf.pharmacy_id = p.id AND pf.feature = kv.key
  );

INSERT INTO user_permissions (user_id, permission, enabled)
SELECT u.id, kv.key, COALESCE((kv.value)::boolean, false)
FROM users u, LATERAL json_each_text(u.permissions) AS kv
WHERE u.permissions IS NOT NULL
  AND kv.key IN ('rapports','import','achats','ventes','stock',
                 'analyse','accounting','special_products','alertes')
  AND NOT EXISTS (
    SELECT 1 FROM user_permissions up
    WHERE up.user_id = u.id AND up.permission = kv.key
  );

-- ═══════════════════════════════════════════════════════════════════
-- PHASE 7a: Grant new features (analyse/accounting/special_products/alertes)
--            to any pharmacy/user with ≥1 feature already enabled
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO pharmacy_features (pharmacy_id, feature, enabled)
SELECT DISTINCT pf.pharmacy_id, f.feature, TRUE
FROM pharmacy_features pf
CROSS JOIN (VALUES ('analyse'),('accounting'),('special_products'),('alertes')) AS f(feature)
WHERE pf.enabled = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM pharmacy_features pf2
    WHERE pf2.pharmacy_id = pf.pharmacy_id AND pf2.feature = f.feature
  );

INSERT INTO user_permissions (user_id, permission, enabled)
SELECT DISTINCT up.user_id, p.permission, TRUE
FROM user_permissions up
CROSS JOIN (VALUES ('analyse'),('accounting'),('special_products'),('alertes')) AS p(permission)
WHERE up.enabled = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM user_permissions up2
    WHERE up2.user_id = up.user_id AND up2.permission = p.permission
  );

-- ═══════════════════════════════════════════════════════════════════
-- PHASE 7b: Grant baseline to every pharmacy + every active owner
--           (covers deployments where dev bypassed permission checks
--            and the legacy JSON columns stayed empty)
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO pharmacy_features (pharmacy_id, feature, enabled)
SELECT p.id, f.feature, TRUE
FROM pharmacies p
CROSS JOIN (VALUES
    ('rapports'), ('import'), ('achats'), ('ventes'), ('stock'),
    ('analyse'), ('accounting'), ('special_products'), ('alertes')
) AS f(feature)
WHERE NOT EXISTS (
    SELECT 1 FROM pharmacy_features pf
    WHERE pf.pharmacy_id = p.id AND pf.feature = f.feature
);

INSERT INTO user_permissions (user_id, permission, enabled)
SELECT u.id, p.permission, TRUE
FROM users u
CROSS JOIN (VALUES
    ('rapports'), ('import'), ('achats'), ('ventes'), ('stock'),
    ('analyse'), ('accounting'), ('special_products'), ('alertes')
) AS p(permission)
WHERE u.role = 'owner' AND u.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM user_permissions up
    WHERE up.user_id = u.id AND up.permission = p.permission
  );

-- ═══════════════════════════════════════════════════════════════════
-- PHASE 8: Backfill medicaments.product_type (regex on category)
-- ═══════════════════════════════════════════════════════════════════

UPDATE medicaments
SET product_type = 'pharmacie'
WHERE product_type IS NULL
  AND lower(category) ~ '(edicament|édicament|oméopath|omeopath|iététique|ietetique)';

UPDATE medicaments
SET product_type = 'parapharmacie'
WHERE product_type IS NULL;

-- ═══════════════════════════════════════════════════════════════════
-- PHASE 9: Backfill import_batches.created_by_user_id
--           (only for pharmacies with EXACTLY ONE active owner)
-- ═══════════════════════════════════════════════════════════════════

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
  AND  import_batches.created_by_user_id IS NULL;

-- ═══════════════════════════════════════════════════════════════════
-- PHASE 10: CHECK constraints + partial unique index + alembic stamp
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE pharmacy_features DROP CONSTRAINT IF EXISTS ck_pharmacy_features_feature;
ALTER TABLE pharmacy_features
    ADD CONSTRAINT ck_pharmacy_features_feature CHECK (
        feature IN (
            'rapports', 'import', 'achats', 'ventes', 'stock',
            'analyse', 'accounting', 'bl_exclusions',
            'special_products', 'alertes'
        )
    );

ALTER TABLE user_permissions DROP CONSTRAINT IF EXISTS ck_user_permissions_permission;
ALTER TABLE user_permissions
    ADD CONSTRAINT ck_user_permissions_permission CHECK (
        permission IN (
            'rapports', 'import', 'achats', 'ventes', 'stock',
            'analyse', 'accounting', 'bl_exclusions',
            'special_products', 'alertes'
        )
    );

CREATE UNIQUE INDEX IF NOT EXISTS uq_one_active_request_per_pharmacy
    ON store_website_requests (pharmacy_id)
    WHERE state <> 'cloturee';

-- Alembic version stamp — marks the DB as at head 0017.
CREATE TABLE IF NOT EXISTS alembic_version (
    version_num VARCHAR NOT NULL PRIMARY KEY
);
INSERT INTO alembic_version (version_num) VALUES ('0017')
ON CONFLICT (version_num) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION — must show non-zero counts for pharmacy_features + user_permissions
-- ═══════════════════════════════════════════════════════════════════

SELECT 'pharmacy_features' AS what, count(*) AS rows FROM pharmacy_features
UNION ALL
SELECT 'user_permissions', count(*) FROM user_permissions
UNION ALL
SELECT 'alembic_version at 0017', count(*) FROM alembic_version WHERE version_num = '0017'
UNION ALL
SELECT 'pharmacies (unchanged)', count(*) FROM pharmacies
UNION ALL
SELECT 'users (unchanged)',      count(*) FROM users
UNION ALL
SELECT 'medicaments (unchanged)', count(*) FROM medicaments
UNION ALL
SELECT 'achats (unchanged)',     count(*) FROM achats
UNION ALL
SELECT 'ventes (unchanged)',     count(*) FROM ventes;
