import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiErr } from "@/api/client";
import { deleteImport, listImports } from "@/api/data";
import { QUERY_KEYS } from "@/types";


export function useImports() {
  const q = useQuery({
    queryKey: QUERY_KEYS.IMPORTS,
    queryFn:  () => listImports(1, 100),
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
  const m = useMutation({
    mutationFn: (batchId: number) => deleteImport(batchId),
    onSuccess:  (res) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.IMPORTS });
      toast.success(
        res.deleted_rows > 0
          ? `Import supprimé · ${res.deleted_rows} ligne(s) effacée(s)`
          : "Import supprimé",
      );
    },
    onError: (err: ApiErr) => {
      toast.error(err.detail || "Suppression impossible.");
    },
  });
  return { deleteImport: m.mutate, isPending: m.isPending };
}