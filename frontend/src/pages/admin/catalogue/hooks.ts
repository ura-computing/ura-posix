/** /admin/catalogue page state: filters + pagination + sort + CRUD + CSV import. */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/api/client";
import { API, refresh } from "@/api/api";
import { useT } from "@/i18n/I18nProvider";

import type {
  CatalogFilters,
  CatalogImportResponse,
  CatalogListResponse,
  Medicament,
  MedicamentInput,
  ProductType,
} from "@/types";

const DEFAULT_FILTERS: CatalogFilters = {
  search: "",
  category: [],
  type: null,
  sort_by: "product",
  sort_order: "asc",
  page: 1,
  limit: 25,
};

export function useCatalogPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<CatalogFilters>(DEFAULT_FILTERS);

  const {
    data: list,
    isLoading,
    isError,
  } = useQuery({
    queryKey: API.admin.catalog.list.key(filters),
    queryFn: () => api.get<CatalogListResponse>(API.admin.catalog.list.url, { params: filters }),
  });

  const { data: categories } = useQuery({
    queryKey: API.admin.catalog.categories.key,
    queryFn: () => api.get<string[]>(API.admin.catalog.categories.url),
    staleTime: 5 * 60_000,
  });

  // Filter helpers — every filter change resets pagination to page 1.
  const patch = (next: Partial<CatalogFilters>) => setFilters((p) => ({ ...p, ...next, page: 1 }));
  const setSearch = (search: string) => patch({ search });
  const setCategories = (category: string[]) => patch({ category });
  const setType = (type: ProductType | "unclassified" | null) => patch({ type });

  // Sort: toggle order on same key, reset to "asc" on new key.
  const setSort = (key: string) =>
    setFilters((p) => ({
      ...p,
      sort_by: key,
      sort_order: p.sort_by === key ? (p.sort_order === "asc" ? "desc" : "asc") : "asc",
    }));
  const setPage = (page: number) => setFilters((p) => ({ ...p, page }));
  const setPageSize = (limit: number) => setFilters((p) => ({ ...p, limit, page: 1 }));

  const reset = () => setFilters(DEFAULT_FILTERS);

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: (body: MedicamentInput) => api.post<Medicament>(API.admin.catalog.create.url, body),
    onSuccess: () => {
      toast.success(t("catalogue.toastCreated"));
      void refresh(queryClient, API.admin.catalog.create);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { mutate: update, isPending: isUpdating } = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<MedicamentInput> }) =>
      api.put<Medicament>(API.admin.catalog.update.url(id), body),
    onSuccess: () => {
      toast.success(t("catalogue.toastUpdated"));
      void refresh(queryClient, API.admin.catalog.update);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { mutate: remove, isPending: isRemoving } = useMutation({
    mutationFn: (id: number) => api.delete(API.admin.catalog.remove.url(id)),
    onSuccess: () => {
      toast.success(t("catalogue.toastDeleted"));
      void refresh(queryClient, API.admin.catalog.remove);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const {
    mutate: importCsv,
    isPending: isImporting,
    data: lastImport,
  } = useMutation({
    mutationFn: (file: File) => api.upload<CatalogImportResponse>(API.admin.catalog.importCsv.url, file),
    onSuccess: (r) => {
      toast.success(t("catalogue.toastImport", { inserted: r.inserted, updated: r.updated, skipped: r.skipped }));
      void refresh(queryClient, API.admin.catalog.importCsv);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    filters,
    setSearch,
    setCategories,
    setType,
    setSort,
    setPage,
    setPageSize,
    reset,
    list,
    isLoading,
    isError,
    categories: categories ?? [],
    create,
    update,
    remove,
    importCsv, // update({ id, body })
    isCreating,
    isUpdating,
    isRemoving,
    isImporting,
    lastImport,
  };
}

export type { Medicament };
