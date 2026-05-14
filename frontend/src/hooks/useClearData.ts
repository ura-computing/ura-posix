import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "@/api/client";
import { ENDPOINTS, QUERY_KEYS } from "@/constants";
import { toast } from "sonner";

type ClearFilters = { categories?: string[]; dateFrom?: string; dateTo?: string };

function clearAchatsApi(filters?: ClearFilters) {
  const p = new URLSearchParams();
  filters?.categories?.forEach((c) => p.append("category", c));
  if (filters?.dateFrom) p.set("date_from", filters.dateFrom);
  if (filters?.dateTo) p.set("date_to", filters.dateTo);
  const qs = p.toString();
  return request<{ deleted: number }>(`${ENDPOINTS.data.achats}${qs ? `?${qs}` : ""}`, { method: "DELETE" });
}

function clearVentesApi(filters?: ClearFilters) {
  const p = new URLSearchParams();
  filters?.categories?.forEach((c) => p.append("category", c));
  if (filters?.dateFrom) p.set("date_from", filters.dateFrom);
  if (filters?.dateTo) p.set("date_to", filters.dateTo);
  const qs = p.toString();
  return request<{ deleted: number }>(`${ENDPOINTS.data.ventes}${qs ? `?${qs}` : ""}`, { method: "DELETE" });
}

export function useClearAchats() {
  const queryClient = useQueryClient();
  const { mutate: clearAchats, isPending: clearAchatsPending, reset: resetAchats } = useMutation({
    mutationFn: (filters?: ClearFilters) => clearAchatsApi(filters),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.achat }),
  });
  return { clearAchats, clearAchatsPending, resetAchats };
}

export function useClearVentes() {
  const queryClient = useQueryClient();
  const { mutate: clearVentes, isPending: clearVentesPending, reset: resetVentes } = useMutation({
    mutationFn: (filters?: ClearFilters) => clearVentesApi(filters),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ventes }),
  });
  return { clearVentes, clearVentesPending, resetVentes };
}

// ── Import batches ─────────────────────────────────────────────────────────

export type ImportBatchOut = {
  id: number;
  file_type: "achat" | "vente" | "stock";
  filename: string | null;
  rows_inserted: number;
  rows_skipped: number;
  imported_at: string | null;
};

const IMPORTS_KEY = ["imports"] as const;

export function useImports() {
  const { data: imports = [], isLoading } = useQuery({
    queryKey: IMPORTS_KEY,
    queryFn: () => request<ImportBatchOut[]>("/data/imports"),
  });
  return { imports, isLoading };
}

export function useDeleteImport() {
  const queryClient = useQueryClient();
  const { mutate: deleteImport, isPending: deleting } = useMutation({
    mutationFn: (batchId: number) =>
      request<{ deleted: number }>(`/data/imports/${batchId}`, { method: "DELETE" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: IMPORTS_KEY });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.achat });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ventes });
      toast.success(`${data.deleted} ligne(s) supprimée(s)`);
    },
    onError: (err) => toast.error(err.message),
  });
  return { deleteImport, deleting };
}
