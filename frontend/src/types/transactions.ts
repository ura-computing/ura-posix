/** Ventes + achats lists (mirrors backend/schemas/transactions.py). */

import type { SuffixColor } from "./catalog";

// ── Ventes (Page 3) ────────────────────────────────────────────────────────

/** Surveillance tab keys. Backend predicate: see routers/transactions.py. */
export const SURVEILLANCE_TABS = {
  ALL_FLAGGED:    "all_flagged",
  MARGE_NEGATIVE: "marge_negative",
  MARGE_LOW:      "marge_low",
  REMISES_HIGH:   "remises_high",
} as const;
export type SurveillanceTab = (typeof SURVEILLANCE_TABS)[keyof typeof SURVEILLANCE_TABS];


export interface VenteRow {
  id:                     number;
  date:                   string | null;
  transaction_ref:        string | null;
  transaction_ref_final:  string | null;
  transaction_ref_color:  SuffixColor | null;
  client:                 string | null;
  pid:                    string | null;
  product:                string | null;
  category:               string | null;
  /** Mirrors Medicament.product_type. Stored value — set at catalog import, admin override. */
  category_type:          "pharmacie" | "parapharmacie" | null;
  tva:                    string | null;
  ppv:                    number | null;
  quantity:               number | null;
  discount:               number | null;
  unit_price:             number | null;
  subtotal:               number | null;
  total:                  number | null;
  avg_pu:                 number | null;
  import_batch_id:        number | null;
}

export interface VentesSummary {
  rows_total:    number;
  tva_collected: number;
  grand_total:   number;
}

export interface VentesListResponse {
  data:       VenteRow[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
  summary:    VentesSummary;
}

export interface VentesSuggestions {
  products: string[];
  clients:  string[];
  refs:     string[];
}

export interface VentesSurveillanceCounts {
  all_flagged:    number;
  marge_negative: number;
  marge_low:      number;
  remises_high:   number;
}

export interface VentesFilters {
  page:                 number;
  limit:                number;
  date_from:            string | null;
  date_to:              string | null;
  search:               string;
  category:             string[];
  tva:                  string[];
  surveillance:         SurveillanceTab | null;
  include_non_declared: boolean;
  sort_by:              string | null;
  sort_order:           "asc" | "desc";
}

/** Stable serialization key used in API query keys — excludes sort + pagination so a
 *  sort change doesn't bust the same-page cache. */
export type VentesFiltersKey = Omit<VentesFilters, "sort_by" | "sort_order">;


// ── Achats (Page 4) ────────────────────────────────────────────────────────

export interface AchatRow {
  id:                  number;
  delivery_date:       string | null;
  delivery_ref:        string | null;
  delivery_ref_final:  string | null;
  delivery_ref_color:  SuffixColor | null;
  supplier:            string | null;
  pid:                 string | null;
  product:             string | null;
  category:            string | null;
  category_type:       "pharmacie" | "parapharmacie" | null;
  tva:                 string | null;
  quantity:            number | null;
  pph:                 number | null;
  unit_price:          number | null;
  total:               number | null;
  expiry_date:         string | null;
  import_batch_id:     number | null;
}

export interface AchatsSummary {
  rows_total:  number;
  tva_payee:   number;
  grand_total: number;
}

export interface AchatsListResponse {
  data:       AchatRow[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
  summary:    AchatsSummary;
}

export interface AchatsSuggestions {
  products:  string[];
  suppliers: string[];
  refs:      string[];
}

export interface SupplierSummarySide {
  total_mad:  number;
  bl_count:   number;
  unit_count: number;
}

export interface AchatsSupplierSummary {
  grossiste:   SupplierSummarySide;
  direct_labo: SupplierSummarySide;
}


export interface DiscountSummarySide {
  total_mad:  number;
  count:      number;
  unit_count: number;
}


/** Split of the /ventes filtered set into discounted (Vente.discount > 0)
 *  vs full-price lines. Drives the remise-discipline gauge. */
export interface VentesDiscountSummary {
  discounted: DiscountSummarySide;
  full_price: DiscountSummarySide;
}

export interface AchatsFilters {
  page:       number;
  limit:      number;
  date_from:  string | null;
  date_to:    string | null;
  search:     string;
  category:   string[];
  tva:        string[];
  sort_by:    string | null;
  sort_order: "asc" | "desc";
}
