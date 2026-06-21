import { api } from "@/api/client";
import type {
  AdminPharmacyRow,
  AdminStatsResponse,
  AnalyseFilters,
  AnalyseMargeResponse,
  ListeRequest,
  MarginAlertsResponse,
  MargeMode,
  PeremptionsResponse,
  StatsFilters,
  StatsResponse,
  StockAbcdResponse,
  StockFilters,
  StockSummaryResponse,
} from "@/types";


function qs(filters: Partial<StatsFilters>): string {
  const params = new URLSearchParams();
  if (filters.date_from)            params.set("date_from",            filters.date_from);
  if (filters.date_to)              params.set("date_to",              filters.date_to);
  if (filters.category_type)        params.set("category_type",        filters.category_type);
  if (filters.include_non_declared) params.set("include_non_declared", "true");
  const s = params.toString();
  return s ? `?${s}` : "";
}


// ── Owner endpoints ──────────────────────────────────────────────────────────

export function getStats(filters: StatsFilters): Promise<StatsResponse> {
  return api<StatsResponse>(`/stats${qs(filters)}`);
}

export function getMarginAlerts(filters: Omit<StatsFilters, "include_non_declared">): Promise<MarginAlertsResponse> {
  return api<MarginAlertsResponse>(`/stats/margin-alerts${qs(filters)}`);
}

export function getStockSummary(): Promise<StockSummaryResponse> {
  return api<StockSummaryResponse>("/stats/stock-summary");
}


// ── Admin endpoints ──────────────────────────────────────────────────────────

export function getAdminStats(): Promise<AdminStatsResponse> {
  return api<AdminStatsResponse>("/admin/stats");
}

export function getAdminPharmacies(): Promise<AdminPharmacyRow[]> {
  return api<AdminPharmacyRow[]>("/admin/pharmacies");
}

export function getAdminPharmacyStats(pharmacyId: number, filters: StatsFilters): Promise<StatsResponse> {
  return api<StatsResponse>(`/admin/pharmacy/${pharmacyId}/stats${qs(filters)}`);
}

export function getAdminPharmacyMarginAlerts(
  pharmacyId: number,
  filters: Omit<StatsFilters, "include_non_declared">,
): Promise<MarginAlertsResponse> {
  return api<MarginAlertsResponse>(`/admin/pharmacy/${pharmacyId}/stats/margin-alerts${qs(filters)}`);
}

export function getAdminPharmacyStockSummary(pharmacyId: number): Promise<StockSummaryResponse> {
  return api<StockSummaryResponse>(`/admin/pharmacy/${pharmacyId}/stats/stock-summary`);
}

// ── Stock (Page 6) ──────────────────────────────────────────────────────────

function stockQs(f: Partial<StockFilters>): string {
  const p = new URLSearchParams();
  if (f.date_from)    p.set("date_from",    f.date_from);
  if (f.date_to)      p.set("date_to",      f.date_to);
  if (f.class_filter) p.set("class_filter", f.class_filter);
  if (f.status)       p.set("status",       f.status);
  if (f.search)       p.set("search",       f.search);
  if (f.sort_by)      p.set("sort_by",      f.sort_by);
  if (f.sort_order)   p.set("sort_order",   f.sort_order);
  return p.toString();
}

export function listStockAbcd(filters: Partial<StockFilters>): Promise<StockAbcdResponse> {
  const qsStr = stockQs(filters);
  return api(qsStr ? `/stats/stock-abcd?${qsStr}` : `/stats/stock-abcd`);
}

export function listPeremptions(): Promise<PeremptionsResponse> {
  return api(`/stats/peremptions`);
}

// ── Analyse de marge (Page 11) ──────────────────────────────────────────────

export function getAnalyseMarge(
  filters: AnalyseFilters,
  mode:    MargeMode,
): Promise<AnalyseMargeResponse> {
  const p = new URLSearchParams();
  p.set("mode", mode);
  if (filters.date_from)     p.set("date_from", filters.date_from);
  if (filters.date_to)       p.set("date_to",   filters.date_to);
  if (filters.category_type) p.set("category_type", filters.category_type);
  return api<AnalyseMargeResponse>(`/stats/analyse-marge?${p.toString()}`);
}

export function postAnalyseListe(body: ListeRequest): Promise<AnalyseMargeResponse> {
  return api<AnalyseMargeResponse>("/stats/analyse-liste", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
}
