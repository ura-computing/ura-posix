import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { API, refresh } from "@/api/api";
import { api } from "@/api/client";
import { useSobrusConnection } from "@/hooks/sharedQueries";
import type { SobrusConnection, SobrusConnectionBody, SobrusRun, SobrusRunBody } from "@/types";

/** « Connexion Sobrus »: the connection (+ the run in progress, polled every 2 s), the last runs,
 *  and the owner's actions. A run's end refreshes the other pages: `hooks/useSobrusRunWatcher.ts`. */
export function useSobrusPage() {
  const qc = useQueryClient();
  const { connection, isLoading, isError, reload } = useSobrusConnection();
  const activeRun = connection?.active_run ?? null;

  const {
    data: runs = [],
    isLoading: runsLoading,
    isError: runsError,
    refetch: refetchRuns,
  } = useQuery({
    queryKey: API.sobrus.runs.key,
    queryFn: () => api.get<SobrusRun[]>(API.sobrus.runs.url),
    enabled: !!connection?.connected,
    refetchInterval: activeRun ? 2000 : false,
  });

  const { mutateAsync: saveConnection, isPending: isSaving } = useMutation({
    mutationFn: (body: SobrusConnectionBody) => api.put<SobrusConnection>(API.sobrus.save.url, body),
    onSuccess: () => refresh(qc, API.sobrus.save),
  });
  const { mutateAsync: disconnect, isPending: isDisconnecting } = useMutation({
    mutationFn: () => api.delete(API.sobrus.disconnect.url),
    onSuccess: () => refresh(qc, API.sobrus.disconnect),
  });
  const { mutateAsync: startRun, isPending: isStarting } = useMutation({
    mutationFn: (body: SobrusRunBody) => api.post<SobrusRun>(API.sobrus.startRun.url, body),
    onSuccess: () => refresh(qc, API.sobrus.startRun),
  });
  const { mutateAsync: cancelRun, isPending: isCancelling } = useMutation({
    mutationFn: (id: number) => api.post<SobrusRun>(API.sobrus.cancelRun.url(id)),
    onSuccess: () => refresh(qc, API.sobrus.cancelRun),
  });

  return {
    connection,
    isLoading,
    isError,
    reload,
    activeRun,
    runs,
    runsLoading,
    runsError,
    reloadRuns: () => void refetchRuns(),
    saveConnection,
    isSaving,
    disconnect,
    isDisconnecting,
    startRun,
    isStarting,
    cancelRun,
    isCancelling,
  };
}
