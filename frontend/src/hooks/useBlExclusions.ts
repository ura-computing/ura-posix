import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as blApi from "@/api/blExclusions";

const EXCLUSIONS_KEY = ["owner", "bl-exclusions"] as const;
const SUGGESTIONS_KEY = ["bl-suggestions"] as const;

export function useBlExclusions(enabled: boolean) {
  const { data: exclusions = [], isLoading: exclusionsLoading } = useQuery({
    queryKey: EXCLUSIONS_KEY,
    queryFn: () => blApi.listExclusions(),
    enabled,
  });
  return { exclusions, exclusionsLoading };
}

export function useBlSuggestions(query: string, dialogOpen: boolean) {
  const hasQuery = query.trim().length >= 2;
  const { data: suggestions = [], isFetching: suggestionsLoading } = useQuery({
    queryKey: [...SUGGESTIONS_KEY, query],
    queryFn: () => blApi.suggestBls(query),
    enabled: dialogOpen && hasQuery,
  });
  return { suggestions, suggestionsLoading };
}

export function useCreateBlExclusion(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  const { mutate: createExclusion, isPending: creating } = useMutation({
    mutationFn: (body: { delivery_ref: string; notes?: string }) => blApi.createExclusion(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXCLUSIONS_KEY });
      queryClient.invalidateQueries({ queryKey: SUGGESTIONS_KEY });
      toast.success("BL exclu de la comptabilité");
      onSuccess?.();
    },
    onError: (err) => toast.error(err.message),
  });
  return { createExclusion, creating };
}

export function useDeleteBlExclusion() {
  const queryClient = useQueryClient();
  const { mutate: deleteExclusion, isPending: deleting } = useMutation({
    mutationFn: (deliveryRef: string) => blApi.deleteExclusion(deliveryRef),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXCLUSIONS_KEY });
      toast.success("BL réintégré");
    },
    onError: (err) => toast.error(err.message),
  });
  return { deleteExclusion, deleting };
}
