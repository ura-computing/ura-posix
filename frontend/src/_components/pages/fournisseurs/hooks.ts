/** « Fournisseurs » (/admin/fournisseurs, /support/fournisseurs): the supplier list shared by every pharmacy, one
 *  page at a time (server side), search + kind. Reloaded every 5 s while « Importer depuis Sobrus » runs. */
import { useQuery } from "@tanstack/react-query";

import { API } from "@/api/api";
import { api } from "@/api/client";
import { useListFilters } from "@/hooks/useListFilters";
import { useAdminSobrusImport } from "@/hooks/useSharedQueries";
import type { SupplierFilters, SupplierKind, SupplierListResponse } from "@/types/suppliers";

const DEFAULT_FILTERS: SupplierFilters = {
  search: "",
  kind: null,
  archived: false,
  sort_by: "name",
  sort_order: "asc",
  page: 1,
  limit: 25,
};

export function useFournisseursPage() {
  const { filters, patch, setSort, setPage, setPageSize, reset } = useListFilters(DEFAULT_FILTERS, "asc");
  const { isRunning } = useAdminSobrusImport("suppliers");
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.admin.suppliers.key(filters),
    queryFn: () => api.get<SupplierListResponse>(API.admin.suppliers.url, { params: filters }),
    refetchInterval: isRunning ? 5000 : false,
  });

  return {
    filters,
    setSearch: (search: string) => patch({ search }),
    setKind: (kind: SupplierKind | null) => patch({ kind }),
    setArchived: (archived: boolean) => patch({ archived }),
    setSort,
    setPage,
    setPageSize,
    reset,
    rows: data?.data ?? [],
    total: data?.pagination.total ?? 0,
    isLoading,
    isError,
    reload: () => void refetch(),
  };
}
