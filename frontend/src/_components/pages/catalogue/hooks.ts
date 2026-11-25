/** The catalogue page's state (/admin/catalogue, /support/catalogue): filters + pagination + sort + CRUD + CSV import + « Importer les produits depuis
 *  Sobrus ». */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/api/client";
import { API, refresh } from "@/api/api";
import { useListFilters } from "@/hooks/useListFilters";
import { useT } from "@/i18n/I18nProvider";
import { downloadXlsx, exportFilename } from "@/utils/table";

import type {
  CatalogFilters,
  CatalogStats,
  CatalogImportResponse,
  CatalogListResponse,
  Medicament,
  MedicamentInput,
  ProductType,
} from "@/types/catalog";

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

  // Excel: every matching row (server side, no pagination), every field the Sobrus import reads, French headers.
  const handleExport = async () => {
    try {
      const { data: rows } = await api.get<CatalogListResponse>(API.admin.catalog.list.url, {
        params: { ...filters, page: undefined, limit: undefined, export: true },
      });
      const header = [
        "PID Sobrus",
        "Produit",
        "Code barre",
        "Code barre 2",
        "Laboratoire",
        "Catégorie",
        "Type",
        "DCI",
        "Forme galénique",
        "TVA",
        "PPH",
        "PPV",
      ];
      const type = { pharmacie: "Pharmacie", parapharmacie: "Parapharmacie" };
      // A product from the catalogue CSV has no Sobrus ID: its PID is made from its barcode or its name
      // (`csv_parse._derive_pid`), so the cell stays empty.
      const sobrusPid = (r: Medicament) => (/^\d+$/.test(r.pid) && r.pid !== r.barcode1 ? r.pid : "");
      const body = rows.map((r) => [
        sobrusPid(r),
        r.product,
        r.barcode1 ?? "",
        r.barcode2 ?? "",
        r.laboratoire ?? "",
        r.category ?? "",
        r.product_type ? type[r.product_type] : "",
        r.dci ?? "",
        r.galenic_form ?? "",
        r.tva ?? "",
        r.pph ?? "",
        r.ppv ?? "",
      ]);
      await downloadXlsx([header, ...body], exportFilename("PRODUITS_CATALOGUE", "xlsx"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("catalogue.exportFailed"));
    }
  };

  return {
    filters,
    handleExport,
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

/** The catalogue at a glance (tiles on top of its page). Refreshed by every catalogue write and when a Sobrus import
 *  ends (`API.admin.catalog.importCsv` refreshes). */
export function useCatalogStats() {
  const { data, isLoading } = useQuery({
    queryKey: API.admin.catalog.stats.key,
    queryFn: () => api.get<CatalogStats>(API.admin.catalog.stats.url),
  });
  return { stats: data ?? null, isLoading };
}
