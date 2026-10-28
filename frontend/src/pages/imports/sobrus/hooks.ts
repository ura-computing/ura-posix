import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { API, refresh } from "@/api/api";
import { api } from "@/api/client";
import { useSobrusConnection } from "@/hooks/sharedQueries";
import type { SobrusConnection, SobrusConnectionBody, SobrusRun, SobrusRunBody } from "@/types";

/** « Connexion Sobrus »: the connection (+ the run in progress, polled every 2 s), the last runs,
 *  and the owner's actions. When a run ends, every page fed by achats / ventes is refreshed. */
export function useSobrusPage() {
  const qc = useQueryClient();
  const { connection, isLoading } = useSobrusConnection();
  const activeRun = connection?.active_run ?? null;

  const { data: runs = [] } = useQuery({
    queryKey: API.sobrus.runs.key,
    queryFn: () => api.get<SobrusRun[]>(API.sobrus.runs.url),
    enabled: !!connection?.connected,
    refetchInterval: activeRun ? 2000 : false,
  });

  // A run just ended (it was there, it is gone): the new lines everywhere, and its final line in the list.
  const runningId = useRef<number | null>(null);
  useEffect(() => {
    if (runningId.current != null && activeRun == null) void refresh(qc, API.sobrus.runEnded);
    runningId.current = activeRun?.id ?? null;
  }, [activeRun, qc]);

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
    activeRun,
    runs,
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
