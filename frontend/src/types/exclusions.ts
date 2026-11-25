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

// ── BL exclusions (PG-007) — owner-managed delivery-note exclusions ─────────
export interface BlLine {
  product: string | null;
  pid: string | null;
  medicament_id: number | null;
  quantity: number | null;
  unit_price: number | null;
  total: number | null;
  /** This product left out on this BL only (its star filled); null = still in Comptabilité. */
  exclusion_id: number | null;
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

// ── BL lines: one product left out on one BL only (the star of a product line in a BL's content) ──
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
