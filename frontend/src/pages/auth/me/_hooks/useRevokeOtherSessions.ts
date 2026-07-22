import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useT } from "@/i18n/I18nProvider";

import { ApiErr } from "@/api/client";
import { revokeOtherSessions } from "@/api/sessions";
import { QUERY_KEYS } from "@/types";

export function useRevokeOtherSessions(userId: string) {
  const t = useT();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => revokeOtherSessions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SESSIONS(userId) });
      toast.success(t("toast.allSessionsRevoked"));
    },
    onError: (err: ApiErr) => {
      toast.error(err.detail || t("toast.opFailed"));
    },
  });

  const handleRevokeOthers = () => mutation.mutate();

  return {
    handleRevokeOthers,
    isPending: mutation.isPending,
  };
}