import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateMe } from "@/api/auth";
import { QUERY_KEYS } from "@/constants";
import type { ProfileUpdatePayload } from "@/types";

export function useUpdateMe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProfileUpdatePayload) => updateMe(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.me });
    },
  });
}
