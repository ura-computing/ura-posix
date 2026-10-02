import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { QUERY_KEYS } from "@/types";
import { toast } from "sonner";
import { useT } from "@/i18n/I18nProvider";
import { ApiErr, api } from "@/api/client";
import { URLS } from "@/api/urls";
import type { UpdateProfileRequest, ChangePasswordRequest, Me, MeResponse, Session } from "@/types";

export function useSessions(userId: string) {
  const query = useQuery({
    queryKey: QUERY_KEYS.SESSIONS(userId),
    queryFn:  () => api.get<Session[]>(URLS.sessions.list),
    staleTime: 30_000,
  });

  return {
    sessions:  query.data ?? [],
    isLoading: query.isLoading,
    isError:   query.isError,
    error:     query.error,
  };
}

export function useKillSession(userId: string) {
  const t = useT();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (sessionId: string) => api.delete(URLS.sessions.one(sessionId)),
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

export function useRevokeOtherSessions(userId: string) {
  const t = useT();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => api.post<void>(URLS.sessions.revokeOthers),
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

export function useUpdateProfile() {
  const t = useT();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: UpdateProfileRequest) => api.patch<MeResponse>(URLS.auth.me, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ME });
      toast.success(t("toast.profileUpdated"));
    },
    onError: (err: ApiErr) => {
      toast.error(err.detail || t("toast.profileUpdateFailed"));
    },
  });

  const handleUpdate = (input: UpdateProfileRequest) => mutation.mutate(input);

  return {
    handleUpdate,
    isPending: mutation.isPending,
    isError:   mutation.isError,
    error:     mutation.error,
  };
}

export function useChangePassword(onDone?: () => void) {
  const t = useT();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (input: ChangePasswordRequest) => api.post<void>(URLS.auth.changePassword, input),
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
      toast.success(t("toast.pwdChanged"));
      onDone?.();
    },
    onError: (err: ApiErr) => {
      toast.error(err.detail || t("toast.pwdCurrentWrong"));
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
