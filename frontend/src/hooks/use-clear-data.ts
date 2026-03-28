import { useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/api/client";
import { ENDPOINTS, QUERY_KEYS } from "@/constants";

type ClearFilters = { categories?: string[]; dateFrom?: string; dateTo?: string };

function clearAchats(filters?: ClearFilters) {
  const p = new URLSearchParams();
  filters?.categories?.forEach((c) => p.append("category", c));
  if (filters?.dateFrom) p.set("date_from", filters.dateFrom);
  if (filters?.dateTo) p.set("date_to", filters.dateTo);
  const qs = p.toString();
  return request<{ deleted: number }>(`${ENDPOINTS.data.achats}${qs ? `?${qs}` : ""}`, { method: "DELETE" });
}

function clearVentes(filters?: ClearFilters) {
  const p = new URLSearchParams();
  filters?.categories?.forEach((c) => p.append("category", c));
  if (filters?.dateFrom) p.set("date_from", filters.dateFrom);
  if (filters?.dateTo) p.set("date_to", filters.dateTo);
  const qs = p.toString();
  return request<{ deleted: number }>(`${ENDPOINTS.data.ventes}${qs ? `?${qs}` : ""}`, { method: "DELETE" });
}

export function useClearAchats() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filters?: ClearFilters) => clearAchats(filters),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.achat }),
  });
}

export function useClearVentes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filters?: ClearFilters) => clearVentes(filters),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ventes }),
  });
}
