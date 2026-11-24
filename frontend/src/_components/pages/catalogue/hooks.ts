/** The catalogue page's state (/admin/catalogue, /support/catalogue): filters + pagination + sort + CRUD + CSV import + « Importer les produits depuis
 *  Sobrus ». */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/api/client";
import { API, refresh } from "@/api/api";
import { useAdminSobrusImport } from "@/hooks/useSharedQueries";
import { useListFilters } from "@/hooks/useListFilters";
import { useT } from "@/i18n/I18nProvider";

import type {
  AdminSobrusImport,
  CatalogFilters,
  CatalogStats,
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
  const { filters, patch, setSort, setPage, setPageSize, reset } = useListFilters(DEFAULT_FILTERS, "asc");

  const {
    data: list,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: API.admin.catalog.list.key(filters),
    queryFn: () =>
      api.get<CatalogListResponse>(API.admin.catalog.list.url, {
        params: filters,
      }),
  });

  const { data: categories } = useQuery({
    queryKey: API.admin.catalog.categories.key,
    queryFn: () => api.get<string[]>(API.admin.catalog.categories.url),
    staleTime: 5 * 60_000,
  });

  // Every filter change goes back to page 1 (`patch`).
  const setSearch = (search: string) => patch({ search });
  const setCategories = (category: string[]) => patch({ category });
  const setType = (type: ProductType | "unclassified" | null) => patch({ type });

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
      toast.success(
        t("catalogue.toastImport", {
          inserted: r.inserted,
          updated: r.updated,
          skipped: r.skipped,
        }),
      );
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
    reload: () => void refetch(),
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

/** « Importer les produits depuis Sobrus »: the robot reads one owner's Sobrus product list (the next one if Sobrus
 *  refuses it). Its progress: the shared query (also the corner card on every admin page, which reloads the
 *  catalogue when it ends). */
export function useSobrusProductsImport() {
  const t = useT();
  const queryClient = useQueryClient();
  const { sobrusImport, isLoading, isRunning } = useAdminSobrusImport();

  const { mutateAsync: start, isPending: isStarting } = useMutation({
    mutationFn: () => api.post<{ pharmacy_name: string }>(API.admin.startSobrusProducts.url, {}),
    onSuccess: ({ pharmacy_name }) => {
      toast.success(t("catalogue.sobrusStarted", { name: pharmacy_name }));
      void refresh(queryClient, API.admin.startSobrusProducts);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { mutateAsync: cancel, isPending: isCancelling } = useMutation({
    mutationFn: () => api.post<AdminSobrusImport>(API.admin.cancelSobrusProducts.url, {}),
    onSuccess: () => void refresh(queryClient, API.admin.cancelSobrusProducts),
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    sobrusImport,
    isLoading,
    isRunning,
    startImport: () => start().then(() => undefined),
    isStarting,
    stopImport: () => cancel().then(() => undefined),
    isCancelling,
  };
}

/** The catalogue at a glance (tiles on top of its page). Refreshed by every catalogue write and when a Sobrus import
 *  ends (`API.admin.catalog.importCsv` refreshes). */
export function useCatalogStats() {
  const { data, isLoading } = useQuery({
    queryKey: API.admin.catalog.stats.key,
    queryFn: () => api.get<CatalogStats>(API.admin.catalog.stats.url),
  });
  return { stats: data ?? null, isLoading };
}
