/** One admin Sobrus run (Catalogue « Importer les produits depuis Sobrus », « Fournisseurs » « Importer depuis Sobrus »),
 *  followed on every admin page (`CornerStack`): the try in progress, and the one that just ended. When it ends, its
 *  list reloads (catalogue / suppliers), whatever page is open. A finished
 *  import leaves by itself after 6 s; one that stopped (error, « Arrêter ») stays until dismissed. */
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { refresh } from "@/api/api";
import { api } from "@/api/client";
import { ADMIN_SOBRUS, useAdminSobrusImport, type AdminSobrusKind } from "@/hooks/useSharedQueries";
import type { AdminSobrusImport } from "@/types/sobrus";

const DONE_SHOWN_MS = 6000;

export function useAdminSobrusImportWatcher(kind: AdminSobrusKind, enabled: boolean) {
  const qc = useQueryClient();
  const { cancel: cancelWrite, ended } = ADMIN_SOBRUS[kind];
  const { sobrusImport } = useAdminSobrusImport(kind, enabled);
  const runs = (sobrusImport?.runs ?? []).map(({ run }) => run);
  const activeRun = runs.find((r) => r.status === "queued" || r.status === "running") ?? null;
  const activeId = activeRun?.id ?? null;

  // The try seen last time, and the one that ended (set during render: React's « previous value » pattern).
  const [seenId, setSeenId] = useState<number | null>(null);
  const [endedId, setEndedId] = useState<number | null>(null);
  if (activeId !== seenId) {
    // A refused account hands over to the next one: only the last try's end is shown.
    if (seenId != null && activeId == null) setEndedId(seenId);
    setSeenId(activeId);
  }

  useEffect(() => {
    if (endedId != null) void refresh(qc, ended);
  }, [endedId, qc, ended]);

  // The last try of the click (a refused account is followed by the next one).
  const last = runs.at(-1) ?? null;
  const endedRun = endedId != null && last?.ended_at ? last : null;

  useEffect(() => {
    if (endedRun?.status !== "success") return;
    const timer = setTimeout(() => setEndedId(null), DONE_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [endedRun?.status, endedRun?.id]);

  const { mutateAsync: cancel, isPending: isCancelling } = useMutation({
    mutationFn: () => api.post<AdminSobrusImport>(cancelWrite.url, {}),
    onSuccess: () => refresh(qc, cancelWrite),
  });

  const name = (id: number | undefined) => sobrusImport?.runs.find(({ run }) => run.id === id)?.pharmacy_name ?? "";
  return {
    activeRun,
    endedRun,
    pharmacyName: name((activeRun ?? endedRun)?.id),
    dismissEnded: () => setEndedId(null),
    cancelImport: () => cancel().then(() => undefined),
    isCancelling,
  };
}
