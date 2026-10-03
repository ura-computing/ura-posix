/** Catalogue: medicaments + category suffixes (mirrors backend/app/catalog/schemas.py). */

import type { ErrorCode } from "@/api/errors";

/** SuffixBadge palette — kept in sync with backend ALLOWED_COLORS in schemas/catalog.py */
export const SUFFIX_COLORS = ["teal", "blue", "purple", "amber", "rose", "emerald", "orange", "pink"] as const;
export type SuffixColor = (typeof SUFFIX_COLORS)[number];

// ── /admin/categories (category-suffixes) ────────────────────────────────────
// Global table — admin-managed, NOT per-pharmacy. Reused by the Ventes ledger
// to render the colored suffix pill on each row.

export interface CategorySuffixOut {
  id: number;
  category: string;
  suffix: string;
  color: SuffixColor | null;
}

export interface CategorySuffixIn {
  category: string;
  suffix: string;
  color: SuffixColor | null;
}

// ── Admin Catalog (F5 — Medicament CRUD + CSV import) ──────────────────────

export type ProductType = "pharmacie" | "parapharmacie";

export interface Medicament {
  id: number;
  pid: string;
  product: string;
  tva: string | null;
  pph: number | null;
  ppv: number | null;
  category: string | null;
  barcode1: string | null;
  barcode2: string | null;
  laboratoire: string | null;
  product_type: ProductType | null;
  created_at: string;
  updated_at: string | null;
}

export interface MedicamentInput {
  product: string;
  tva?: string | null;
  pph?: number | null;
  ppv?: number | null;
  category?: string | null;
  barcode1?: string | null;
  barcode2?: string | null;
  laboratoire?: string | null;
  product_type?: ProductType | null;
}

export interface CatalogFilters {
  search: string;
  category: string[];
  /** "unclassified" surfaces rows where product_type IS NULL (admin queue). */
  type: ProductType | "unclassified" | null;
  sort_by: string;
  sort_order: "asc" | "desc";
  page: number;
  limit: number;
}

export interface CatalogListResponse {
  data: Medicament[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
}

/** One row-level import error — same shape as an API error (`errors.<code>`). */
export interface RowError {
  detail: string;
  code: ErrorCode;
  params: Record<string, string | number>;
}

export interface CatalogImportResponse {
  total_rows: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: RowError[];
}
