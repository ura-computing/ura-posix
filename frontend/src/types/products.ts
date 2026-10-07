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
}
