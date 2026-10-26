import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import { API, refresh } from "@/api/api";
import { useMe } from "@/hooks/useMe";
import type { ExtensionMessage, ServerImportsResponse } from "@/types";
import { isRunning, onJobsChange, readJobs } from "@/utils/jobs";

/** An extension file that never reached PharmaGest (refused file, download failed) stays this long. */
const LOCAL_ERROR_KEPT_MS = 60 * 60_000;

/** The popup: the PharmaGest account; the files the extension is sending now (live: the service
 *  worker saves each step in chrome.storage) and those it could not send; the pharmacy's imports on
 *  PharmaGest itself (same list as the app's « Gestion des imports »); « Annuler »; « Importer tout
 *  l'historique ». */
export function usePopupPage() {
  const qc = useQueryClient();
  const { me, isLoading: isLoadingMe, error: meError } = useMe();

  const { data: jobs = [] } = useQuery({ queryKey: API.jobs.list.key, queryFn: readJobs });
  // The service worker writes the list: keep the cache in step, and the server's list with it.
  useEffect(
    () =>
      onJobsChange((next) => {
        qc.setQueryData(API.jobs.list.key, next);
        void qc.invalidateQueries({ queryKey: API.imports.list.key });
      }),
    [qc],
  );
  const sending = jobs.filter(
    (j) => isRunning(j) || (j.phase === "error" && j.batchId == null && Date.now() - j.createdAt < LOCAL_ERROR_KEPT_MS),
  );

  const { data: imports } = useQuery({
    queryKey: API.imports.list.key,
    queryFn: () => api.get<ServerImportsResponse>(`${API.imports.list.url}?page=1&limit=8`),
    enabled: !!me?.pharmacy,
    select: (r) => r.data.filter((i) => i.deleted_at == null),
  });

  const { mutateAsync: cancelImport, isPending: isCancelling } = useMutation({
    mutationFn: (id: string) => chrome.runtime.sendMessage<ExtensionMessage>({ type: "CANCEL_IMPORT", id }),
    onSuccess: () => refresh(qc, API.jobs.cancel),
  });

  // « Importer tout l'historique »: the service worker opens the Sobrus export pages (content/sobrus.ts).
  const { mutateAsync: startFullExport, isPending: isStarting } = useMutation({
    mutationFn: () => chrome.runtime.sendMessage<ExtensionMessage>({ type: "START_FULL_EXPORT" }),
  });

  return {
    me,
    isLoadingMe,
    meError,
    sending,
    imports: imports ?? [],
    cancelImport,
    isCancelling,
    startFullExport,
    isStarting,
  };
}
