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
