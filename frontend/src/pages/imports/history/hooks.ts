import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/api/client";
import { API, refresh } from "@/api/api";
import { useT } from "@/i18n/I18nProvider";
import { type DataImport, type DataImportsResponse, type DocType } from "@/types";

export function useImports() {
  const { data, isLoading, error } = useQuery({
    queryKey: API.imports.list.key,
    queryFn: () =>
      api.get<DataImportsResponse>(API.imports.list.url, {
        params: { page: 1, limit: 100 },
      }),
    // An import « En cours » turns « Réussi » or « Interrompu » (no chunk for 1 min): look again
    // every 10 s while one is listed, so the label changes without a reload.
    refetchInterval: (query) =>
      query.state.data?.data.some((r) => r.status === "in_progress" && !r.deleted_at) ? 10_000 : false,
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

/** « Supprimer la sélection »: one DELETE per import, one after the other (each undo removes
 *  rows from the same tables). Every import is tried; the toast says how many went and names
 *  the ones that failed. */
export function useDeleteImports() {
  const qc = useQueryClient();
  const t = useT();
  const { mutateAsync, isPending } = useMutation({
    mutationFn: async (rows: DataImport[]) => {
      const failed: DataImport[] = [];
      const types = new Set<DocType>();
      let deletedRows = 0;
      for (const row of rows) {
        try {
          const res = await api.delete<{ id: number; deleted_rows: number; file_type: DocType }>(
            API.imports.undo.url(row.id),
          );
          types.add(res.file_type);
          deletedRows += res.deleted_rows;
        } catch {
          failed.push(row);
        }
      }
      return { done: rows.length - failed.length, failed, types: [...types], deletedRows };
    },
    onSuccess: ({ done, failed, types, deletedRows }) => {
      for (const type of types) void refresh(qc, API.uploads[type]); // rows removed: same reads as the import
      if (done > 0) toast.success(t("imports.toastDeletedMany", { n: done, rows: deletedRows }));
      if (failed.length > 0) {
        toast.error(
          t("imports.toastDeleteFailed", { names: failed.map((r) => r.filename ?? t("imports.noName")).join(", ") }),
        );
      }
    },
  });
  return {
    deleteImports: mutateAsync,
    isDeletingMany: isPending,
  };
}
