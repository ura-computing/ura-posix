import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useT } from "@/i18n/I18nProvider";

import { ApiErr } from "@/api/client";
import { killSession } from "@/api/sessions";
import { QUERY_KEYS } from "@/types";

export function useKillSession(userId: string) {
  const t = useT();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (sessionId: string) => killSession(sessionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SESSIONS(userId) });
      toast.success(t("toast.sessionKilled"));
    },
    onError: (err: ApiErr) => {
      if (err.status === 404) {
        // Another tab / device already killed this session. Soft-recover: refresh
        // the list silently and tell the user it's gone, not that something broke.
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SESSIONS(userId) });
        toast.info(t("toast.sessionAlreadyGone"));
        return;
      }
      toast.error(err.detail || t("toast.sessionKillFailed"));
    },
  });

  const handleKill = (sessionId: string) => mutation.mutate(sessionId);

  return {
    handleKill,
    pendingId: mutation.isPending ? mutation.variables ?? null : null,
  };
}