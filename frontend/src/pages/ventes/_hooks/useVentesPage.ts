import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  exportVentes,
  listVentes, listVentesCategories, listVentesSuggestions,
  listVentesSurveillanceCounts, listVentesTvaRates,
} from "@/api/transactions";
import { QUERY_KEYS } from "@/types";
import type { SurveillanceTab, VentesFilters, VentesFiltersKey } from "@/types";
import { downloadXlsx, exportFilename } from "@/utils/table";


const DEFAULT_FILTERS: VentesFilters = {
  page:                 1,
  limit:                20,
  date_from:            null,
  date_to:              null,
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
  const [filters, setFilters] = useState<VentesFilters>(DEFAULT_FILTERS);
  const [suggestQ, setSuggestQ] = useState<string>("");

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

  // ── Filter handlers — every one resets pagination to page 1 ──
  const patch = (next: Partial<VentesFilters>) => setFilters((prev) => ({ ...prev, ...next, page: 1 }));

  const setSearch        = (search: string)               => patch({ search });
  const setDateRange     = (date_from: string | null, date_to: string | null) => patch({ date_from, date_to });
  const setCategories    = (category: string[])           => patch({ category });
  const setTva           = (tva: string[])                => patch({ tva });
  const setSurveillance  = (surveillance: SurveillanceTab | null) => patch({ surveillance });
  const setIncludeND     = (include_non_declared: boolean) => patch({ include_non_declared });

  // Sort + page DON'T reset to page 1 → kept out of `patch`.
  // setSort toggles order on same key, resets to "desc" on different key (single source of truth).
  const setSort = (key: string) =>
    setFilters((prev) => ({
      ...prev,
      sort_by:    key,
      sort_order: prev.sort_by === key ? (prev.sort_order === "desc" ? "asc" : "desc") : "desc",
    }));
  const setPage     = (page: number) => setFilters((prev) => ({ ...prev, page }));
  const setPageSize = (limit: number) => setFilters((prev) => ({ ...prev, limit, page: 1 }));

  const reset = () => setFilters(DEFAULT_FILTERS);

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
    categories:  categories.data ?? [],
    tvaRates:    tvaRates.data ?? [],
    suggestions: suggestions.data ?? null,
    suggestionsLoading: suggestions.isFetching,
  };
}