/** One promis (/owner/promis/:id, /employee/promis/:id): its sheet, one step at a time (« Rendre prêt »…). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { API, refresh } from "@/api/api";
import { api, ApiErr } from "@/api/client";
import { useT } from "@/i18n/I18nProvider";
import type { PromisMove, PromisSheet } from "@/types/promis";

export function usePromisSheet(id: number) {
  const t = useT();
  const qc = useQueryClient();
  const valid = Number.isInteger(id) && id > 0;
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: API.promis.sheet.key(id),
    queryFn: () => api.get<PromisSheet>(API.promis.sheet.url(id)),
    enabled: valid,
  });

  const { mutateAsync, isPending: isMoving } = useMutation({
    mutationFn: (body: PromisMove) => api.post<PromisSheet>(API.promis.move.url(id), body),
    onSuccess: () => {
      toast.success(t("promis.moved"));
      void refresh(qc, API.promis.move);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    sheet: data ?? null,
    isLoading: valid && isLoading,
    isError,
    // Not one of the pharmacy's promis (or a wrong address): the 404 inside the layout.
    notFound: !valid || (error instanceof ApiErr && error.status === 404),
    reload: () => void refetch(),
    move: (body: PromisMove) => mutateAsync(body).then(() => undefined),
    isMoving,
  };
}
