import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/api/client";
import { API, refresh } from "@/api/api";
import { useT } from "@/i18n/I18nProvider";
import { type DataImportsResponse, type DocType } from "@/types";

export function useImports() {
  const { data, isLoading, error } = useQuery({
    queryKey: API.imports.list.key,
    queryFn: () =>
      api.get<DataImportsResponse>(API.imports.list.url, {
        params: { page: 1, limit: 100 },
      }),
  });
  return {
    imports: data?.data ?? [],
    pagination: data?.pagination,
    isLoading,
    error,
  };
}

export function useDeleteImport() {
  const qc = useQueryClient();
  const t = useT();
  const { mutate, isPending } = useMutation({
    mutationFn: (batchId: number) =>
      api.delete<{ id: number; deleted_rows: number; file_type: DocType }>(API.imports.undo.url(batchId)),
    onSuccess: (res) => {
      void refresh(qc, API.uploads[res.file_type]); // rows removed: same reads as the import
      toast.success(
        res.deleted_rows > 0 ? t("imports.toastDeletedRows", { n: res.deleted_rows }) : t("imports.toastDeleted"),
      );
    },
  });
  return {
    deleteImport: mutate,
    isDeleting: isPending,
  };
}
