-- Migration 001: Add performance indexes
-- Run with: psql $DATABASE_URL -f backend/migrations/001_add_indexes.sql
-- Safe to re-run (all use IF NOT EXISTS)

CREATE INDEX IF NOT EXISTS ix_achat_pharmacy_id  ON achats(pharmacy_id);
CREATE INDEX IF NOT EXISTS ix_achat_date         ON achats(delivery_date);
CREATE INDEX IF NOT EXISTS ix_achat_medicament   ON achats(medicament_id);
CREATE INDEX IF NOT EXISTS ix_vente_pharmacy_id  ON ventes(pharmacy_id);
CREATE INDEX IF NOT EXISTS ix_vente_date         ON ventes(date);
CREATE INDEX IF NOT EXISTS ix_vente_medicament   ON ventes(medicament_id);
CREATE INDEX IF NOT EXISTS ix_medicament_category ON medicaments(category);
