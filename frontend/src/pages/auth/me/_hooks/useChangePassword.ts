import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiErr } from "@/api/client";
import { changePassword } from "@/api/users";
import { QUERY_KEYS } from "@/types";
import type { ChangePasswordRequest, Me } from "@/types";

export function useChangePassword(onDone?: () => void) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: ChangePasswordRequest) => changePassword(input),
    onSuccess: async () => {
      // Backend wiped every session row of this user + re-issued cookies for the
      // current device (fix #2). Refresh /me (the response stays the same but
      // the cookie pair changed under us) AND refresh the Sessions tab so it
      // shows the single surviving session.
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ME });
      const me = queryClient.getQueryData<Me>(QUERY_KEYS.ME);
      if (me?.id) {
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SESSIONS(me.id) });
      }
      toast.success("Mot de passe modifié avec succès. Vos autres appareils ont été déconnectés.");
      onDone?.();
    },
    onError: (err: ApiErr) => {
      toast.error(err.detail || "Mot de passe actuel incorrect.");
    },
  });

  const handleChange = (input: ChangePasswordRequest) => mutation.mutate(input);

  return {
    handleChange,
    isPending: mutation.isPending,
    isError:   mutation.isError,
    error:     mutation.error,
  };
}