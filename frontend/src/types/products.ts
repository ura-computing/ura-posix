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
  /** « Observations » of the pharmacy on it (0 in the Excel export answer). */
  notes: number;
}

/** One « Observation » (GET /products/{id}/notes). */
export interface ProductNote {
  id: number;
  text: string;
  /** Name (else email) of who wrote it. */
  author: string;
  created_at: string;
  /** Its author or the owner. */
  can_delete: boolean;
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
  /** 5 latest, newest first. */
  recent_movements: ProductMovement[];
  /** Fields the owner edited → their imported value (« Revenir à la valeur importée »). */
  imported: Partial<Record<EditField, string | number | null>>;
  /** « Observations »: > 0 = their window opens with the page. */
  notes_count: number;
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

export interface PeriodFigures {
  sold: number;
  bought: number;
  /** Σ qty × PPV (Rapport rule). */
  ca: number;
  /** CA − units sold × average purchase price; null = never bought with a price. */
  marge: number | null;
  /** Distinct sale tickets. */
  transactions: number;
}

export interface MonthFigures {
  /** YYYY-MM */
  month: string;
  sold: number;
  bought: number;
  ca: number;
  marge: number | null;
}

export interface SupplierShare {
  /** null = no supplier name in the file. */
  supplier: string | null;
  quantity: number;
  /** % of every unit bought in the period. */
  pct: number | null;
}

export interface ProductStats {
  date_from: string;
  date_to: string;
  /** Just before: whole months → as many months (2025 → 2024), else as many days. */
  previous_from: string;
  previous_to: string;
  period: PeriodFigures;
  previous: PeriodFigures;
  /** The last 12 months (this month and the 11 before), oldest first. */
  monthly: MonthFigures[];
  /** Every supplier of the period, most units first (card: the 3 biggest + « Autres »). */
  suppliers: SupplierShare[];
  /** Each supplier's latest priced purchase, newest first (card: the 5 latest). */
  last_prices: SupplierPrice[];
  /** « Historique (par année) »: every year with a sale or a purchase, newest first. */
  history: YearHistory[];
}

export interface SupplierPrice {
  supplier: string | null;
  unit_price: number;
  date: string | null;
}

export interface YearHistory {
  year: number;
  /** Units sold, January first (12 values). */
  sold: number[];
  total: number;
  /** Σ qty × PPV (Rapport rule). */
  ca: number;
  /** Units bought, January first (12 values). */
  bought: number[];
  bought_total: number;
  /** Σ purchase line totals (as in the files). */
  spent: number;
}

// ── Traçabilité (GET /products/{id}/movements) ────────────────────────────

export interface ProductMovementLine extends ProductMovement {
  /** Its purchase / sale line (unique with `kind`). */
  id: number;
  /** Purchase: HH:MM of « Créée le » when it is the line's day; sale: null (Sobrus gives the day). */
  time: string | null;
  /** Purchase « Créée le » (date + hour, as in the file). */
  created_at: string | null;
  /** The line's total, as in the file. */
  total: number | null;
  /** Sale: « Remise » in %; purchase: null. */
  discount: number | null;
  /** Purchase: the lot's « Date de péremption ». */
  expiry_date: string | null;
  /** Purchase: « Stock min » / « Stock max » of the file. */
  stock_min: number | null;
  stock_max: number | null;
  /** The import that brought the line: when, who, which file. */
  imported_at: string | null;
  imported_by: string | null;
  filename: string | null;
}

export interface ProductMovementsResponse {
  data: ProductMovementLine[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
}

export interface MovementsFilters {
  page: number;
  limit: number;
  search: string;
  kind: "all" | "achat" | "vente";
  /** « date »: newest first; « kind »: purchases, then sales (each newest first). */
  order: "date" | "kind";
  sort_by: string | null;
  sort_order: "asc" | "desc";
  date_from: string | null;
  date_to: string | null;
}
