/** TanStack Query wrappers for stats endpoints.
 *
 *  Thin: each hook hands off to its sibling `@/api/stats` function. The hooks
 *  layer exists so consumers can pass `{ enabled }` (e.g. the Stock page's
 *  filtered fetch only runs when at least one filter is active).
 */
import { useQuery } from "@tanstack/react-query";

import { getMarginAlerts, listPeremptions, listStockAbcd } from "@/api/stats";
import { QUERY_KEYS } from "@/types";
import type { StatsFilters, StockFilters } from "@/types";


/** Subset of StatsFilters used by margin-alerts (no include_non_declared). */
export type MarginAlertsFilters = Omit<StatsFilters, "include_non_declared">;


interface UseStockAbcdOptions {
  enabled?: boolean;
}


/**
 * Fetch the stock-abcd payload (distribution + total_references + ppv_potentiel
 * + products[]). Filters are forwarded to the backend; the query key encodes
 * either the "full" cache slot (date only) or the "filtered" slot (everything).
 */
export function useStockAbcd(
  filters: Partial<StockFilters>,
  options: UseStockAbcdOptions = {},
) {
  // "Full" slot = only date in cache key. If ANY filter narrows the result,
  // route through the "filtered" slot to keep both caches independent.
  const isFiltered = Boolean(
    filters.class_filter || filters.status || filters.search || filters.sort_by,
  );
  const queryKey = isFiltered
    ? QUERY_KEYS.STOCK_ABCD_FILTERED(filters as StockFilters)
    : QUERY_KEYS.STOCK_ABCD_FULL(filters.date_from ?? null, filters.date_to ?? null);

  return useQuery({
    queryKey,
    queryFn: () => listStockAbcd(filters),
    enabled: options.enabled ?? true,
  });
}


export function usePeremptions() {
  return useQuery({
    queryKey: QUERY_KEYS.PEREMPTIONS,
    queryFn:  listPeremptions,
    staleTime: 60_000,
  });
}


/** Fetch the 5-bracket margin-alerts payload. /alertes renders only `negative`
 *  + `low`; Rapport reads the same response. Cache key includes filters so
 *  switching dates / category type refetches cleanly. */
export function useMarginAlerts(filters: MarginAlertsFilters) {
  return useQuery({
    queryKey: QUERY_KEYS.MARGIN_ALERTS(
      filters.date_from ?? null,
      filters.date_to   ?? null,
      filters.category_type ?? "all",
    ),
    queryFn:  () => getMarginAlerts(filters),
    staleTime: 60_000,
  });
}