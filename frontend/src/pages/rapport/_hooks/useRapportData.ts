import { useQuery } from "@tanstack/react-query";

import {
  getAdminPharmacies,
  getAdminPharmacyMarginAlerts,
  getAdminPharmacyStats,
  getAdminPharmacyStockSummary,
  getAdminStats,
  getMarginAlerts,
  getStats,
  getStockSummary,
} from "@/api/stats";
import { QUERY_KEYS } from "@/types";
import type { StatsFilters } from "@/types";


// ── Owner ────────────────────────────────────────────────────────────────────

export function useStats(filters: StatsFilters) {
  const q = useQuery({
    queryKey: QUERY_KEYS.STATS(filters.date_from, filters.date_to, filters.category_type, filters.include_non_declared),
    queryFn:  () => getStats(filters),
    staleTime: 60_000,
  });
  return { stats: q.data, isLoading: q.isLoading, isError: q.isError, error: q.error };
}


export function useMarginAlerts(filters: Omit<StatsFilters, "include_non_declared">) {
  const q = useQuery({
    queryKey: QUERY_KEYS.MARGIN_ALERTS(filters.date_from, filters.date_to, filters.category_type),
    queryFn:  () => getMarginAlerts(filters),
    staleTime: 60_000,
  });
  return { alerts: q.data, isLoading: q.isLoading, isError: q.isError };
}


export function useStockSummary() {
  const q = useQuery({
    queryKey: QUERY_KEYS.STOCK_SUMMARY,
    queryFn:  getStockSummary,
    staleTime: 5 * 60_000,    // stock changes less often than ventes
  });
  return { stock: q.data, isLoading: q.isLoading, isError: q.isError };
}


// ── Admin ────────────────────────────────────────────────────────────────────

export function useAdminStats() {
  const q = useQuery({
    queryKey: QUERY_KEYS.ADMIN_STATS,
    queryFn:  getAdminStats,
    staleTime: 60_000,
  });
  return { systemStats: q.data, isLoading: q.isLoading, isError: q.isError };
}


export function useAdminPharmacies() {
  const q = useQuery({
    queryKey: QUERY_KEYS.ADMIN_PHARMACIES,
    queryFn:  getAdminPharmacies,
    staleTime: 5 * 60_000,    // pharmacy list rarely changes
  });
  return { pharmacies: q.data ?? [], isLoading: q.isLoading };
}


export function useAdminPharmacyStats(pharmacyId: number | null, filters: StatsFilters) {
  const q = useQuery({
    queryKey: QUERY_KEYS.ADMIN_PHARM_STATS(
      pharmacyId ?? 0, filters.date_from, filters.date_to, filters.category_type, filters.include_non_declared,
    ),
    queryFn:  () => getAdminPharmacyStats(pharmacyId as number, filters),
    enabled:  pharmacyId !== null,
    staleTime: 60_000,
  });
  return { stats: q.data, isLoading: q.isLoading, isError: q.isError };
}


export function useAdminPharmacyMarginAlerts(pharmacyId: number | null, filters: Omit<StatsFilters, "include_non_declared">) {
  const q = useQuery({
    queryKey: QUERY_KEYS.ADMIN_PHARM_MARGE(pharmacyId ?? 0, filters.date_from, filters.date_to, filters.category_type),
    queryFn:  () => getAdminPharmacyMarginAlerts(pharmacyId as number, filters),
    enabled:  pharmacyId !== null,
    staleTime: 60_000,
  });
  return { alerts: q.data, isLoading: q.isLoading };
}


export function useAdminPharmacyStockSummary(pharmacyId: number | null) {
  const q = useQuery({
    queryKey: QUERY_KEYS.ADMIN_PHARM_STOCK(pharmacyId ?? 0),
    queryFn:  () => getAdminPharmacyStockSummary(pharmacyId as number),
    enabled:  pharmacyId !== null,
    staleTime: 5 * 60_000,
  });
  return { stock: q.data, isLoading: q.isLoading };
}