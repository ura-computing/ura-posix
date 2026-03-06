import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { USER_KEY, QUERY_KEYS } from "@/constants";
import type { ProfileUpdatePayload } from "@/types";

export function useUpdateMe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ProfileUpdatePayload) => api.auth.updateMe(payload),
    onSuccess: (updatedUser) => {
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.me });
    },
  });
}
