import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QUERY_KEYS } from "@/constants";

type ClearFilters = { categories?: string[]; dateFrom?: string; dateTo?: string };

export function useClearAchats() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filters?: ClearFilters) => api.data.clearAchats(filters),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.achat }),
  });
}

export function useClearVentes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filters?: ClearFilters) => api.data.clearVentes(filters),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ventes }),
  });
}
