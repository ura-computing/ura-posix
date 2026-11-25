import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/api/client";
import { API } from "@/api/api";
import { useListFilters } from "@/hooks/useListFilters";
import type { ProductsFilters, ProductsListResponse } from "@/types/products";
import type { CategoryType } from "@/types/stats";
import { downloadXlsx, exportFilename } from "@/utils/table";
import { useT } from "@/i18n/I18nProvider";

const DEFAULT_FILTERS: ProductsFilters = {
  page: 1,
  limit: 25,
  search: "",
  category_type: "all",
  sort_by: "product",
  sort_order: "asc",
};

export function useProduitsPage() {
  const t = useT();
  const { filters, patch, setSort, setPage, setPageSize, reset } = useListFilters(DEFAULT_FILTERS, "desc");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.products.list.key(filters),
    queryFn: () => api.get<ProductsListResponse>(API.products.list.url, { params: filters }),
  });

  // Every filter change goes back to page 1 (`patch`).
  const setSearch = (search: string) => patch({ search });
  const setCategoryType = (category_type: CategoryType) => patch({ category_type });

  // Excel: every matching row (server side, no pagination), French headers.
  const handleExport = useCallback(async () => {
    try {
      const { data: rows } = await api.get<ProductsListResponse>(API.products.list.url, {
        params: { ...filters, page: undefined, limit: undefined, export: true },
      });
      const header = [
        "PID",
        "Produit",
        "Laboratoire",
        "Catégorie",
        "Type",
        "Stock actuel",
        "Vendus 12 mois",
        "PPV",
        "PU moyen",
        "Marge %",
      ];
      const body = rows.map((r) => [
        r.pid,
        r.product,
        r.laboratoire ?? "",
        r.category ?? "",
        r.category_type === "pharmacie" ? "Pharmacie" : "Parapharmacie",
        r.current_stock ?? "",
        r.units_sold_12m,
        r.ppv ?? "",
        r.avg_pu ?? "",
        r.marge_pct ?? "",
      ]);
      await downloadXlsx([header, ...body], exportFilename("PRODUITS", "xlsx"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("products.exportFailed"));
    }
  }, [filters, t]);

  return {
    filters,
    setSearch,
    setCategoryType,
    setSort,
    setPage,
    setPageSize,
    reset,
    handleExport,
    rows: data?.data ?? [],
    total: data?.pagination.total ?? 0,
    salesFrom: data?.sales_from ?? null,
    salesTo: data?.sales_to ?? null,
    isLoading,
    isError,
    reload: () => void refetch(),
  };
}
