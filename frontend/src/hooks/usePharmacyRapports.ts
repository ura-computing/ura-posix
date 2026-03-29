import { useQuery } from "@tanstack/react-query";
import * as statsApi from "@/api/stats";

export function usePharmacyStats(
  dateFrom?: string,
  dateTo?: string,
  categoryType?: "all" | "pharmacie" | "parapharmacie",
) {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["stats", dateFrom, dateTo, categoryType],
    queryFn: () =>
      statsApi.getStats(
        dateFrom || undefined,
        dateTo || undefined,
        categoryType,
      ),
  });
  return { stats, statsLoading };
}

export function useAnalyseMarge(
  dateFrom?: string,
  dateTo?: string,
  categoryType?: "all" | "pharmacie" | "parapharmacie",
  margeMode?: string,
) {
  const { data: margeData, isLoading: margeLoading } = useQuery({
    queryKey: ["analyse-marge", dateFrom, dateTo, categoryType, margeMode],
    queryFn: () =>
      statsApi.analyseMarge(
        dateFrom || undefined,
        dateTo || undefined,
        categoryType,
        margeMode,
      ),
  });
  return { margeData, margeLoading };
}
