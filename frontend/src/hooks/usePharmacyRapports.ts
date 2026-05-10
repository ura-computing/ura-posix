import { useQuery } from "@tanstack/react-query";
import * as statsApi from "@/api/stats";

export function usePharmacyStats(
  dateFrom?: string,
  dateTo?: string,
  categoryType?: "all" | "pharmacie" | "parapharmacie",
  includeNonDeclared?: boolean,
) {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["stats", dateFrom, dateTo, categoryType, includeNonDeclared],
    queryFn: () =>
      statsApi.getStats(
        dateFrom || undefined,
        dateTo || undefined,
        categoryType,
        includeNonDeclared,
      ),
  });
  return { stats, statsLoading };
}

export function useMarginAlerts(
  dateFrom?: string,
  dateTo?: string,
  categoryType?: "all" | "pharmacie" | "parapharmacie",
) {
  const { data: marginAlerts, isLoading: marginAlertsLoading } = useQuery({
    queryKey: ["margin-alerts", dateFrom, dateTo, categoryType],
    queryFn: () =>
      statsApi.getMarginAlerts(
        dateFrom || undefined,
        dateTo || undefined,
        categoryType,
      ),
  });
  return { marginAlerts, marginAlertsLoading };
}

export function useStockAbcd(
  dateFrom?: string,
  dateTo?: string,
  extra: statsApi.StockAbcdParams = {},
) {
  const { classFilter, status, search, sortBy, sortOrder } = extra;
  const { data: stockAbcd, isLoading: stockAbcdLoading } = useQuery({
    queryKey: ["stock-abcd", dateFrom, dateTo, classFilter, status, search, sortBy, sortOrder],
    queryFn: () =>
      statsApi.getStockAbcd(dateFrom || undefined, dateTo || undefined, {
        classFilter, status, search, sortBy, sortOrder,
      }),
  });
  return { stockAbcd, stockAbcdLoading };
}

export function usePeremptions(dateFrom?: string, dateTo?: string) {
  const { data: peremptions, isLoading: peremptionsLoading } = useQuery({
    queryKey: ["peremptions", dateFrom, dateTo],
    queryFn: () =>
      statsApi.getPeremptions(dateFrom || undefined, dateTo || undefined),
  });
  return { peremptions, peremptionsLoading };
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
