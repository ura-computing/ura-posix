/** Rapport / Comptabilité KPIs, alertes, stock, analyse de marge (mirrors backend/app/analytics/schemas.py). */

// ── Rapport / Stats response shapes (mirrors backend/app/analytics/schemas.py) ────

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
  marge_pct: number;
}

export interface DayPoint {
  date: string;
  total: number;
}
export interface DayCount {
  date: string;
  count: number;
}

export interface AdvancedKpis {
  ticket_moyen: number;
  vente_moyenne_par_jour: number;
  best_day_dh: DayPoint | null;
  worst_day_dh: DayPoint | null;
  best_day_count: DayCount | null;
  worst_day_count: DayCount | null;
}

export interface TvaSummary {
  tva_encaissee: number;
  tva_payee: number;
  tva_a_declarer: number;
}
export interface MargeSummary {
  marge_pct: number;
  marge_brute_dh: number;
  marge_nette_dh: number;
}
export interface TypeBreakdown {
  pharmacie: { ventes_total: number };
  parapharmacie: { ventes_total: number };
}
export interface MonthlyTrendPoint {
  label: string;
  ventes: number;
  achats: number;
}
export type TrendGranularity = "week" | "month" | "semester" | "year";
export interface TopCategoryRow {
  category: string;
  total: number;
  marge_pct: number | null;
}

export interface StatsResponse {
  kpis: StatsKpis;
  previous_kpis: PreviousKpis;
  advanced_kpis: AdvancedKpis;
  tva: TvaSummary;
  marge: MargeSummary;
  type_breakdown: TypeBreakdown;
  monthly_trend: MonthlyTrendPoint[];
  trend_granularity?: TrendGranularity; // optional: older mocks omit it; UI falls back to "month"
  top_categories: TopCategoryRow[];
}

export interface MarginAlertProduct {
  product: string;
  marge_pct: number;
  ca: number;
}
export interface MarginAlertBracket {
  count: number;
  total_ca: number;
  total_margin_dh: number;
  products: MarginAlertProduct[];
}
export interface MarginAlertsResponse {
  negative: MarginAlertBracket;
  low: MarginAlertBracket;
  medium: MarginAlertBracket;
  high: MarginAlertBracket;
  very_high: MarginAlertBracket;
}

export interface VentesSansAchatProduct {
  product: string;
  category: string | null;
  ppv: number | null;
  units_sold: number;
  ca: number;
  last_vente_date: string | null;
}
export interface VentesSansAchatResponse {
  count: number;
  total_ca: number;
  total_units_sold: number;
  products: VentesSansAchatProduct[];
}

export interface StockSummaryResponse {
  total_references: number;
  ppv_potentiel: number;
  sous_stock_count: number;
  sur_stock_count: number;
  in_band_count: number;
  health_pct: number;
}

export interface AdminStatsResponse {
  total_pharmacies: number;
  total_active_users: number;
  total_catalog_items: number;
  pending_catalog_requests: number;
}

export interface StatsFilters {
  date_from: string | null;
  date_to: string | null;
  category_type: CategoryType;
  include_non_declared: boolean;
}

// ── Stock (Page 6) ─────────────────────────────────────────────────────────

export type AbcdClass = "A" | "A-" | "B+" | "B" | "C" | "C-" | "C-N" | "D";
export type StockStatus = "sous-stock" | "ideal" | "a-surveiller" | "sur-stock" | "inconnu" | "negatif";

export interface StockRow {
  product: string;
  category: AbcdClass;
  units_sold_12m: number;
  stock_min: number;
  stock_max: number;
  current_stock: number | null;
  ppv: number | null;
  avg_pu: number | null;
  status: StockStatus;
}

export interface StockAbcdResponse {
  distribution: Partial<Record<AbcdClass, number>>;
  total_references: number;
  ppv_potentiel: number;
  products: StockRow[];
}

export interface StockFilters {
  date_from: string | null;
  date_to: string | null;
  class_filter: AbcdClass | null;
  /** Empty string "" = no filter. Backend accepts the values listed in StockStatus. */
  status: string | null;
  sort_by: string | null;
  sort_order: "asc" | "desc";
}

export interface PeremptionProduct {
  product: string;
  expiry_date: string | null; // null for the no_date bucket
  quantity: number;
  ppv: number;
}

export interface PeremptionBracket {
  count: number;
  total_units: number;
  purchase_value: number;
  sale_value: number;
  products: PeremptionProduct[];
}

/** 4 mutually-exclusive expiry-proximity buckets. NULL-expiry rows surface
 *  in their own `no_date` data-quality bucket so the team can chase
 *  missing Sobrus dates. */
export interface PeremptionsResponse {
  expired: PeremptionBracket; // expiry_date < today
  very_close: PeremptionBracket; // today ≤ expiry < today + 6 months (UI label "<30j" — old-app parity)
  close: PeremptionBracket; // today + 6m ≤ expiry < today + 12 months (UI label "<90j")
  no_date: PeremptionBracket; // expiry_date IS NULL
}

// ── Analyse de marge (Page 11) ──────────────────────────────────────────────

export const MARGE_MODES = [
  "produit",
  "categorie",
  "laboratoire",
  "grossiste",
  "operateur",
  "mois",
  "annee",
  "liste",
] as const;
export type MargeMode = (typeof MARGE_MODES)[number];

/** UI labels in display order — locked from PG-017. */
export const MARGE_MODE_LABELS: Record<MargeMode, string> = {
  produit: "Produit",
  categorie: "Catégorie",
  laboratoire: "Laboratoire",
  grossiste: "Grossistes",
  operateur: "Client",
  mois: "Mois",
  annee: "Année",
  liste: "Liste",
};

export interface MargeKpiPoint {
  label: string;
  value: number;
  qty: number;
}

export interface AnalyseMargeKpis {
  total_ventes_dh: number;
  total_ventes_unites: number;
  total_units_available: number | null;
  total_pu_purchased: number | null;
  ppv_total_available: number | null;
  marge_pct_avg: number | null;
  marge_pct_min: MargeKpiPoint | null;
  marge_pct_max: MargeKpiPoint | null;
  marge_dh_avg: number | null;
  marge_dh_min: MargeKpiPoint | null;
  marge_dh_max: MargeKpiPoint | null;
  difference_gain_dh: number | null;
}

/** Wide-row shape — every mode's columns are optional fields on the same row type.
 *  Frontend renders only the columns relevant to the active mode. */
export interface AnalyseMargeRow {
  // produit
  product?: string;
  pid?: string;
  stock_dispo?: number | null;
  qty?: number;
  ca?: number;
  ppv?: number | null;
  pu?: number | null;
  prix_max?: number | null;
  prix_min?: number | null;
  prix_avg?: number | null;
  marge_pct?: number | null;
  marge_dh?: number | null;
  marge_pct_best?: number | null;
  marge_pct_worst?: number | null;
  marge_dh_best?: number | null;
  marge_dh_worst?: number | null;
  ppv_potentiel?: number | null;
  // categorie / laboratoire / grossiste — weighted aggregates
  category?: string | null;
  laboratoire?: string;
  grossiste?: string;
  marge_pct_avg?: number | null;
  marge_dh_avg?: number | null;
  total_achat_cost?: number | null;
  // operateur / mois
  client?: string;
  mois?: string;
  nb_transactions?: number;
  // annee (pivot) — each month is {qty, ca} from the backend
  annee?: number;
  m01?: { qty: number; ca: number };
  m02?: { qty: number; ca: number };
  m03?: { qty: number; ca: number };
  m04?: { qty: number; ca: number };
  m05?: { qty: number; ca: number };
  m06?: { qty: number; ca: number };
  m07?: { qty: number; ca: number };
  m08?: { qty: number; ca: number };
  m09?: { qty: number; ca: number };
  m10?: { qty: number; ca: number };
  m11?: { qty: number; ca: number };
  m12?: { qty: number; ca: number };
  // liste
  match_status?: "found" | "not_found";
  tva?: string | null;
}

export interface AnalyseMargeResponse {
  mode: MargeMode;
  kpis: AnalyseMargeKpis;
  rows: AnalyseMargeRow[];
}

export interface ListeItem {
  name: string;
  pid?: string;
  barcode1?: string;
  barcode2?: string;
}

export interface ListeRequest {
  items: ListeItem[];
  date_from?: string | null;
  date_to?: string | null;
  category_type: string;
}

export interface AnalyseFilters {
  date_from: string | null;
  date_to: string | null;
  category_type: string;
  product?: string | null;
  search?: string | null;
}
