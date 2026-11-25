import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/api/client";
import { API } from "@/api/api";
import { useGlobalDateRange } from "@/hooks/useGlobalDateRange";
import { useListFilters } from "@/hooks/useListFilters";

import type { AchatsFilters, AchatsListResponse, AchatsSuggestions, AchatsSupplierSummary } from "@/types/transactions";
import { downloadXlsx, exportFilename } from "@/utils/table";
import { useT } from "@/i18n/I18nProvider";
import { useRefParam } from "../_components/useRefParam";

// Local filter state — same shape as AchatsFilters minus the two date fields
// that now live in the cross-route GlobalDateRangeProvider.
type LocalAchatsFilters = Omit<AchatsFilters, "date_from" | "date_to">;

const DEFAULT_LOCAL: LocalAchatsFilters = {
  page: 1,
  limit: 20,
  search: "",
  category: [],
  tva: [],
  sort_by: null,
  sort_order: "desc",
};

export function useAchatsPage() {
  const t = useT();
  const { from: dateFrom, to: dateTo, setRange } = useGlobalDateRange();
  const {
    filters: localFilters,
    patch,
    setSort,
    setPage,
    setPageSize,
    reset: resetLocal,
  } = useListFilters(DEFAULT_LOCAL, "desc");
  const [suggestQ, setSuggestQ] = useState<string>("");

  // Merge global dates + local fields into the AchatsFilters payload the
  // existing API + sub-components expect.
  // « Voir détail » from a product's « Mouvements »: `?ref=` = every line of that one
  // BL, until its filter is removed.
  const { ref, clearRef } = useRefParam(setPage);
  const filters: AchatsFilters = useMemo(
    () => ({ ...localFilters, ...(ref ? { ref } : {}), date_from: dateFrom, date_to: dateTo }),
    [localFilters, ref, dateFrom, dateTo],
  );

  const {
    data: list,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: API.achats.list.key(filters),
    queryFn: () => api.get<AchatsListResponse>(API.achats.list.url, { params: filters }),
  });

  // Supplier summary ignores pagination + sort — key on the filter slice that matters
  const summaryKey = useMemo(
    () => ({
      date_from: filters.date_from,
      date_to: filters.date_to,
      search: filters.search,
      ref: filters.ref,
      category: filters.category,
      tva: filters.tva,
    }),
    [filters.date_from, filters.date_to, filters.search, filters.ref, filters.category, filters.tva],
  );
  const { data: supplierSummary, isLoading: supplierLoading } = useQuery({
    queryKey: API.achats.supplierSummary.key(summaryKey),
    queryFn: () =>
      api.get<AchatsSupplierSummary>(API.achats.supplierSummary.url, {
        params: summaryKey,
      }),
  });

  const { data: categories } = useQuery({
    queryKey: API.achats.categories.key,
    queryFn: () => api.get<string[]>(API.achats.categories.url),
    staleTime: 5 * 60_000,
  });
  const { data: tvaRates } = useQuery({
    queryKey: API.achats.tvaRates.key,
    queryFn: () => api.get<string[]>(API.achats.tvaRates.url),
    staleTime: 5 * 60_000,
  });
  const { data: suggestions, isFetching: suggestionsLoading } = useQuery({
    queryKey: API.achats.suggestions.key(suggestQ),
    queryFn: () =>
      api.get<AchatsSuggestions>(API.achats.suggestions.url, {
        params: { q: suggestQ },
      }),
    enabled: suggestQ.length >= 2,
    staleTime: 60_000,
  });

  // Every filter change goes back to page 1 (`patch`); the date range is shared between pages.
  const setSearch = (search: string) => patch({ search });
  const setDateRange = (date_from: string | null, date_to: string | null) => setRange(date_from, date_to);
  const setCategories = (category: string[]) => patch({ category });
  const setTva = (tva: string[]) => patch({ tva });

  const reset = () => {
    resetLocal();
    setRange(null, null);
    clearRef();
  };

  // ── Excel export ─────────────────────────────────────────────────────────
  // Fetches the FULL filter-matching set (server-side, ignoring pagination)
  // and writes an xlsx via the shared helper. 413 → user-facing toast.
  const handleExport = useCallback(async () => {
    try {
      const { data } = await api.get<AchatsListResponse>(API.achats.list.url, {
        params: { ...filters, page: undefined, limit: undefined, export: true },
      });
      const header = [
        "Date BL",
        "Référence",
        "Fournisseur",
        "Produit",
        "Catégorie",
        "Type",
        "TVA",
        "Qté",
        "PPH",
        "PU achat",
        "Péremption",
        "Total",
      ];
      const body = data.map((r) => [
        r.delivery_date ?? "",
        r.delivery_ref_final ?? r.delivery_ref ?? "",
        r.supplier ?? "",
        r.product ?? "",
        r.category ?? "",
        r.category_type === "pharmacie" ? "Pharmacie" : r.category_type === "parapharmacie" ? "Parapharmacie" : "",
        r.tva ?? "",
        r.quantity ?? 0,
        r.pph ?? 0,
        r.unit_price ?? 0,
        r.expiry_date ?? "",
        r.total ?? 0,
      ]);
      await downloadXlsx([header, ...body], exportFilename("ACHAT", "xlsx", filters.date_from, filters.date_to));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("achats.exportFailed");
      toast.error(msg);
    }
  }, [filters, t]);

  return {
    filters,
    clearRef,
    setSearch,
    setDateRange,
    setCategories,
    setTva,
    setSort,
    setPage,
    setPageSize,
    reset,
    suggestQ,
    setSuggestQ,
    handleExport,
    list,
    isLoading,
    isError,
    reload: () => void refetch(),
    supplierSummary,
    supplierLoading,
    categories: categories ?? [],
    tvaRates: tvaRates ?? [],
    suggestions: suggestions ?? null,
    suggestionsLoading,
  };
}
