import { request, fetchBlob } from "./client";

export type StatsKpis = {
  ventes_total: number;
  achats_total: number;
  ventes_count: number;
  achats_count: number;
};
export type MonthlyTrend = { month: string; ventes: number; achats: number };
export type TopCategory = { category: string; total: number };
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
export type StatsResponse = {
  kpis: StatsKpis;
  advanced_kpis: AdvancedKpis;
  tva: TvaStats;
  marge: MargeStats;
  type_breakdown: TypeBreakdown;
  monthly_trend: MonthlyTrend[];
  top_categories: TopCategory[];
};

export type MargeKpiItem = { label: string; value: number; qty: number } | null;
export type AnalyseMargeKpis = {
  total_ventes_dh: number;
  total_ventes_unites: number;
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

function buildQs(dateFrom?: string, dateTo?: string, categoryType?: string): string {
  const p = new URLSearchParams();
  if (dateFrom) p.set("date_from", dateFrom);
  if (dateTo) p.set("date_to", dateTo);
  if (categoryType && categoryType !== "all") p.set("category_type", categoryType);
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
  if (categoryType && categoryType !== "all") p.set("category_type", categoryType);
  if (mode) p.set("mode", mode);
  const qs = p.toString();
  return request<AnalyseMargeResponse>(`/stats/analyse-marge${qs ? `?${qs}` : ""}`);
};

export const exportExcel = (
  dateFrom?: string,
  dateTo?: string,
  categoryType: "all" | "pharmacie" | "parapharmacie" = "all",
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
  categoryType: "all" | "pharmacie" | "parapharmacie" = "all",
): Promise<Blob> => {
  const p = new URLSearchParams({ category_type: categoryType });
  if (dateFrom) p.set("date_from", dateFrom);
  if (dateTo) p.set("date_to", dateTo);
  return fetchBlob(`/admin/pharmacy/${pharmacyId}/stats/export-excel?${p}`);
};

export const getPharmacyStats = (pharmacyId: number, dateFrom?: string, dateTo?: string) => {
  const p = new URLSearchParams();
  if (dateFrom) p.set("date_from", dateFrom);
  if (dateTo) p.set("date_to", dateTo);
  const qs = p.toString();
  return request<StatsResponse>(`/admin/pharmacy/${pharmacyId}/stats${qs ? `?${qs}` : ""}`);
};
