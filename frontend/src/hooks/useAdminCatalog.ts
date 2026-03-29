import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as adminApi from "@/api/admin";
import type { MedicamentOut, CategorySuffixOut } from "@/api/admin";

// ── Query key constants ──────────────────────────────────────────────────────

export const CATALOG_QUERY_KEY = ["admin", "catalog"] as const;
export const SUFFIX_QUERY_KEY = ["admin", "category-suffixes"] as const;

// ── Catalog list query ───────────────────────────────────────────────────────

export function useAdminCatalogList(
  searchQuery: string,
  page: number,
  limit: number,
) {
  const { data: queryResult, isLoading } = useQuery({
    queryKey: [...CATALOG_QUERY_KEY, page, limit, searchQuery],
    queryFn: () => adminApi.listCatalog(searchQuery || undefined, page, limit),
  });

  const rows = queryResult?.data ?? [];
  const paginationMeta = queryResult?.pagination;
  const pageCount = paginationMeta
    ? Math.ceil(paginationMeta.total / limit)
    : 1;

  return { rows, paginationMeta, pageCount, isLoading };
}

// ── Create / Update medicament mutation (used in MedicamentFormDialog) ────────

export function useCatalogMutation(opts: {
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: (params: {
      isEdit: boolean;
      editId?: number;
      body: Omit<MedicamentOut, "id">;
    }) => {
      return params.isEdit
        ? adminApi.updateMedicament(params.editId!, params.body)
        : adminApi.createMedicament(params.body);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
      toast.success(
        variables.isEdit ? "Médicament mis à jour" : "Médicament ajouté",
      );
      opts.onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  return { mutate, isPending };
}

// ── Delete medicament mutation ───────────────────────────────────────────────

export function useCatalogDelete(opts: { onSuccess: () => void }) {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: (id: number) => adminApi.deleteMedicament(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
      toast.success("Médicament supprimé");
      opts.onSuccess();
    },
    onError: (err) => toast.error(err.message),
  });

  return { mutate, isPending };
}

// ── Import catalog CSV mutation ──────────────────────────────────────────────

export function useCatalogImport(opts: {
  onSettled: () => void;
}) {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: (file: File) => adminApi.importCatalog(file),
    onSuccess: (data: { imported: number }) => {
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
      toast.success(`Catalogue importé — ${data.imported} médicaments`);
      opts.onSettled();
    },
    onError: (err) => {
      toast.error(err.message);
      opts.onSettled();
    },
  });

  return { mutate, isPending };
}

// ── Suffix list query ────────────────────────────────────────────────────────

export function useSuffixList() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: SUFFIX_QUERY_KEY,
    queryFn: adminApi.listCategorySuffixes,
  });

  return { rows, isLoading };
}

// ── Suffix save (create / update) mutation ───────────────────────────────────

export function useSuffixSave(opts: { onSuccess: () => void }) {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: (params: {
      editing: CategorySuffixOut | null;
      form: { category: string; suffix: string; color: string | null };
    }) =>
      params.editing
        ? adminApi.updateCategorySuffix(params.editing.id, params.form)
        : adminApi.createCategorySuffix(params.form),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: SUFFIX_QUERY_KEY });
      toast.success(
        variables.editing ? "Mapping mis à jour" : "Mapping créé",
      );
      opts.onSuccess();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { mutate, isPending };
}

// ── Suffix delete mutation ───────────────────────────────────────────────────

export function useSuffixDelete(opts: { onSuccess: () => void }) {
  const queryClient = useQueryClient();

  const { mutate, isPending } = useMutation({
    mutationFn: (id: number) => adminApi.deleteCategorySuffix(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUFFIX_QUERY_KEY });
      toast.success("Mapping supprimé");
      opts.onSuccess();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { mutate, isPending };
}
