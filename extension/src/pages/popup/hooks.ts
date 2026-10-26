import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { API, refresh } from "@/api/api";
import { useMe } from "@/hooks/useMe";
import type { ExtensionMessage } from "@/types";
import { onJobsChange, readJobs } from "@/utils/jobs";

/** The popup: the PharmaGest account, the latest imports (live: the service worker saves each
 *  step in chrome.storage), « Annuler » of a running one. */
export function usePopupPage() {
  const qc = useQueryClient();
  const { me, isLoading: isLoadingMe, error: meError } = useMe();

  const { data: jobs = [] } = useQuery({ queryKey: API.jobs.list.key, queryFn: readJobs });
  // The service worker writes the list: keep the cache in step with chrome.storage.
  useEffect(() => onJobsChange((next) => qc.setQueryData(API.jobs.list.key, next)), [qc]);

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
    jobs,
    cancelImport,
    isCancelling,
    startFullExport,
    isStarting,
  };
}
