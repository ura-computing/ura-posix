/** Special products, BL and supplier exclusions (mirrors backend/app/accounting/exclusions/schemas.py). */

// ── Produits spéciaux (F17 — owner-managed product exclusions) ─────────────

export interface SpecialProduct {
  medicament_id: number;
  product: string;
  pid: string;
  category: string | null;
  notes: string | null;
  created_at: string;
}

export interface MedicamentSuggestion {
  id: number;
  pid: string;
  product: string;
  category: string | null;
  nb_ventes: number;
}

export interface SpecialProductBulkResult {
  inserted: number;
  already_special: number;
  products: SpecialProduct[];
}

export interface SpecialProductReintegrateResult {
  reintegrated: number;
  not_special: number;
  medicament_ids: number[];
}

// ── BL exclusions (PG-007) — owner-managed delivery-note exclusions ─────────
export interface BlLine {
  product: string | null;
  pid: string | null;
  quantity: number | null;
  unit_price: number | null;
  total: number | null;
}

export interface BlSummary {
  delivery_ref: string;
  supplier: string | null;
  delivery_date: string | null;
  total: number;
  nb_lines: number;
  nb_products: number;
  already_excluded: boolean;
  matched_products: string[]; // product name(s) matching the query (product search)
}

export interface BlDetail {
  delivery_ref: string;
  supplier: string | null;
  delivery_date: string | null;
  total: number;
  nb_lines: number;
  lines: BlLine[];
}

export interface BlExclusion {
  delivery_ref: string;
  supplier: string | null;
  delivery_date: string | null;
  total: number;
  nb_lines: number;
  notes: string | null;
  created_at: string;
}

export interface BlExclusionResult {
  excluded: number;
  already_excluded: number;
  item: BlExclusion | null;
}

export interface BlReintegrateResult {
  reintegrated: number;
  not_excluded: number;
  delivery_refs: string[];
}

// ── BL lines: one product left out on some BLs only (« Exclure un produit d'un BL ») ──
export interface ProductBlLine {
  delivery_ref: string;
  supplier: string | null;
  delivery_date: string | null;
  quantity: number;
  total: number;
  nb_lines: number;
  already_excluded: boolean;
  /** Set when already excluded (untick = reintegrate it). */
  exclusion_id: number | null;
}

export interface ProductBlLines {
  medicament_id: number;
  pid: string;
  product: string;
  /** Newest BL first. */
  lines: ProductBlLine[];
}

export interface BlLineExclusion {
  id: number;
  delivery_ref: string;
  supplier: string | null;
  delivery_date: string | null;
  medicament_id: number;
  pid: string;
  product: string;
  quantity: number;
  total: number;
  notes: string | null;
  created_at: string;
}

export interface BlLineExclusionResult {
  excluded: number;
  already_excluded: number;
  /** Every exclusion of these BLs (« Annuler » reintegrates them). */
  ids: number[];
}

export interface BlLineReintegrateResult {
  reintegrated: number;
  not_excluded: number;
}

// ── Supplier (fournisseur) exclusions — owner-managed, achats-side ──────────
export interface SupplierSummary {
  supplier: string;
  total: number;
  nb_lines: number;
  nb_products: number;
  last_date: string | null;
  already_excluded: boolean;
}

export interface SupplierExclusion {
  supplier: string;
  total: number;
  nb_lines: number;
  nb_products: number;
  last_date: string | null;
  notes: string | null;
  created_at: string;
}

export interface SupplierExclusionResult {
  excluded: number;
  already_excluded: number;
  item: SupplierExclusion | null;
}

export interface SupplierReintegrateResult {
  reintegrated: number;
  not_excluded: number;
  suppliers: string[];
}
