import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { QUERY_KEYS } from "@/constants";

export function useClearAchats() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.data.clearAchats,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.achat }),
  });
}

export function useClearVentes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.data.clearVentes,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ventes }),
  });
}
