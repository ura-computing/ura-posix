/** The « Connexion Sobrus » run, followed on every page (owners with the « Connexion Sobrus » access, `AppLayout`): the run
 *  in progress (polled every 2 s by `useSobrusConnection`), and the one that just ended. When a run
 *  ends, every read fed by achats / ventes / stock refreshes, whatever page is open. A finished run
 *  leaves by itself after 6 s; one that stopped (error, « Arrêter ») stays until dismissed. */
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { API, refresh } from "@/api/api";
import { api } from "@/api/client";
import { useSobrusConnection } from "@/hooks/sharedQueries";
import type { SobrusRun } from "@/types";

const DONE_SHOWN_MS = 6000;

export function useSobrusRunWatcher() {
  const qc = useQueryClient();
  const { connection } = useSobrusConnection();
  const activeRun = connection?.active_run ?? null;
  const activeId = activeRun?.id ?? null;

  // The run seen last time, and the one that ended (set during render: React's « previous value » pattern).
  const [seenId, setSeenId] = useState<number | null>(null);
  const [endedId, setEndedId] = useState<number | null>(null);
  if (activeId !== seenId) {
    if (seenId != null) setEndedId(seenId);
    setSeenId(activeId);
  }

  useEffect(() => {
    if (endedId != null) void refresh(qc, API.sobrus.runEnded);
  }, [endedId, qc]);

  const { data: runs = [] } = useQuery({
    queryKey: API.sobrus.runs.key,
    queryFn: () => api.get<SobrusRun[]>(API.sobrus.runs.url),
    enabled: endedId != null,
  });
  const endedRun = (endedId != null && runs.find((r) => r.id === endedId && r.ended_at)) || null;

  useEffect(() => {
    if (endedRun?.status !== "success") return;
    const timer = setTimeout(() => setEndedId(null), DONE_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [endedRun?.status, endedRun?.id]);

  const { mutateAsync: cancelRun, isPending: isCancelling } = useMutation({
    mutationFn: (id: number) => api.post<SobrusRun>(API.sobrus.cancelRun.url(id)),
    onSuccess: () => refresh(qc, API.sobrus.cancelRun),
  });

  return {
    activeRun,
    endedRun,
    dismissEnded: () => setEndedId(null),
    cancelRun,
    isCancelling,
  };
}
