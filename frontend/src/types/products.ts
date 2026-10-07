/** « Produits » (mirrors backend/app/products/schemas.py). */

import type { CategoryType } from "./stats";

export interface ProductRow {
  id: number;
  pid: string;
  product: string;
  laboratoire: string | null;
  category: string | null;
  category_type: "pharmacie" | "parapharmacie";
  /** null = not in the last stock import. */
  current_stock: number | null;
  /** Same 12 months as the Stock page: `sales_from` → `sales_to`. */
  units_sold_12m: number;
  ppv: number | null;
  avg_pu: number | null;
  marge_pct: number | null;
  /** First scraped photo URL; null = none (always null in the Excel export answer). */
  photo: string | null;
}

export interface ProductsListResponse {
  data: ProductRow[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
  sales_from: string;
  sales_to: string;
}

export interface ProductsFilters {
  page: number;
  limit: number;
  search: string;
  category_type: CategoryType;
  sort_by: string | null;
  sort_order: "asc" | "desc";
}

// ── Product sheet (GET /products/{id}) ─────────────────────────────────────

export interface ProductInfo {
  brand: string | null;
  /** The shop's category, e.g. « Soins visage ». */
  category: string | null;
  images: string[];
  description: string | null;
  /** « Gamme », « Emballage »… */
  details: { label: string; value: string }[];
}

export interface ProductPrices {
  ppv: number | null;
  pph: number | null;
  avg_pu: number | null;
  last_pu: number | null;
  last_pu_date: string | null;
  marge_pct: number | null;
}

export interface ProductStock {
  /** null = not in the last stock import. */
  current_stock: number | null;
  stock_min: number;
  stock_max: number;
  units_sold_12m: number;
  sales_from: string;
  sales_to: string;
  coverage_days: number | null;
  status: "sous-stock" | "ideal" | "a-surveiller" | "sur-stock" | "inconnu" | "negatif";
  expiry_date: string | null;
  zone: string | null;
}

export interface ProductMovement {
  kind: "achat" | "vente";
  date: string | null;
  /** Stock change: + bought, − sold. */
  quantity: number | null;
  unit_price: number | null;
  /** BL reference / ticket number. */
  document: string | null;
  /** Supplier / client. */
  party: string | null;
}

export interface ProductSheet {
  id: number;
  pid: string;
  product: string;
  laboratoire: string | null;
  category: string | null;
  category_type: "pharmacie" | "parapharmacie";
  tva: string | null;
  barcode1: string | null;
  barcode2: string | null;
  /** null = no scraped photo / description for this product. */
  info: ProductInfo | null;
  prices: ProductPrices;
  stock: ProductStock;
  /** 10 latest, newest first. */
  recent_movements: ProductMovement[];
  /** Fields the owner edited → their imported value (« Revenir à la valeur importée »). */
  imported: Partial<Record<EditField, string | number | null>>;
}

/** Fields the owner can change (« Modifier »), as PUT /products/{id} names them. Not the type
 *  (pharmacie / parapharmacie): it stays the catalogue's. */
export type EditField =
  | "product"
  | "laboratoire"
  | "category"
  | "tva"
  | "ppv"
  | "pph"
  | "zone"
  | "current_stock"
  | "stock_min"
  | "stock_max"
  | "expiry_date"
  | "barcode1"
  | "barcode2"
  | "description";

/** PUT /products/{id}: only the fields sent change; null = back to the imported value. */
export type ProductEditIn = Partial<Record<EditField, string | number | null>>;

// ── Statistiques (GET /products/{id}/stats) ────────────────────────────────

export interface MonthlySales {
  year: number;
  /** Units sold, January first (12 values). */
  sold: number[];
  sold_total: number;
  /** Units bought, January first (12 values). */
  bought: number[];
  bought_total: number;
}

export interface YearSummary {
  year: number;
  units_sold: number;
  /** Σ qty × PPV (Rapport rule). */
  ca: number;
  units_bought: number;
  amount_bought: number;
}

export interface ProductStats {
  /** « 12 mois » = the Stock page window. */
  sales_from: string;
  sales_to: string;
  units_30d: number;
  units_12m: number;
  ca_12m: number;
  avg_per_month: number;
  avg_per_day: number;
  months_without_sale: number;
  first_sale: string | null;
  last_sale: string | null;
  best_month: { month: string; units: number } | null;
  /** Newest year first. */
  monthly: MonthlySales[];
  /** Newest year first. */
  yearly: YearSummary[];
}

// ── Mouvements (GET /products/{id}/movements) ──────────────────────────────

export interface ProductMovementLine extends ProductMovement {
  /** The line's total, as in the file. */
  total: number | null;
  /** The import it came from. */
  filename: string | null;
}

export interface ProductMovementsResponse {
  data: ProductMovementLine[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
  /** Σ qty of the filtered purchase / sale lines. */
  units_bought: number;
  units_sold: number;
}

export interface MovementsFilters {
  page: number;
  limit: number;
  search: string;
  kind: "all" | "achat" | "vente";
  sort_by: string | null;
  sort_order: "asc" | "desc";
  date_from: string | null;
  date_to: string | null;
}
