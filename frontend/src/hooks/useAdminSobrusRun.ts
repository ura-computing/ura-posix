/** The admin's Sobrus run (Catalogue « Importer les produits depuis Sobrus », « Fournisseurs » « Importer depuis
 *  Sobrus »): the robot reads one owner's Sobrus account (the next one if Sobrus refuses it). Start, « Arrêter », its
 *  progress (the shared query; products: also the corner card on every admin page). */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/api/client";
import { refresh } from "@/api/api";
import { ADMIN_SOBRUS, useAdminSobrusImport, type AdminSobrusKind } from "@/hooks/useSharedQueries";
import { useT } from "@/i18n/I18nProvider";
import type { AdminSobrusImport } from "@/types/sobrus";

export function useAdminSobrusRun(kind: AdminSobrusKind) {
  const t = useT();
  const queryClient = useQueryClient();
  const { start, cancel } = ADMIN_SOBRUS[kind];
  const { sobrusImport, isLoading, isRunning } = useAdminSobrusImport(kind);

  const { mutateAsync: startRun, isPending: isStarting } = useMutation({
    mutationFn: () => api.post<{ pharmacy_name: string }>(start.url, {}),
    onSuccess: ({ pharmacy_name }) => {
      toast.success(t("catalogue.sobrusStarted", { name: pharmacy_name }));
      void refresh(queryClient, start);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { mutateAsync: cancelRun, isPending: isCancelling } = useMutation({
    mutationFn: () => api.post<AdminSobrusImport>(cancel.url, {}),
    onSuccess: () => void refresh(queryClient, cancel),
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    sobrusImport,
    isLoading,
    isRunning,
    startImport: () => startRun().then(() => undefined),
    isStarting,
    stopImport: () => cancelRun().then(() => undefined),
    isCancelling,
  };
}
