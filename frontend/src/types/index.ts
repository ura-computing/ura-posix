// Single source of truth: enums, query keys, route paths, and shared interfaces.

export const ROLES = {
  ADMIN:     "admin",
  OWNER:     "owner",
  EMPLOYEE:  "employee",
  DEVELOPER: "developer",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];

export const STATUSES = {
  ACTIVE: "active",
  REVOKED: "revoked",
  PENDING: "pending",
  REJECTED: "rejected",
} as const;
export type Status = (typeof STATUSES)[keyof typeof STATUSES];

export const FEATURES = [
  "rapports", "import", "achats", "ventes",
  "stock", "analyse", "accounting", "alertes",
  "special_products",
] as const;
export type Feature = (typeof FEATURES)[number];

export const ROUTES = {
  HOME:              "/",
  LOGIN:             "/login",
  FORGOT_PASSWORD:   "/auth/forgot-password",
  SET_PASSWORD:      "/auth/set-password",
  ME:                "/auth/me",
  RAPPORT:           "/rapport",

  // Data modules (placeholders — sidebar items render disabled via ready:false until pages exist)
  ACHATS:            "/achats",
  VENTES:            "/ventes",
  STOCK:             "/stock",
  UPLOAD_FILE:       "/upload-file",
  ANALYSES:          "/analyses",
  RAPPORTS:          "/rapports",
  ALERTES:           "/alertes",
  COMPTABILITE:      "/comptabilite",
  PRODUITS_SPECIAUX: "/produits-speciaux",
  IMPORTS:           "/imports",

  // Gestion
  OWNER_EMPLOYEES:   "/owner/employees",

  // Admin
  ADMIN_PHARMACIES:  "/admin/pharmacies",
  ADMIN_PHARMACY:    "/admin/pharmacies/:id",
  ADMIN_CATALOGUE:   "/admin/catalogue",
  ADMIN_CATEGORIES:  "/admin/categories",
  ADMIN_DEVELOPERS:  "/admin/developers",

  // Owner — "Ma boutique en ligne" (3-tab page, gated by ?tab=)
  STORE_WEBSITE:     "/store-website",
  STORE_WEBSITE_NEW: "/store-website/new",

  // Developer — sibling top-level routes (not nested under /dev) so
  // "Demandes" and "Mes exports" feel independent in the URL too.
  DEV_DASHBOARD:     "/requests",
  DEV_REQUEST:       "/requests/:id",
  DEV_EDITOR:        "/requests/:id/editor",
  DEV_EXPORTS:       "/exports",

  // Public store preview (no app chrome, no auth)
  STORE_PREVIEW:     "/preview/:template/:page",
} as const;
export type Route = (typeof ROUTES)[keyof typeof ROUTES];

export const QUERY_KEYS = {
  ME:             ["me"] as const,
  DASHBOARD:      ["dashboard"] as const,
  VALIDATE_TOKEN: (token: string) => ["validate-token", token] as const,
  SESSIONS:       (userId: string) => ["sessions", userId] as const,
  IMPORTS:        ["imports"] as const,

  // Ventes (Page 3) — filter args part of key so each combo gets its own cache slot.
  // VENTES uses the full filter set (sort + page included). Surveillance counts strip
  // sort/page since they don't affect the count.
  VENTES:               (f: VentesFilters)    => ["ventes", f] as const,
  VENTES_CATEGORIES:    ["ventes-categories"] as const,
  VENTES_TVA_RATES:     ["ventes-tva-rates"] as const,
  VENTES_SURVEILLANCE:  (f: VentesFiltersKey) => ["ventes-surveillance", f] as const,
  VENTES_SUGGESTIONS:   (q: string)           => ["ventes-suggestions", q] as const,
  // Gauge ignores pagination, sort, AND surveillance — same filters as the
  // achat supplier-summary minus the sort/page axis.
  VENTES_DISCOUNT_SUMMARY: (f: Omit<VentesFilters, "page" | "limit" | "sort_by" | "sort_order" | "surveillance">) =>
    ["ventes-discount-summary", f] as const,

  // Achats (Page 4)
  ACHATS:                   (f: AchatsFilters) => ["achats", f] as const,
  ACHATS_CATEGORIES:        ["achats-categories"] as const,
  ACHATS_TVA_RATES:         ["achats-tva-rates"] as const,
  ACHATS_SUPPLIER_SUMMARY:  (f: Omit<AchatsFilters, "page" | "limit" | "sort_by" | "sort_order">) => ["achats-supplier-summary", f] as const,
  ACHATS_SUGGESTIONS:       (q: string) => ["achats-suggestions", q] as const,

  // Stock (Page 6) — separate "full" + "filtered" keys per dual-fetch pattern.
  STOCK_ABCD_FULL:     (df: string | null, dt: string | null) =>
    ["stock-abcd-full", df ?? "", dt ?? ""] as const,
  STOCK_ABCD_FILTERED: (f: StockFilters) => ["stock-abcd-filtered", f] as const,
  PEREMPTIONS:         ["peremptions"] as const,

  // Rapport — owner endpoints. Filter args are part of the key so each
  // (window, category) combo gets its own cache slot.
  STATS:          (df: string | null, dt: string | null, ct: string, nd: boolean) =>
    ["stats", df ?? "", dt ?? "", ct, nd] as const,
  MARGIN_ALERTS:  (df: string | null, dt: string | null, ct: string) =>
    ["margin-alerts", df ?? "", dt ?? "", ct] as const,
  VENTES_SANS_ACHAT: (df: string | null, dt: string | null, ct: string) =>
    ["ventes-sans-achat", df ?? "", dt ?? "", ct] as const,
  STOCK_SUMMARY:  ["stock-summary"] as const,

  // Rapport — admin endpoints.
  ADMIN_STATS:        ["admin-stats"] as const,
  ADMIN_PHARMACIES:   ["admin-pharmacies"] as const,
  ADMIN_PHARM_STATS:  (id: number, df: string | null, dt: string | null, ct: string, nd: boolean) =>
    ["admin-pharm-stats", id, df ?? "", dt ?? "", ct, nd] as const,
  ADMIN_PHARM_MARGE:  (id: number, df: string | null, dt: string | null, ct: string) =>
    ["admin-pharm-marge", id, df ?? "", dt ?? "", ct] as const,
  ADMIN_PHARM_STOCK:  (id: number) =>
    ["admin-pharm-stock", id] as const,
  ADMIN_PHARM_ANALYSE: (id: number, mode: string, df: string | null, dt: string | null, ct: string) =>
    ["admin-pharm-analyse", id, mode, df ?? "", dt ?? "", ct] as const,

  // Admin /admin/categories — global category-suffix mappings
  CATEGORY_SUFFIXES:  ["category-suffixes"] as const,

  // Analyse de marge (Page 11) — 7 group-by modes + Liste CSV upload.
  // Cache slot per (mode, window, categoryType). Liste keyed on items hash.
  ANALYSE_MARGE: (mode: MargeMode, df: string | null, dt: string | null, ct: string) =>
    ["analyse-marge", mode, df ?? "", dt ?? "", ct] as const,
  ANALYSE_LISTE: (itemsKey: string, df: string | null, dt: string | null, ct: string) =>
    ["analyse-liste", itemsKey, df ?? "", dt ?? "", ct] as const,

  // Admin catalog (F5) — Medicament CRUD + categories list.
  CATALOG:             (f: CatalogFilters) => ["catalog", f] as const,
  CATALOG_PREFIX:      ["catalog"] as const,                 // invalidation prefix
  CATALOG_CATEGORIES:  ["catalog-categories"] as const,

  // Produits spéciaux (F17) — owner-managed product exclusions + autocomplete.
  SPECIAL_PRODUCTS:        ["special-products"] as const,
  MEDICAMENT_SUGGESTIONS:  (q: string) => ["medicament-suggestions", q] as const,

  // Comptabilité — payment entries per (month, method).
  PAYMENTS:                (month?: string) => ["payments", month ?? null] as const,
  PAYMENTS_PREFIX:         ["payments"] as const,

  // Aggregate prefixes — used by produits-spéciaux to invalidate every cache
  // that filters via non_declared_sub when an exclusion is added/removed.
  STATS_PREFIX:           ["stats"] as const,
  MARGIN_ALERTS_PREFIX:   ["margin-alerts"] as const,
  VENTES_SANS_ACHAT_PREFIX: ["ventes-sans-achat"] as const,
  ANALYSE_MARGE_PREFIX:   ["analyse-marge"] as const,
  STOCK_ABCD_FULL_PREFIX: ["stock-abcd-full"] as const,
  STOCK_ABCD_FILTERED_PREFIX: ["stock-abcd-filtered"] as const,
  VENTES_PREFIX:          ["ventes"] as const,
  ACHATS_PREFIX:          ["achats"] as const,
} as const;

// ── Domain objects ─────────────────────────────────────────────────────────

export interface User {
  id:            number;
  email:         string;
  name:          string | null;
  phone:         string | null;
  role:          Role;
  status:        Status;
  pharmacy_id:   number | null;
  last_login_at: string | null;
}

export interface Pharmacy {
  id:   number;
  name: string;
  code: string | null;
}

/** Backend response shape from GET /v1/auth/me. */
export interface MeResponse {
  user:        User;
  pharmacy:    Pharmacy | null;
  permissions: Feature[];
}

/**
 * Flat shape exposed by useMe() to pages and components. Derived from
 * MeResponse by collapsing user.* one level so pages can do me.name / me.role
 * directly without the .user indirection.
 */
export interface Me {
  id:          string;          // stringified user.id for stable cache keys
  email:       string;
  name:        string;          // never null in the flat shape (falls back to email)
  phone?:      string;
  role:        Role;
  status:      Status;
  pharmacy?:   { id: number; name: string; code: string | null };
  permissions: Feature[];
}

export interface Session {
  id:             string;
  device_label:   string;
  ip:             string;
  last_active_at: string;       // ISO timestamp
  is_current:     boolean;
}

// ── Request/response shapes for the API layer ──────────────────────────────

export interface LoginRequest {
  email:    string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ValidateTokenResponse {
  is_setup:  boolean;
  full_name: string;
}

export interface SetPasswordRequest {
  token:    string;
  password: string;
}

export interface UpdateProfileRequest {
  name:  string;
  phone: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password:     string;
}

export interface ApiError {
  status: number;
  detail: string;
}

// ── Rapport / Stats response shapes (mirrors backend/schemas/stats.py) ────

export type CategoryType = "all" | "pharmacie" | "parapharmacie";

export interface StatsKpis {
  ventes_total: number;
  achats_total: number;
  ventes_count: number;
  achats_count: number;
}

export interface PreviousKpis {
  ventes_total: number;
  achats_total: number;
  marge_pct:    number;
}

export interface DayPoint  { date: string; total: number; }
export interface DayCount  { date: string; count: number; }

export interface AdvancedKpis {
  ticket_moyen:           number;
  vente_moyenne_par_jour: number;
  best_day_dh:     DayPoint | null;
  worst_day_dh:    DayPoint | null;
  best_day_count:  DayCount | null;
  worst_day_count: DayCount | null;
}

export interface TvaSummary  { tva_encaissee:  number; tva_payee:      number; tva_a_declarer: number; }
export interface MargeSummary { marge_pct: number; marge_brute_dh: number; marge_nette_dh: number; }
export interface TypeBreakdown {
  pharmacie:     { ventes_total: number };
  parapharmacie: { ventes_total: number };
}
export interface MonthlyTrendPoint { month: string; ventes: number; achats: number; }
export interface TopCategoryRow    { category: string; total: number; marge_pct: number | null; }

export interface StatsResponse {
  kpis:           StatsKpis;
  previous_kpis:  PreviousKpis;
  advanced_kpis:  AdvancedKpis;
  tva:            TvaSummary;
  marge:          MargeSummary;
  type_breakdown: TypeBreakdown;
  monthly_trend:  MonthlyTrendPoint[];
  top_categories: TopCategoryRow[];
}

export interface MarginAlertProduct { product: string; marge_pct: number; ca: number; }
export interface MarginAlertBracket {
  count: number; total_ca: number; total_margin_dh: number; products: MarginAlertProduct[];
}
export interface MarginAlertsResponse {
  negative:  MarginAlertBracket;
  low:       MarginAlertBracket;
  medium:    MarginAlertBracket;
  high:      MarginAlertBracket;
  very_high: MarginAlertBracket;
}

export interface VentesSansAchatProduct {
  product:         string;
  category:        string | null;
  ppv:             number | null;
  units_sold:      number;
  ca:              number;
  last_vente_date: string | null;
}
export interface VentesSansAchatResponse {
  count:            number;
  total_ca:         number;
  total_units_sold: number;
  products:         VentesSansAchatProduct[];
}

export interface StockSummaryResponse {
  total_references: number;
  ppv_potentiel:    number;
  sous_stock_count: number;
  sur_stock_count:  number;
  in_band_count:    number;
  health_pct:       number;
}

export interface AdminStatsResponse {
  total_pharmacies:         number;
  total_active_users:       number;
  total_catalog_items:      number;
  pending_catalog_requests: number;
}

export interface AdminPharmacyRow { id: number; name: string; code: string | null; }


// ── /admin/categories (category-suffixes) ────────────────────────────────────
// Global table — admin-managed, NOT per-pharmacy. Reused by the Ventes ledger
// to render the colored suffix pill on each row.

export interface CategorySuffixOut {
  id:       number;
  category: string;
  suffix:   string;
  color:    SuffixColor | null;
}

export interface CategorySuffixIn {
  category: string;
  suffix:   string;
  color:    SuffixColor | null;
}


// ── Upload-file types ────────────────────────────────────────────────────────

export type DocType = "achat" | "vente" | "stock";

export type ImportBatchStatus = "in_progress" | "success" | "cancelled" | "error";

/** Response from /v1/uploads/{achat|vente}{,-json} */
export interface UploadTxResult {
  inserted: number;
  skipped:  number;              // total = no_pid + no_medicament + duplicate
  /** Per-reason breakdown so the post-upload card can show an honest cause
   *  instead of blaming every skip on "doublons". */
  skipped_no_pid:        number;
  skipped_no_medicament: number;
  skipped_duplicate:     number;
  batch_id: number;
  /** F19: products that didn't exist in the catalogue and were created during
   *  this import. Owner sees them as "needs admin classification" — they'll
   *  appear in /admin/catalogue under the "Non classés" filter. */
  new_medicaments: {
    count:  number;
    sample: string[];     // first 10 product names
  };
}

/** Response from /v1/uploads/stock-json (per chunk). The frontend
 *  accumulates these across chunks into the final UploadProgress state. */
export interface UploadStockResult {
  inserted:        number;
  skipped_unknown: { pid: string; product: string | null }[];
  total_rows:      number;
  batch_id:        number;
  /** F19: medicaments created during this chunk (PIDs not yet in catalogue).
   *  Surfaced to the owner so admin can classify via /admin/catalogue. */
  new_medicaments?: { count: number; sample: string[] };
}

/** Response from PATCH /v1/uploads/batches/{id} */
export interface BatchPatchResult {
  id:             number;
  status:         ImportBatchStatus;
  error_message:  string | null;
  /** Number of Achat/Vente rows the PATCH deleted (only on status='cancelled'). */
  deleted_rows:   number;
}

/** A row from GET /v1/data/imports — drives the /imports page. */
export interface DataImport {
  id:                    number;
  file_type:             DocType;
  filename:              string | null;
  rows_inserted:         number;
  rows_skipped:          number;
  status:                ImportBatchStatus;
  error_message:         string | null;
  imported_at:           string;
  /** Who did the import. NULL for pre-migration batches. */
  created_by_full_name:  string | null;
  created_by_email:      string | null;
  /** Soft-delete audit. `deleted_at` set ⇒ the row renders as history. */
  deleted_at:            string | null;
  deleted_by_full_name:  string | null;
  deleted_by_email:      string | null;
}

export interface DataImportsResponse {
  data: DataImport[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
}

export interface StatsFilters {
  date_from:            string | null;
  date_to:              string | null;
  category_type:        CategoryType;
  include_non_declared: boolean;
}


// ── Comptabilité — manual monthly payment-method entries (Page 5) ──────────

export const PAYMENT_METHODS = ["tpe", "especes", "cheques", "virement"] as const;
export type  PaymentMethod   = (typeof PAYMENT_METHODS)[number];

export interface PaymentEntryIn {
  month:                string;          // "YYYY-MM"
  method:               PaymentMethod;
  pharmacie_amount:     number;
  parapharmacie_amount: number;
  count:                number;
}

export interface PaymentEntry extends PaymentEntryIn { id: number; }


// ── Ventes (Page 3) ────────────────────────────────────────────────────────

/** Surveillance tab keys. Backend predicate: see routers/transactions.py. */
export const SURVEILLANCE_TABS = {
  ALL_FLAGGED:    "all_flagged",
  MARGE_NEGATIVE: "marge_negative",
  MARGE_LOW:      "marge_low",
  REMISES_HIGH:   "remises_high",
} as const;
export type SurveillanceTab = (typeof SURVEILLANCE_TABS)[keyof typeof SURVEILLANCE_TABS];

/** SuffixBadge palette — kept in sync with backend ALLOWED_COLORS in category_suffixes.py */
export const SUFFIX_COLORS = ["teal", "blue", "purple", "amber", "rose", "emerald", "orange", "pink"] as const;
export type SuffixColor = (typeof SUFFIX_COLORS)[number];

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

/** Stable serialization key used in QUERY_KEYS — excludes sort + pagination so a
 *  sort change doesn't bust the same-page cache. */
export type VentesFiltersKey = Omit<VentesFilters, "sort_by" | "sort_order">;


// ── Stock (Page 6) ─────────────────────────────────────────────────────────

export type AbcdClass   = "A" | "A-" | "B+" | "B" | "C" | "C-" | "C-N" | "D";
export type StockStatus = "sous-stock" | "ideal" | "a-surveiller" | "sur-stock" | "inconnu" | "negatif";

export interface StockRow {
  product:         string;
  category:        AbcdClass;
  units_sold_12m:  number;
  stock_min:       number;
  stock_max:       number;
  current_stock:   number | null;
  ppv:             number | null;
  avg_pu:          number | null;
  status:          StockStatus;
}

export interface StockAbcdResponse {
  distribution:     Partial<Record<AbcdClass, number>>;
  total_references: number;
  ppv_potentiel:    number;
  products:         StockRow[];
}

export interface StockFilters {
  date_from:    string | null;
  date_to:      string | null;
  class_filter: AbcdClass | null;
  /** Empty string "" = no filter. Backend accepts the values listed in StockStatus. */
  status:       string | null;
  search:       string;
  sort_by:      string | null;
  sort_order:   "asc" | "desc";
}

export interface PeremptionProduct {
  product:     string;
  expiry_date: string | null;   // null for the no_date bucket
  quantity:    number;
  ppv:         number;
}

export interface PeremptionBracket {
  count:          number;
  total_units:    number;
  purchase_value: number;
  sale_value:     number;
  products:       PeremptionProduct[];
}

/** 4 mutually-exclusive expiry-proximity buckets. NULL-expiry rows surface
 *  in their own `no_date` data-quality bucket so the team can chase
 *  missing Sobrus dates. */
export interface PeremptionsResponse {
  expired: PeremptionBracket;    // expiry_date < today
  near_2w: PeremptionBracket;    // today ≤ expiry ≤ today + 14d
  near_1m: PeremptionBracket;    // today + 14d < expiry ≤ today + 30d
  no_date: PeremptionBracket;    // expiry_date IS NULL
}


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


// ── Analyse de marge (Page 11) ──────────────────────────────────────────────

export const MARGE_MODES = [
  "produit", "categorie", "laboratoire", "grossiste",
  "operateur", "mois", "annee", "liste",
] as const;
export type MargeMode = (typeof MARGE_MODES)[number];

/** UI labels in display order — locked from PG-017. */
export const MARGE_MODE_LABELS: Record<MargeMode, string> = {
  produit:     "Produit",
  categorie:   "Catégorie",
  laboratoire: "Laboratoire",
  grossiste:   "Grossistes",
  operateur:   "Client",
  mois:        "Mois",
  annee:       "Année",
  liste:       "Liste",
};

export interface MargeKpiPoint {
  label: string;
  value: number;
  qty:   number;
}

export interface AnalyseMargeKpis {
  total_ventes_dh:       number;
  total_ventes_unites:   number;
  total_units_available: number | null;
  total_pu_purchased:    number | null;
  ppv_total_available:   number | null;
  marge_pct_avg:         number | null;
  marge_pct_min:         MargeKpiPoint | null;
  marge_pct_max:         MargeKpiPoint | null;
  marge_dh_avg:          number | null;
  marge_dh_min:          MargeKpiPoint | null;
  marge_dh_max:          MargeKpiPoint | null;
  difference_gain_dh:    number | null;
}

/** Wide-row shape — every mode's columns are optional fields on the same row type.
 *  Frontend renders only the columns relevant to the active mode. */
export interface AnalyseMargeRow {
  // produit
  product?:          string;
  pid?:              string;
  stock_dispo?:      number | null;
  qty?:              number;
  ca?:               number;
  ppv?:              number | null;
  pu?:               number | null;
  prix_max?:         number | null;
  prix_min?:         number | null;
  prix_avg?:         number | null;
  marge_pct?:        number | null;
  marge_dh?:         number | null;
  marge_pct_best?:   number | null;
  marge_pct_worst?:  number | null;
  marge_dh_best?:    number | null;
  marge_dh_worst?:   number | null;
  ppv_potentiel?:    number | null;
  // categorie / laboratoire / grossiste — weighted aggregates
  category?:         string | null;
  laboratoire?:      string;
  grossiste?:        string;
  marge_pct_avg?:    number | null;
  marge_dh_avg?:     number | null;
  total_achat_cost?: number | null;
  // operateur / mois
  client?:           string;
  mois?:             string;
  nb_transactions?:  number;
  // annee (pivot)
  annee?:            number;
  m01?: number; m02?: number; m03?: number; m04?: number;
  m05?: number; m06?: number; m07?: number; m08?: number;
  m09?: number; m10?: number; m11?: number; m12?: number;
  // liste
  match_status?:     "found" | "not_found";
  tva?:              string | null;
}

export interface AnalyseMargeResponse {
  mode:  MargeMode;
  kpis:  AnalyseMargeKpis;
  rows:  AnalyseMargeRow[];
}

export interface ListeItem {
  name:     string;
  pid?:     string;
  barcode1?: string;
  barcode2?: string;
}

export interface ListeRequest {
  items:         ListeItem[];
  date_from?:    string | null;
  date_to?:      string | null;
  category_type: string;
}

export interface AnalyseFilters {
  date_from:     string | null;
  date_to:       string | null;
  category_type: string;
}


// ── Admin Catalog (F5 — Medicament CRUD + CSV import) ──────────────────────

export type ProductType = "pharmacie" | "parapharmacie";

export interface Medicament {
  id:           number;
  pid:          string;
  product:      string;
  tva:          string | null;
  pph:          number | null;
  ppv:          number | null;
  category:     string | null;
  barcode1:     string | null;
  barcode2:     string | null;
  laboratoire:  string | null;
  product_type: ProductType | null;
  created_at:   string;
  updated_at:   string | null;
}

export interface MedicamentInput {
  product:      string;
  tva?:         string | null;
  pph?:         number | null;
  ppv?:         number | null;
  category?:    string | null;
  barcode1?:    string | null;
  barcode2?:    string | null;
  laboratoire?: string | null;
  product_type?: ProductType | null;
}

export interface CatalogFilters {
  search:     string;
  category:   string[];
  /** "unclassified" surfaces rows where product_type IS NULL (admin queue). */
  type:       ProductType | "unclassified" | null;
  sort_by:    string;
  sort_order: "asc" | "desc";
  page:       number;
  limit:      number;
}

export interface CatalogListResponse {
  data:       Medicament[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
}

export interface CatalogImportResponse {
  total_rows: number;
  inserted:   number;
  updated:    number;
  skipped:    number;
  errors:     string[];
}


// ── Produits spéciaux (F17 — owner-managed product exclusions) ─────────────

export interface SpecialProduct {
  medicament_id: number;
  product:       string;
  pid:           string;
  category:      string | null;
  created_at:    string;
}

export interface MedicamentSuggestion {
  id:        number;
  pid:       string;
  product:   string;
  category:  string | null;
  nb_ventes: number;
}

export interface SpecialProductBulkResult {
  inserted:        number;
  already_special: number;
  products:        SpecialProduct[];
}

export interface SpecialProductReintegrateResult {
  reintegrated:   number;
  not_special:    number;
  medicament_ids: number[];
}


// ── Admin · permission management (/admin/pharmacies) ───────────────────────

export type MemberRole   = "owner" | "employee";
export type MemberStatus = "active" | "inactive";

/** Subset of UserPermission rows + denormalized member info, returned in
 *  PharmacyDetail.members and on user-mutation responses. */
export interface MemberOut {
  id:                  number;
  full_name:           string | null;
  email:               string;
  role:                MemberRole;
  status:              MemberStatus;
  granted_permissions: string[];
}

export interface PharmacyListRow {
  id:                number;
  name:              string;
  code:              string | null;
  city:              string | null;
  members_count:     number;
  member_initials:   string[];
  enabled_features:  string[];
  archived_at:       string | null;
}

export interface PharmacyDetail {
  id:               number;
  name:             string;
  code:             string | null;
  city:             string | null;
  address:          string | null;
  phone:            string | null;
  email:            string | null;
  archived_at:      string | null;
  enabled_features: string[];
  members:          MemberOut[];
  /** Union of active owners' enabled permissions. Used as the second
   *  ceiling in the admin's permission dialog when editing an employee. */
  owners_union_permissions: string[];
}

export interface PharmacyIn {
  name:    string;
  code?:   string | null;
  city?:   string | null;
  address?: string | null;
  phone?:  string | null;
  email?:  string | null;
}

export interface CreateUserIn {
  full_name?:  string | null;
  email:       string;
  role:        MemberRole;
  pharmacy_id: number;
}

/** Response from POST /admin/pharmacies/{id}/users — temp_password is one-time
 *  cleartext for the admin's mailto handoff; never persisted server-side. */
export interface CreateUserOut {
  member:        MemberOut;
  temp_password: string;
}

export interface ResetPasswordOut {
  user_id:       number;
  temp_password: string;
}


/** Owner-side /owner/employees one-shot fetch. Includes the contextual ceiling
 *  info the EmployeePermissionsDialog needs (pharmacy features + owner's own
 *  permissions) so it can render the 2-layer ceiling without a second call. */
export interface OwnerEmployeesResponse {
  employees:         MemberOut[];
  pharmacy_features: string[];
  my_permissions:    string[];
}