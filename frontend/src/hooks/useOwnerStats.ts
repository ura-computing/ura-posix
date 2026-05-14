import { useQuery } from "@tanstack/react-query";
import * as ownerApi from "@/api/owner";

export function useOwnerSpecialProductsStats(enabled: boolean) {
  return useQuery({
    queryKey: ["owner", "special-products-stats"],
    queryFn: ownerApi.getSpecialProductsStats,
    enabled,
  });
}
