import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/api/client";
import { URLS } from "@/api/urls";
import { QUERIES, changedByImport } from "@/api/queries";
import { useT } from "@/i18n/I18nProvider";
import { type DataImportsResponse, type DocType } from "@/types";


export function useImports() {
  const q = useQuery({
    queryKey: QUERIES.imports.list,
    queryFn:  () => api.get<DataImportsResponse>(URLS.imports.list, { params: { page: 1, limit: 100 } }),
  });
  return {
    imports:    q.data?.data ?? [],
    pagination: q.data?.pagination,
    isLoading:  q.isLoading,
    error:      q.error,
  };
}


export function useDeleteImport() {
  const qc = useQueryClient();
  const t = useT();
  const m = useMutation({
    mutationFn: (batchId: number) =>
      api.delete<{ id: number; deleted_rows: number; file_type: DocType }>(URLS.imports.one(batchId)),
    onSuccess:  (res) => {
      qc.invalidateQueries({ predicate: changedByImport(res.file_type) });   // rows removed
      toast.success(
        res.deleted_rows > 0
          ? t("imports.toastDeletedRows", { n: res.deleted_rows })
          : t("imports.toastDeleted"),
      );
    },
  });
  return { deleteImport: m.mutate, isPending: m.isPending };
}