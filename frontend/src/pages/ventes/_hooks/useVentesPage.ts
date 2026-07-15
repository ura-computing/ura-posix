import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  exportVentes,
  listVentes, listVentesCategories, listVentesDiscountSummary,
  listVentesSuggestions, listVentesSurveillanceCounts, listVentesTvaRates,
} from "@/api/transactions";
import { useGlobalDateRange } from "@/hooks/useGlobalDateRange";
import { QUERY_KEYS } from "@/types";
import type { SurveillanceTab, VentesFilters, VentesFiltersKey } from "@/types";
import { downloadXlsx, exportFilename } from "@/utils/table";


// Local filter state — date fields live in the cross-route global context.
type LocalVentesFilters = Omit<VentesFilters, "date_from" | "date_to">;

const DEFAULT_LOCAL: LocalVentesFilters = {
  page:                 1,
  limit:                20,
  search:               "",
  category:             [],
  tva:                  [],
  surveillance:         null,
  include_non_declared: true,
  sort_by:              null,
  sort_order:           "desc",
};


/** Pull surveillance + sort + pagination out so the cache key is stable across page/sort changes
 *  for the same filter set (counts share this trimmed key too). */
function trimForKey(f: VentesFilters): VentesFiltersKey {
  const { sort_by: _sb, sort_order: _so, ...rest } = f;
  return rest;
}


export function useVentesPage() {
  const { from: dateFrom, to: dateTo, setRange } = useGlobalDateRange();
  const [localFilters, setLocal] = useState<LocalVentesFilters>(DEFAULT_LOCAL);
  const [suggestQ, setSuggestQ] = useState<string>("");

  // Merge global dates + local fields into the VentesFilters payload the
  // existing API + sub-components expect.
  const filters: VentesFilters = useMemo(
    () => ({ ...localFilters, date_from: dateFrom, date_to: dateTo }),
    [localFilters, dateFrom, dateTo],
  );

  const key = useMemo(() => trimForKey(filters), [filters]);

  const list = useQuery({
    queryKey: QUERY_KEYS.VENTES(filters),
    queryFn:  () => listVentes(filters),
  });
  const counts = useQuery({
    queryKey: QUERY_KEYS.VENTES_SURVEILLANCE(key),
    queryFn:  () => listVentesSurveillanceCounts(filters),
  });
  const categories = useQuery({
    queryKey: QUERY_KEYS.VENTES_CATEGORIES,
    queryFn:  listVentesCategories,
    staleTime: 5 * 60_000,
  });
  const tvaRates = useQuery({
    queryKey: QUERY_KEYS.VENTES_TVA_RATES,
    queryFn:  listVentesTvaRates,
    staleTime: 5 * 60_000,
  });
  const suggestions = useQuery({
    queryKey: QUERY_KEYS.VENTES_SUGGESTIONS(suggestQ),
    queryFn:  () => listVentesSuggestions(suggestQ),
    enabled:  suggestQ.length >= 2,
    staleTime: 60_000,
  });

  // Discount gauge: key on the filter axes the endpoint actually reads
  // (pagination + sort + surveillance ignored). Same trim as the API client.
  const discountKey = useMemo(() => {
    const { page: _p, limit: _l, sort_by: _sb, sort_order: _so, surveillance: _s, ...rest } = filters;
    return rest;
  }, [filters]);
  const discountSummaryQ = useQuery({
    queryKey: QUERY_KEYS.VENTES_DISCOUNT_SUMMARY(discountKey),
    queryFn:  () => listVentesDiscountSummary(filters),
    staleTime: 60_000,
  });

  // Local-filter patch resets pagination; sort + page do not. Date range
  // is the only filter routed through the global context.
  const patch = (next: Partial<LocalVentesFilters>) =>
    setLocal((prev) => ({ ...prev, ...next, page: 1 }));

  const setSearch        = (search: string)               => patch({ search });
  const setDateRange     = (date_from: string | null, date_to: string | null) => setRange(date_from, date_to);
  const setCategories    = (category: string[])           => patch({ category });
  const setTva           = (tva: string[])                => patch({ tva });
  const setSurveillance  = (surveillance: SurveillanceTab | null) => patch({ surveillance });
  const setIncludeND     = (include_non_declared: boolean) => patch({ include_non_declared });

  // Sort + page DON'T reset to page 1 → kept out of `patch`.
  // setSort toggles order on same key, resets to "desc" on different key.
  const setSort = (key: string) =>
    setLocal((prev) => ({
      ...prev,
      sort_by:    key,
      sort_order: prev.sort_by === key ? (prev.sort_order === "desc" ? "asc" : "desc") : "desc",
    }));
  const setPage     = (page: number) => setLocal((prev) => ({ ...prev, page }));
  const setPageSize = (limit: number) => setLocal((prev) => ({ ...prev, limit, page: 1 }));

  const reset = () => {
    setLocal(DEFAULT_LOCAL);
    setRange(null, null);
  };

  // ── Excel export ─────────────────────────────────────────────────────────
  // Fetches the FULL filter-matching set (server-side, ignoring pagination)
  // and writes an xlsx via the shared helper. 413 → user-facing toast.
  const handleExport = useCallback(async () => {
    try {
      const { data } = await exportVentes(filters);
      const header = [
        "Date", "N° transaction", "Client", "Produit", "Catégorie",
        "Type", "TVA", "PPV", "Qté", "Remise", "PU vente", "Sous-total",
        "PU moyen", "Total",
      ];
      const body = data.map((r) => [
        r.date ?? "",
        r.transaction_ref_final ?? r.transaction_ref ?? "",
        r.client ?? "",
        r.product ?? "",
        r.category ?? "",
        r.category_type === "pharmacie" ? "Pharmacie"
          : r.category_type === "parapharmacie" ? "Parapharmacie"
          : "",
        r.tva ?? "",
        r.ppv ?? 0,
        r.quantity ?? 0,
        r.discount ?? 0,
        r.unit_price ?? 0,
        r.subtotal ?? 0,
        r.avg_pu ?? 0,
        r.total ?? 0,
      ]);
      await downloadXlsx(
        [header, ...body],
        exportFilename("VENTE", "xlsx", filters.date_from, filters.date_to),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "L'export a échoué.";
      toast.error(msg);
    }
  }, [filters]);

  return {
    filters,
    setSearch, setDateRange, setCategories, setTva, setSurveillance, setIncludeND,
    setSort, setPage, setPageSize, reset,
    suggestQ, setSuggestQ,
    handleExport,
    list:        list.data,
    isLoading:   list.isLoading,
    isError:     list.isError,
    counts:      counts.data,
    discountSummary: discountSummaryQ.data,
    discountLoading: discountSummaryQ.isLoading,
    categories:  categories.data ?? [],
    tvaRates:    tvaRates.data ?? [],
    suggestions: suggestions.data ?? null,
    suggestionsLoading: suggestions.isFetching,
  };
}