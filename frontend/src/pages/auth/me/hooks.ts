import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";


import { toast } from "sonner";
import { useT } from "@/i18n/I18nProvider";
import { ApiErr, api } from "@/api/client";
import { API, refresh } from "@/api/api";
import type { UpdateProfileRequest, ChangePasswordRequest, MeResponse, Session } from "@/types";

export function useSessions(userId: string) {
  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: API.sessions.list.key(userId),
    queryFn:  () => api.get<Session[]>(API.sessions.list.url),
    staleTime: 30_000,
  });

  return {
    sessions:  data ?? [],
    isLoading,
    isError,
    error,
  };
}

export function useKillSession() {
  const t = useT();
  const queryClient = useQueryClient();

  const {
    mutate,
    variables,
    isPending,
  } = useMutation({
    mutationFn: (sessionId: string) => api.delete(API.sessions.end.url(sessionId)),
    onSuccess: async () => {
      await refresh(queryClient, API.sessions.end);
      toast.success(t("toast.sessionKilled"));
    },
    onError: (err: ApiErr) => {
      if (err.status === 404) {
        // Another tab / device already killed this session. Soft-recover: refresh
        // the list silently and tell the user it's gone, not that something broke.
        void refresh(queryClient, API.sessions.end);
        toast.info(t("toast.sessionAlreadyGone"));
        return;
      }
      toast.error(err.detail || t("toast.sessionKillFailed"));
    },
  });

  const handleKill = (sessionId: string) => mutate(sessionId);

  return {
    handleKill,
    pendingId: isPending ? variables ?? null : null,
  };
}

export function useRevokeOtherSessions() {
  const t = useT();
  const queryClient = useQueryClient();

  const {
    mutate,
    isPending,
  } = useMutation({
    mutationFn: () => api.post<void>(API.sessions.endOthers.url),
    onSuccess: async () => {
      await refresh(queryClient, API.sessions.endOthers);
      toast.success(t("toast.allSessionsRevoked"));
    },
    onError: (err: ApiErr) => {
      toast.error(err.detail || t("toast.opFailed"));
    },
  });

  const handleRevokeOthers = () => mutate();

  return {
    handleRevokeOthers,
    isPending,
  };
}

export function useUpdateProfile() {
  const t = useT();
  const queryClient = useQueryClient();

  const {
    mutate,
    isPending,
    isError,
    error,
  } = useMutation({
    mutationFn: (input: UpdateProfileRequest) => api.patch<MeResponse>(API.auth.updateProfile.url, input),
    onSuccess: async () => {
      await refresh(queryClient, API.auth.updateProfile);
      toast.success(t("toast.profileUpdated"));
    },
    onError: (err: ApiErr) => {
      toast.error(err.detail || t("toast.profileUpdateFailed"));
    },
  });

  const handleUpdate = (input: UpdateProfileRequest) => mutate(input);

  return {
    handleUpdate,
    isPending,
    isError,
    error,
  };
}

export function useChangePassword(onDone?: () => void) {
  const t = useT();
  const queryClient = useQueryClient();

  const {
    mutate,
    isPending,
    isError,
    error,
  } = useMutation({
    mutationFn: (input: ChangePasswordRequest) => api.post<void>(API.auth.changePassword.url, input),
    onSuccess: async () => {
      // Backend wiped every session row of this user + re-issued cookies for the
      // current device (fix #2). Refresh /me (the response stays the same but
      // the cookie pair changed under us) AND the Sessions tab so it shows the
      // single surviving session.
      await refresh(queryClient, API.auth.changePassword);
      toast.success(t("toast.pwdChanged"));
      onDone?.();
    },
    onError: (err: ApiErr) => {
      toast.error(err.detail || t("toast.pwdCurrentWrong"));
    },
  });

  const handleChange = (input: ChangePasswordRequest) => mutate(input);

  return {
    handleChange,
    isPending,
    isError,
    error,
  };
}
