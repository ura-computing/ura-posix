/** Admin-only analyse-marge query — used by the /admin/stats page's Analyse de
 *  marge tab table. Mirrors the owner-side analyse hook signature but the
 *  pharmacy_id comes from the path (admin can pick any). */
import { useQuery } from "@tanstack/react-query";

import { getAdminPharmacyAnalyseMarge } from "@/api/stats";
import { QUERY_KEYS } from "@/types";
import type { AnalyseFilters, MargeMode } from "@/types";


export function useAdminPharmacyAnalyseMarge(
  pharmacyId: number | null,
  mode:       MargeMode,
  filters:    AnalyseFilters,
) {
  const q = useQuery({
    queryKey: QUERY_KEYS.ADMIN_PHARM_ANALYSE(pharmacyId ?? 0, mode, filters.date_from, filters.date_to, filters.category_type),
    queryFn:  () => getAdminPharmacyAnalyseMarge(pharmacyId as number, mode, filters),
    enabled:  pharmacyId !== null,
    staleTime: 60_000,
  });
  return { data: q.data, isLoading: q.isLoading, isError: q.isError };
}
