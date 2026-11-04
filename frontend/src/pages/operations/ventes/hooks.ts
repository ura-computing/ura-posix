import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@/api/client";
import { API } from "@/api/api";
import { useGlobalDateRange } from "@/hooks/useGlobalDateRange";
import { useVentesList } from "@/hooks/sharedQueries";
import { useListFilters } from "@/hooks/useListFilters";

import type {
  SurveillanceTab,
  VentesDiscountSummary,
  VentesFilters,
  VentesFiltersKey,
  VentesListResponse,
  VentesSuggestions,
  VentesSurveillanceCounts,
} from "@/types";
import { downloadXlsx, exportFilename } from "@/utils/table";
import { useT } from "@/i18n/I18nProvider";

// Local filter state — date fields live in the cross-route global context.
type LocalVentesFilters = Omit<VentesFilters, "date_from" | "date_to">;

const DEFAULT_LOCAL: LocalVentesFilters = {
  page: 1,
  limit: 20,
  search: "",
  category: [],
  tva: [],
  surveillance: null,
  include_non_declared: true,
  sort_by: null,
  sort_order: "desc",
};

/** Pull surveillance + sort + pagination out so the cache key is stable across page/sort changes
 *  for the same filter set (counts share this trimmed key too). */
function trimForKey(f: VentesFilters): VentesFiltersKey {
  const { sort_by: _sb, sort_order: _so, ...rest } = f;
  return rest;
}

export function useVentesPage() {
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

  // Merge global dates + local fields into the VentesFilters payload the
  // existing API + sub-components expect.
  // « Voir détail » from a product's « Mouvements »: `?ref=` = every line of that one
  // ticket, until its filter is removed.
  const [params, setParams] = useSearchParams();
  const ref = params.get("ref") ?? "";
  const filters: VentesFilters = useMemo(
    () => ({ ...localFilters, ...(ref ? { ref } : {}), date_from: dateFrom, date_to: dateTo }),
    [localFilters, ref, dateFrom, dateTo],
  );
  const clearRef = () => {
    setPage(1);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("ref");
        return next;
      },
      { replace: true },
    );
  };

  const key = useMemo(() => trimForKey(filters), [filters]);

  // Surveillance counts + discount gauge read only these axes (pagination +
  // sort + active surveillance tab ignored).
  const summaryFilters = useMemo(() => {
    const { page: _p, limit: _l, sort_by: _sb, sort_order: _so, surveillance: _s, ...rest } = filters;
    return rest;
  }, [filters]);

  const { ventesList: list, isLoading, isError, reload } = useVentesList(filters);
  const { data: counts } = useQuery({
    queryKey: API.ventes.surveillance.key(key),
    queryFn: () =>
      api.get<VentesSurveillanceCounts>(API.ventes.surveillance.url, {
        params: summaryFilters,
      }),
  });
  const { data: categories } = useQuery({
    queryKey: API.ventes.categories.key,
    queryFn: () => api.get<string[]>(API.ventes.categories.url),
    staleTime: 5 * 60_000,
  });
  const { data: tvaRates } = useQuery({
    queryKey: API.ventes.tvaRates.key,
    queryFn: () => api.get<string[]>(API.ventes.tvaRates.url),
    staleTime: 5 * 60_000,
  });
  const { data: suggestions, isFetching: suggestionsLoading } = useQuery({
    queryKey: API.ventes.suggestions.key(suggestQ),
    queryFn: () =>
      api.get<VentesSuggestions>(API.ventes.suggestions.url, {
        params: { q: suggestQ },
      }),
    enabled: suggestQ.length >= 2,
    staleTime: 60_000,
  });

  const { data: discountSummary, isLoading: discountLoading } = useQuery({
    queryKey: API.ventes.discountSummary.key(summaryFilters),
    queryFn: () =>
      api.get<VentesDiscountSummary>(API.ventes.discountSummary.url, {
        params: summaryFilters,
      }),
    staleTime: 60_000,
  });

  // Every filter change goes back to page 1 (`patch`); the date range is shared between pages.
  const setSearch = (search: string) => patch({ search });
  const setDateRange = (date_from: string | null, date_to: string | null) => setRange(date_from, date_to);
  const setCategories = (category: string[]) => patch({ category });
  const setTva = (tva: string[]) => patch({ tva });
  const setSurveillance = (surveillance: SurveillanceTab | null) => patch({ surveillance });
  const setIncludeND = (include_non_declared: boolean) => patch({ include_non_declared });

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
      const { data } = await api.get<VentesListResponse>(API.ventes.list.url, {
        params: { ...filters, page: undefined, limit: undefined, export: true },
      });
      const header = [
        "Date",
        "N° transaction",
        "Client",
        "Produit",
        "Catégorie",
        "Type",
        "TVA",
        "PPV",
        "Qté",
        "Remise",
        "PU vente",
        "Sous-total",
        "PU moyen",
        "Total",
      ];
      const body = data.map((r) => [
        r.date ?? "",
        r.transaction_ref_final ?? r.transaction_ref ?? "",
        r.client ?? "",
        r.product ?? "",
        r.category ?? "",
        r.category_type === "pharmacie" ? "Pharmacie" : r.category_type === "parapharmacie" ? "Parapharmacie" : "",
        r.tva ?? "",
        r.ppv ?? 0,
        r.quantity ?? 0,
        r.discount ?? 0,
        r.unit_price ?? 0,
        r.subtotal ?? 0,
        r.avg_pu ?? 0,
        r.total ?? 0,
      ]);
      await downloadXlsx([header, ...body], exportFilename("VENTE", "xlsx", filters.date_from, filters.date_to));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("ventes.exportFailed");
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
    setSurveillance,
    setIncludeND,
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
    reload,
    counts,
    discountSummary,
    discountLoading,
    categories: categories ?? [],
    tvaRates: tvaRates ?? [],
    suggestions: suggestions ?? null,
    suggestionsLoading,
  };
}
