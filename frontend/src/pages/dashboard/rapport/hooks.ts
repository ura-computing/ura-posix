import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { URLS } from "@/api/urls";
import { QUERIES } from "@/api/queries";

import type {
  AdminPharmacyRow, AdminStatsResponse, AnalyseFilters, AnalyseMargeResponse, CategoryType, MargeMode,
  MarginAlertsResponse, StatsFilters, StatsResponse, StockSummaryResponse,
} from "@/types";


// ── Owner ────────────────────────────────────────────────────────────────────

export function useStats(filters: StatsFilters) {
  const q = useQuery({
    queryKey: QUERIES.stats.main(filters.date_from, filters.date_to, filters.category_type, filters.include_non_declared),
    queryFn:  () => api.get<StatsResponse>(URLS.stats.main, { params: filters }),
    staleTime: 60_000,
  });
  return { stats: q.data, isLoading: q.isLoading, isError: q.isError, error: q.error };
}

/** « Optimisation » tile: the /analyses gain (best ↔ worst product, mode produit)
 *  for the Rapport period + category. Same key + URL as /analyses → shared cache. */
export function useOptimisationGain(filters: StatsFilters) {
  const q = useQuery({
    queryKey: QUERIES.stats.analyseMarge("produit", filters.date_from, filters.date_to, filters.category_type, null),
    queryFn:  () => api.get<AnalyseMargeResponse>(URLS.stats.analyseMarge, { params: {
      mode: "produit", date_from: filters.date_from, date_to: filters.date_to, category_type: filters.category_type,
    } }),
    staleTime: 60_000,
  });
  return q.data?.kpis.difference_gain_dh ?? null;
}


export function useMarginAlerts(filters: Omit<StatsFilters, "include_non_declared">) {
  const q = useQuery({
    queryKey: QUERIES.stats.marginAlerts(filters.date_from, filters.date_to, filters.category_type),
    queryFn:  () => api.get<MarginAlertsResponse>(URLS.stats.marginAlerts, { params: filters }),
    staleTime: 60_000,
  });
  return { alerts: q.data, isLoading: q.isLoading, isError: q.isError };
}


export function useStockSummary() {
  const q = useQuery({
    queryKey: QUERIES.stats.stockSummary,
    queryFn:  () => api.get<StockSummaryResponse>(URLS.stats.stockSummary),
    staleTime: 5 * 60_000,    // stock changes less often than ventes
  });
  return { stock: q.data, isLoading: q.isLoading, isError: q.isError };
}


// ── Admin ────────────────────────────────────────────────────────────────────

export function useAdminStats() {
  const q = useQuery({
    queryKey: QUERIES.admin.stats,
    queryFn:  () => api.get<AdminStatsResponse>(URLS.admin.stats),
    staleTime: 60_000,
  });
  return { systemStats: q.data, isLoading: q.isLoading, isError: q.isError };
}


export function useAdminPharmacies() {
  const q = useQuery({
    queryKey: QUERIES.admin.pharmacies,
    queryFn:  () => api.get<AdminPharmacyRow[]>(URLS.admin.pharmacies),
    staleTime: 5 * 60_000,    // pharmacy list rarely changes
  });
  return { pharmacies: q.data ?? [], isLoading: q.isLoading };
}


export function useAdminPharmacyStats(pharmacyId: number | null, filters: StatsFilters) {
  const q = useQuery({
    queryKey: QUERIES.admin.pharmacyStats(
      pharmacyId ?? 0, filters.date_from, filters.date_to, filters.category_type, filters.include_non_declared,
    ),
    queryFn:  () => api.get<StatsResponse>(URLS.admin.pharmacy.stats(pharmacyId as number), { params: filters }),
    enabled:  pharmacyId !== null,
    staleTime: 60_000,
  });
  return { stats: q.data, isLoading: q.isLoading, isError: q.isError };
}


export function useAdminPharmacyMarginAlerts(pharmacyId: number | null, filters: Omit<StatsFilters, "include_non_declared">) {
  const q = useQuery({
    queryKey: QUERIES.admin.pharmacyMarge(pharmacyId ?? 0, filters.date_from, filters.date_to, filters.category_type),
    queryFn:  () => api.get<MarginAlertsResponse>(URLS.admin.pharmacy.marginAlerts(pharmacyId as number), { params: filters }),
    enabled:  pharmacyId !== null,
    staleTime: 60_000,
  });
  return { alerts: q.data, isLoading: q.isLoading };
}


export function useAdminPharmacyStockSummary(pharmacyId: number | null) {
  const q = useQuery({
    queryKey: QUERIES.admin.pharmacyStock(pharmacyId ?? 0),
    queryFn:  () => api.get<StockSummaryResponse>(URLS.admin.pharmacy.stockSummary(pharmacyId as number)),
    enabled:  pharmacyId !== null,
    staleTime: 5 * 60_000,
  });
  return { stock: q.data, isLoading: q.isLoading };
}

/** Admin-only analyse-marge query — used by the /admin/stats page's Analyse de
 *  marge tab table. Mirrors the owner-side analyse hook signature but the
 *  pharmacy_id comes from the path (admin can pick any). */

export function useAdminPharmacyAnalyseMarge(
  pharmacyId: number | null,
  mode:       MargeMode,
  filters:    AnalyseFilters,
) {
  const q = useQuery({
    queryKey: QUERIES.admin.pharmacyAnalyse(pharmacyId ?? 0, mode, filters.date_from, filters.date_to, filters.category_type),
    queryFn:  () => api.get<AnalyseMargeResponse>(URLS.admin.pharmacy.analyseMarge(pharmacyId as number), { params: {
      mode, date_from: filters.date_from, date_to: filters.date_to, category_type: filters.category_type,
    } }),
    enabled:  pharmacyId !== null,
    staleTime: 60_000,
  });
  return { data: q.data, isLoading: q.isLoading, isError: q.isError };
}

// src/pages/rapport/_hooks/useCategoryTint.ts
// Category-tint helper for the Rapport page. Threads `filters.category_type`
// into a class + var accent that non-KpiTile wrappers (CategoriesDonut,
// TrendChart, SanteFinanciere, TopCategoriesList, AnalyseMarge gauge/cta)
// can pick up so the whole page adopts the current CategorySegment value.
//
// KpiTile has its own `tint` prop wired to the same tokens; this helper is
// specifically for non-KpiTile blocks that render their own `border/bg` shell.

export interface CategoryTint {
  /** Replaces `border border-border bg-card` on the outer wrapper. */
  cardClass: string;
  /** CSS custom-property value (`var(--color-*)`) for accent bits. */
  accentVar: string;
}

export function useCategoryTint(category: CategoryType): CategoryTint {
  if (category === "pharmacie") {
    return {
      cardClass: "border border-pharmacie-border bg-pharmacie-bg/30",
      accentVar: "var(--color-pharmacie)",
    };
  }
  if (category === "parapharmacie") {
    return {
      cardClass: "border border-parapharmacie-border bg-parapharmacie-bg/30",
      accentVar: "var(--color-parapharmacie)",
    };
  }
  return {
    cardClass: "border border-border bg-card",
    accentVar: "var(--color-total)",
  };
}
