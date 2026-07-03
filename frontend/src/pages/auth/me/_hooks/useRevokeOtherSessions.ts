import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiErr } from "@/api/client";
import { revokeOtherSessions } from "@/api/sessions";
import { QUERY_KEYS } from "@/types";

export function useRevokeOtherSessions(userId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => revokeOtherSessions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SESSIONS(userId) });
      toast.success("Toutes les autres sessions ont été déconnectées.");
    },
    onError: (err: ApiErr) => {
      toast.error(err.detail || "L'opération a échoué.");
    },
  });

  const handleRevokeOthers = () => mutation.mutate();

  return {
    handleRevokeOthers,
    isPending: mutation.isPending,
  };
}