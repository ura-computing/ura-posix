import { request, fetchBlob } from "./client";
import { eCategoryType } from "@/types";

export type StatsKpis = {
  ventes_total: number;
  achats_total: number;
  ventes_count: number;
  achats_count: number;
};
export type MonthlyTrend = { month: string; ventes: number; achats: number };
export type TopCategory = { category: string; total: number; marge_pct: number | null };
export type AdvancedKpis = {
  ticket_moyen: number;
  vente_moyenne_par_jour: number;
  best_day_dh: { date: string; total: number } | null;
  worst_day_dh: { date: string; total: number } | null;
  best_day_count: { date: string; count: number } | null;
  worst_day_count: { date: string; count: number } | null;
};
export type TvaStats = { tva_encaissee: number; tva_payee: number; tva_a_declarer: number };
export type MargeStats = { marge_pct: number; marge_brute_dh: number; marge_nette_dh: number };
export type TypeBreakdown = {
  pharmacie: { ventes_total: number };
  parapharmacie: { ventes_total: number };
};
export type PreviousKpis = {
  ventes_total: number;
  achats_total: number;
};
export type StatsResponse = {
  kpis: StatsKpis;
  previous_kpis: PreviousKpis;
  advanced_kpis: AdvancedKpis;
  tva: TvaStats;
  marge: MargeStats;
  type_breakdown: TypeBreakdown;
  monthly_trend: MonthlyTrend[];
  top_categories: TopCategory[];
};

export type MarginAlertBracket = {
  count: number;
  total_ca: number;
  total_margin_dh: number;
  products: { product: string; marge_pct: number; ca: number }[];
};

export type MarginAlertsResponse = {
  negative: MarginAlertBracket;
  low: MarginAlertBracket;
  high: MarginAlertBracket;
  very_high: MarginAlertBracket;
};

export type MargeKpiItem = { label: string; value: number; qty: number } | null;
export type AnalyseMargeKpis = {
  total_ventes_dh: number;
  total_ventes_unites: number;
  total_units_available: number;
  total_pu_purchased: number;
  ppv_total_available: number;
  marge_pct_avg: number | null;
  marge_pct_min: MargeKpiItem;
  marge_pct_max: MargeKpiItem;
  marge_dh_avg: number | null;
  marge_dh_min: MargeKpiItem;
  marge_dh_max: MargeKpiItem;
  difference_gain_dh: number | null;
};
export type AnalyseMargeResponse = {
  kpis: AnalyseMargeKpis;
  rows: Record<string, unknown>[];
};

export type StockAbcdProduct = {
  product: string;
  category: string;
  units_sold_12m: number;
  stock_min: number;
  stock_max: number;
  current_stock: number | null;
  ppv: number | null;
  avg_pu: number | null;
};

export type StockAbcdResponse = {
  distribution: Record<string, number>;
  total_references: number;
  ppv_potentiel: number;
  products: StockAbcdProduct[];
};

export type PeremptionProduct = {
  product: string;
  expiry_date: string;
  quantity: number;
  ppv: number;
};

export type PeremptionBracket = {
  count: number;
  total_units: number;
  purchase_value: number;
  sale_value: number;
  products: PeremptionProduct[];
};

export type PeremptionsResponse = {
  expired: PeremptionBracket;
  very_close: PeremptionBracket;
  close: PeremptionBracket;
};

function buildQs(dateFrom?: string, dateTo?: string, categoryType?: string): string {
  const p = new URLSearchParams();
  if (dateFrom) p.set("date_from", dateFrom);
  if (dateTo) p.set("date_to", dateTo);
  if (categoryType && categoryType !== eCategoryType.ALL) p.set("category_type", categoryType);
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

export const getStats = (dateFrom?: string, dateTo?: string, categoryType?: string) =>
  request<StatsResponse>(`/stats${buildQs(dateFrom, dateTo, categoryType)}`);

export const analyseMarge = (
  dateFrom?: string,
  dateTo?: string,
  categoryType?: string,
  mode?: string,
) => {
  const p = new URLSearchParams();
  if (dateFrom) p.set("date_from", dateFrom);
  if (dateTo) p.set("date_to", dateTo);
  if (categoryType && categoryType !== eCategoryType.ALL) p.set("category_type", categoryType);
  if (mode) p.set("mode", mode);
  const qs = p.toString();
  return request<AnalyseMargeResponse>(`/stats/analyse-marge${qs ? `?${qs}` : ""}`);
};

export const exportExcel = (
  dateFrom?: string,
  dateTo?: string,
  categoryType: eCategoryType = eCategoryType.ALL,
): Promise<Blob> => {
  const p = new URLSearchParams({ category_type: categoryType });
  if (dateFrom) p.set("date_from", dateFrom);
  if (dateTo) p.set("date_to", dateTo);
  return fetchBlob(`/stats/export-excel?${p}`);
};

export const exportExcelForPharmacy = (
  pharmacyId: number,
  dateFrom?: string,
  dateTo?: string,
  categoryType: eCategoryType = eCategoryType.ALL,
): Promise<Blob> => {
  const p = new URLSearchParams({ category_type: categoryType });
  if (dateFrom) p.set("date_from", dateFrom);
  if (dateTo) p.set("date_to", dateTo);
  return fetchBlob(`/admin/pharmacy/${pharmacyId}/stats/export-excel?${p}`);
};

export const getMarginAlerts = (dateFrom?: string, dateTo?: string, categoryType?: string) =>
  request<MarginAlertsResponse>(`/stats/margin-alerts${buildQs(dateFrom, dateTo, categoryType)}`);

export const getPharmacyMarginAlerts = (pharmacyId: number, dateFrom?: string, dateTo?: string, categoryType?: string) =>
  request<MarginAlertsResponse>(`/admin/pharmacy/${pharmacyId}/stats/margin-alerts${buildQs(dateFrom, dateTo, categoryType)}`);

export const getPharmacyStats = (pharmacyId: number, dateFrom?: string, dateTo?: string, categoryType?: string) => {
  const p = new URLSearchParams();
  if (dateFrom) p.set("date_from", dateFrom);
  if (dateTo) p.set("date_to", dateTo);
  if (categoryType && categoryType !== eCategoryType.ALL) p.set("category_type", categoryType);
  const qs = p.toString();
  return request<StatsResponse>(`/admin/pharmacy/${pharmacyId}/stats${qs ? `?${qs}` : ""}`);
};

export const getStockAbcd = (dateFrom?: string, dateTo?: string) => {
  const p = new URLSearchParams();
  if (dateFrom) p.set("date_from", dateFrom);
  if (dateTo) p.set("date_to", dateTo);
  const qs = p.toString();
  return request<StockAbcdResponse>(`/stats/stock-abcd${qs ? `?${qs}` : ""}`);
};

export const getPharmacyStockAbcd = (pharmacyId: number, dateFrom?: string, dateTo?: string) => {
  const p = new URLSearchParams();
  if (dateFrom) p.set("date_from", dateFrom);
  if (dateTo) p.set("date_to", dateTo);
  const qs = p.toString();
  return request<StockAbcdResponse>(`/admin/pharmacy/${pharmacyId}/stats/stock-abcd${qs ? `?${qs}` : ""}`);
};

export const getPeremptions = (dateFrom?: string, dateTo?: string) =>
  request<PeremptionsResponse>(`/stats/peremptions${buildQs(dateFrom, dateTo)}`);

export const getPharmacyPeremptions = (pharmacyId: number, dateFrom?: string, dateTo?: string) =>
  request<PeremptionsResponse>(`/admin/pharmacy/${pharmacyId}/stats/peremptions${buildQs(dateFrom, dateTo)}`);

export const analyseMargeForPharmacy = (
  pharmacyId: number,
  dateFrom?: string,
  dateTo?: string,
  categoryType?: string,
  mode?: string,
) => {
  const p = new URLSearchParams();
  if (dateFrom) p.set("date_from", dateFrom);
  if (dateTo) p.set("date_to", dateTo);
  if (categoryType && categoryType !== eCategoryType.ALL) p.set("category_type", categoryType);
  if (mode) p.set("mode", mode);
  const qs = p.toString();
  return request<AnalyseMargeResponse>(`/admin/pharmacy/${pharmacyId}/stats/analyse-marge${qs ? `?${qs}` : ""}`);
};
