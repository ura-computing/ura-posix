/** TanStack Query wrappers for /v1/stats/analyse-marge + /v1/stats/analyse-liste.
 *
 *  Pattern matches the other stats hooks (useStats, useMarginAlerts, useStockAbcd).
 *  - useAnalyseMarge: GET per (mode, filters). Liste mode goes through useAnalyseListe instead.
 *  - useAnalyseListe: POST with CSV-parsed items. Mutation-shape since upload is user-triggered.
 */
import { useMutation, useQuery } from "@tanstack/react-query";

import { getAnalyseMarge, postAnalyseListe } from "@/api/stats";
import { QUERY_KEYS } from "@/types";
import type { AnalyseFilters, ListeRequest, MargeMode } from "@/types";


export function useAnalyseMarge(filters: AnalyseFilters, mode: MargeMode) {
  return useQuery({
    queryKey: QUERY_KEYS.ANALYSE_MARGE(mode, filters.date_from, filters.date_to, filters.category_type, filters.product),
    queryFn:  () => getAnalyseMarge(filters, mode),
    staleTime: 60_000,
    enabled:   mode !== "liste",   // Liste uses the mutation hook below
  });
}


export function useAnalyseListe() {
  return useMutation({
    mutationFn: (body: ListeRequest) => postAnalyseListe(body),
  });
}
