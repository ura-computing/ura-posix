import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  listAchats,
  listAchatsCategories,
  listAchatsSuggestions,
  listAchatsSupplierSummary,
  listAchatsTvaRates,
} from "@/api/transactions";
import { QUERY_KEYS } from "@/types";
import type { AchatsFilters } from "@/types";


const DEFAULT_FILTERS: AchatsFilters = {
  page:       1,
  limit:      20,
  date_from:  null,
  date_to:    null,
  search:     "",
  category:   [],
  tva:        [],
  sort_by:    null,
  sort_order: "desc",
};


export function useAchatsPage() {
  const [filters, setFilters] = useState<AchatsFilters>(DEFAULT_FILTERS);
  const [suggestQ, setSuggestQ] = useState<string>("");

  const list = useQuery({
    queryKey: QUERY_KEYS.ACHATS(filters),
    queryFn:  () => listAchats(filters),
  });

  // Supplier summary ignores pagination + sort — key on the filter slice that matters
  const summaryKey = useMemo(
    () => ({ date_from: filters.date_from, date_to: filters.date_to, search: filters.search, category: filters.category, tva: filters.tva }),
    [filters.date_from, filters.date_to, filters.search, filters.category, filters.tva],
  );
  const supplierSummary = useQuery({
    queryKey: QUERY_KEYS.ACHATS_SUPPLIER_SUMMARY(summaryKey),
    queryFn:  () => listAchatsSupplierSummary(filters),
  });

  const categories = useQuery({
    queryKey:  QUERY_KEYS.ACHATS_CATEGORIES,
    queryFn:   listAchatsCategories,
    staleTime: 5 * 60_000,
  });
  const tvaRates = useQuery({
    queryKey:  QUERY_KEYS.ACHATS_TVA_RATES,
    queryFn:   listAchatsTvaRates,
    staleTime: 5 * 60_000,
  });
  const suggestions = useQuery({
    queryKey:  QUERY_KEYS.ACHATS_SUGGESTIONS(suggestQ),
    queryFn:   () => listAchatsSuggestions(suggestQ),
    enabled:   suggestQ.length >= 2,
    staleTime: 60_000,
  });

  // Filter handlers reset pagination; sort + page do not.
  const patch = (next: Partial<AchatsFilters>) => setFilters((p) => ({ ...p, ...next, page: 1 }));

  const setSearch     = (search: string) => patch({ search });
  const setDateRange  = (date_from: string | null, date_to: string | null) => patch({ date_from, date_to });
  const setCategories = (category: string[]) => patch({ category });
  const setTva        = (tva: string[]) => patch({ tva });

  // Toggle order on same key; reset to "desc" on different key. Single source of truth.
  const setSort = (key: string) =>
    setFilters((p) => ({
      ...p,
      sort_by:    key,
      sort_order: p.sort_by === key ? (p.sort_order === "desc" ? "asc" : "desc") : "desc",
    }));
  const setPage     = (page: number) => setFilters((p) => ({ ...p, page }));
  const setPageSize = (limit: number) => setFilters((p) => ({ ...p, limit, page: 1 }));

  const reset = () => setFilters(DEFAULT_FILTERS);

  return {
    filters,
    setSearch, setDateRange, setCategories, setTva, setSort, setPage, setPageSize, reset,
    suggestQ, setSuggestQ,
    list:               list.data,
    isLoading:          list.isLoading,
    isError:            list.isError,
    supplierSummary:    supplierSummary.data,
    categories:         categories.data ?? [],
    tvaRates:           tvaRates.data ?? [],
    suggestions:        suggestions.data ?? null,
    suggestionsLoading: suggestions.isFetching,
  };
}