import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import { API } from "@/api/api";
import { useAnalyseMarge } from "@/hooks/sharedQueries";

import type {
  AdminStatsResponse,
  AnalyseFilters,
  AnalyseMargeResponse,
  CategoryType,
  MargeMode,
  MarginAlertsResponse,
  StatsFilters,
  StatsResponse,
  StockSummaryResponse,
} from "@/types";

// ── Owner ────────────────────────────────────────────────────────────────────

/** « Optimisation » tile: the /analyses gain (best ↔ worst product, mode produit)
 *  for the Rapport period + category. Same hook as /analyses → shared cache. */
export function useOptimisationGain(filters: StatsFilters) {
  const { analyse } = useAnalyseMarge(
    {
      date_from: filters.date_from,
      date_to: filters.date_to,
      category_type: filters.category_type,
      product: null,
    },
    "produit",
  );
  return analyse?.kpis.difference_gain_dh ?? null;
}

export function useStockSummary() {
  const { data, isLoading, isError } = useQuery({
    queryKey: API.stats.stockSummary.key,
    queryFn: () => api.get<StockSummaryResponse>(API.stats.stockSummary.url),
    staleTime: 5 * 60_000, // stock changes less often than ventes
  });
  return {
    stock: data,
    isLoading,
    isError,
  };
}

// ── Admin ────────────────────────────────────────────────────────────────────

export function useAdminStats() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.admin.stats.key,
    queryFn: () => api.get<AdminStatsResponse>(API.admin.stats.url),
    staleTime: 60_000,
  });
  return {
    systemStats: data,
    isLoading,
    isError,
    reload: () => void refetch(),
  };
}

export function useAdminPharmacyStats(pharmacyId: number | null, filters: StatsFilters) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.admin.pharmacyStats.key(
      pharmacyId ?? 0,
      filters.date_from,
      filters.date_to,
      filters.category_type,
      filters.include_non_declared,
    ),
    queryFn: () => api.get<StatsResponse>(API.admin.pharmacyStats.url(pharmacyId as number), { params: filters }),
    enabled: pharmacyId !== null,
    staleTime: 60_000,
  });
  return {
    stats: data,
    isLoading,
    isError,
    reload: () => void refetch(),
  };
}

export function useAdminPharmacyMarginAlerts(
  pharmacyId: number | null,
  filters: Omit<StatsFilters, "include_non_declared">,
) {
  const { data, isLoading } = useQuery({
    queryKey: API.admin.pharmacyMarginAlerts.key(
      pharmacyId ?? 0,
      filters.date_from,
      filters.date_to,
      filters.category_type,
    ),
    queryFn: () =>
      api.get<MarginAlertsResponse>(API.admin.pharmacyMarginAlerts.url(pharmacyId as number), { params: filters }),
    enabled: pharmacyId !== null,
    staleTime: 60_000,
  });
  return {
    alerts: data,
    isLoading,
  };
}

export function useAdminPharmacyStockSummary(pharmacyId: number | null) {
  const { data, isLoading } = useQuery({
    queryKey: API.admin.pharmacyStock.key(pharmacyId ?? 0),
    queryFn: () => api.get<StockSummaryResponse>(API.admin.pharmacyStock.url(pharmacyId as number)),
    enabled: pharmacyId !== null,
    staleTime: 5 * 60_000,
  });
  return {
    stock: data,
    isLoading,
  };
}

/** Admin-only analyse-marge query — used by the /admin/stats page's Analyse de
 *  marge tab table. Mirrors the owner-side analyse hook signature but the
 *  pharmacy_id comes from the path (admin can pick any). */

export function useAdminPharmacyAnalyseMarge(pharmacyId: number | null, mode: MargeMode, filters: AnalyseFilters) {
  const { data, isLoading, isError } = useQuery({
    queryKey: API.admin.pharmacyAnalyse.key(
      pharmacyId ?? 0,
      mode,
      filters.date_from,
      filters.date_to,
      filters.category_type,
    ),
    queryFn: () =>
      api.get<AnalyseMargeResponse>(API.admin.pharmacyAnalyse.url(pharmacyId as number), {
        params: {
          mode,
          date_from: filters.date_from,
          date_to: filters.date_to,
          category_type: filters.category_type,
        },
      }),
    enabled: pharmacyId !== null,
    staleTime: 60_000,
  });
  return {
    analyse: data,
    isLoading,
    isError,
  };
}

// src/pages/rapport/_hooks/useCategoryTint.ts
// Category-tint helper for the Rapport page. Threads `filters.category_type`
// into a class + var accent that non-KpiTile wrappers (CategoriesDonut,
// TrendChart, SanteFinanciere, TopCategoriesList, AnalyseMarge gauge/cta)
// can pick up so the whole page adopts the current Segmented value.
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
