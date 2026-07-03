import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiErr } from "@/api/client";
import { killSession } from "@/api/sessions";
import { QUERY_KEYS } from "@/types";

export function useKillSession(userId: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (sessionId: string) => killSession(sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SESSIONS(userId) });
      toast.success("Session déconnectée.");
    },
    onError: (err: ApiErr) => {
      if (err.status === 404) {
        // Another tab / device already killed this session. Soft-recover: refresh
        // the list silently and tell the user it's gone, not that something broke.
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SESSIONS(userId) });
        toast.info("Session déjà supprimée.");
        return;
      }
      toast.error(err.detail || "Impossible de déconnecter cette session.");
    },
  });

  const handleKill = (sessionId: string) => mutation.mutate(sessionId);

  return {
    handleKill,
    pendingId: mutation.isPending ? mutation.variables ?? null : null,
  };
}