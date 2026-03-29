import { useQuery } from "@tanstack/react-query";
import * as adminApi from "@/api/admin";
import * as statsApi from "@/api/stats";

export function useAdminSystemStats() {
  const { data: systemStats, isLoading: systemLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminApi.getStats(),
  });
  return { systemStats, systemLoading };
}

export function useAdminPharmacyList() {
  const { data: pharmacies = [] } = useQuery({
    queryKey: ["admin-pharmacies"],
    queryFn: () => adminApi.listPharmacies(),
  });
  return { pharmacies };
}

export function useAdminPharmacyStats(
  pharmacyId: number | null,
  dateFrom?: string,
  dateTo?: string,
  categoryType?: string,
) {
  const { data: pharmStats, isLoading: pharmLoading } = useQuery({
    queryKey: ["admin-pharmacy-stats", pharmacyId, dateFrom, dateTo, categoryType],
    queryFn: () =>
      statsApi.getPharmacyStats(pharmacyId!, dateFrom || undefined, dateTo || undefined, categoryType),
    enabled: pharmacyId != null,
  });
  return { pharmStats, pharmLoading };
}

export function useAdminAnalyseMarge(
  pharmacyId: number | null,
  dateFrom?: string,
  dateTo?: string,
  categoryType?: string,
  mode?: string,
) {
  const { data: margeData, isLoading: margeLoading } = useQuery({
    queryKey: ["admin-pharmacy-marge", pharmacyId, dateFrom, dateTo, categoryType, mode],
    queryFn: () =>
      statsApi.analyseMargeForPharmacy(pharmacyId!, dateFrom || undefined, dateTo || undefined, categoryType, mode),
    enabled: pharmacyId != null,
  });
  return { margeData, margeLoading };
}
