import { useQuery } from "@tanstack/react-query";
import * as adminApi from "@/api/admin";

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

export function useAdminPharmacyStats(pharmacyId: number | null, dateFrom?: string, dateTo?: string) {
  const { data: pharmStats, isLoading: pharmLoading } = useQuery({
    queryKey: ["admin-pharmacy-stats", pharmacyId, dateFrom, dateTo],
    queryFn: () => adminApi.getPharmacyStats(pharmacyId!, dateFrom || undefined, dateTo || undefined),
    enabled: pharmacyId != null,
  });
  return { pharmStats, pharmLoading };
}
