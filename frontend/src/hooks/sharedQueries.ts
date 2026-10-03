/** Reads used by several pages: one hook per query, so two pages never build the same
 *  cache slot twice (same key = same data type, same staleTime, same names). A read
 *  used by one page only stays in that page's `hooks.ts`. */
import { useQuery } from "@tanstack/react-query";

import { API } from "@/api/api";
import { api } from "@/api/client";
import type {
  AnalyseFilters,
  AnalyseMargeResponse,
  MargeMode,
  MarginAlertsResponse,
  PharmacyListRow,
  StatsFilters,
  StatsResponse,
  VentesFilters,
  VentesListResponse,
} from "@/types";

export type MarginAlertsFilters = Omit<StatsFilters, "include_non_declared">;

/** /stats — Rapport, Comptabilité. */
export function useStats(filters: StatsFilters) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: API.stats.main.key(
      filters.date_from,
      filters.date_to,
      filters.category_type,
      filters.include_non_declared,
    ),
    queryFn: () => api.get<StatsResponse>(API.stats.main.url, { params: filters }),
    staleTime: 60_000,
  });
  return {
    stats: data,
    isLoading,
    isError,
    error,
  };
}

/** The 5 margin brackets — Rapport, Alertes. */
export function useMarginAlerts(filters: MarginAlertsFilters) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.stats.marginAlerts.key(
      filters.date_from ?? null,
      filters.date_to ?? null,
      filters.category_type ?? "all",
    ),
    queryFn: () => api.get<MarginAlertsResponse>(API.stats.marginAlerts.url, { params: filters }),
    staleTime: 60_000,
  });
  return {
    marginAlerts: data,
    isLoading,
    isError,
    reload: () => void refetch(),
  };
}

/** /stats/analyse-marge per mode — Analyses, Rapport « Optimisation » tile (mode
 *  produit, same slot). Liste mode is a POST (`useAnalyseListe`), not cached. */
export function useAnalyseMarge(filters: AnalyseFilters, mode: MargeMode) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: API.stats.analyseMarge.key(
      mode,
      filters.date_from,
      filters.date_to,
      filters.category_type,
      filters.product,
    ),
    queryFn: () =>
      api.get<AnalyseMargeResponse>(API.stats.analyseMarge.url, {
        params: {
          mode,
          date_from: filters.date_from,
          date_to: filters.date_to,
          category_type: filters.category_type,
          product: filters.product,
        },
      }),
    staleTime: 60_000,
    enabled: mode !== "liste",
  });
  return {
    analyse: data,
    isLoading,
    error: isError ? error : null,
  };
}

/** One page of the ventes ledger — Ventes, Comptabilité. */
export function useVentesList(filters: VentesFilters) {
  const { data, isLoading, isError } = useQuery({
    queryKey: API.ventes.list.key(filters),
    queryFn: () => api.get<VentesListResponse>(API.ventes.list.url, { params: filters }),
  });
  return {
    ventesList: data,
    isLoading,
    isError,
  };
}

/** Every active pharmacy — admin Pharmacies page, admin Rapport picker. */
export function useAdminPharmaciesList() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.admin.pharmacies.key,
    queryFn: () => api.get<PharmacyListRow[]>(API.admin.pharmacies.url),
    staleTime: 30_000,
  });
  return {
    pharmacies: data,
    isLoading,
    isError,
    reload: () => void refetch(),
  };
}
