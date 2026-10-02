import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/api/client";
import { URLS } from "@/api/urls";
import { useGlobalDateRange } from "@/hooks/useGlobalDateRange";
import { QUERY_KEYS } from "@/types";
import type { AchatsFilters, AchatsListResponse, AchatsSuggestions, AchatsSupplierSummary } from "@/types";
import { downloadXlsx, exportFilename } from "@/utils/table";
import { useT } from "@/i18n/I18nProvider";


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
  const [localFilters, setLocal] = useState<LocalAchatsFilters>(DEFAULT_LOCAL);
  const [suggestQ, setSuggestQ] = useState<string>("");

  // Merge global dates + local fields into the AchatsFilters payload the
  // existing API + sub-components expect.
  const filters: AchatsFilters = useMemo(
    () => ({ ...localFilters, date_from: dateFrom, date_to: dateTo }),
    [localFilters, dateFrom, dateTo],
  );

  const list = useQuery({
    queryKey: QUERY_KEYS.ACHATS(filters),
    queryFn: () => api.get<AchatsListResponse>(URLS.achats.list, { params: filters }),
  });

  // Supplier summary ignores pagination + sort — key on the filter slice that matters
  const summaryKey = useMemo(
    () => ({ date_from: filters.date_from, date_to: filters.date_to, search: filters.search, category: filters.category, tva: filters.tva }),
    [filters.date_from, filters.date_to, filters.search, filters.category, filters.tva],
  );
  const supplierSummary = useQuery({
    queryKey: QUERY_KEYS.ACHATS_SUPPLIER_SUMMARY(summaryKey),
    queryFn: () => api.get<AchatsSupplierSummary>(URLS.achats.supplierSummary, { params: summaryKey }),
  });

  const categories = useQuery({
    queryKey: QUERY_KEYS.ACHATS_CATEGORIES,
    queryFn: () => api.get<string[]>(URLS.achats.categories),
    staleTime: 5 * 60_000,
  });
  const tvaRates = useQuery({
    queryKey: QUERY_KEYS.ACHATS_TVA_RATES,
    queryFn: () => api.get<string[]>(URLS.achats.tvaRates),
    staleTime: 5 * 60_000,
  });
  const suggestions = useQuery({
    queryKey: QUERY_KEYS.ACHATS_SUGGESTIONS(suggestQ),
    queryFn: () => api.get<AchatsSuggestions>(URLS.achats.suggestions, { params: { q: suggestQ } }),
    enabled: suggestQ.length >= 2,
    staleTime: 60_000,
  });

  // Local-filter patch resets pagination; sort + page do not. Date range
  // is the only filter routed through the global context.
  const patch = (next: Partial<LocalAchatsFilters>) =>
    setLocal((p) => ({ ...p, ...next, page: 1 }));

  const setSearch = (search: string) => patch({ search });
  const setDateRange = (date_from: string | null, date_to: string | null) => setRange(date_from, date_to);
  const setCategories = (category: string[]) => patch({ category });
  const setTva = (tva: string[]) => patch({ tva });

  // Toggle order on same key; reset to "desc" on different key.
  const setSort = (key: string) =>
    setLocal((p) => ({
      ...p,
      sort_by: key,
      sort_order: p.sort_by === key ? (p.sort_order === "desc" ? "asc" : "desc") : "desc",
    }));
  const setPage = (page: number) => setLocal((p) => ({ ...p, page }));
  const setPageSize = (limit: number) => setLocal((p) => ({ ...p, limit, page: 1 }));

  const reset = () => {
    setLocal(DEFAULT_LOCAL);
    setRange(null, null);
  };

  // ── Excel export ─────────────────────────────────────────────────────────
  // Fetches the FULL filter-matching set (server-side, ignoring pagination)
  // and writes an xlsx via the shared helper. 413 → user-facing toast.
  const handleExport = useCallback(async () => {
    try {
      const { data } = await api.get<AchatsListResponse>(URLS.achats.list, {
        params: { ...filters, page: undefined, limit: undefined, export: true },
      });
      const header = [
        "Date BL", "Référence", "Fournisseur", "Produit", "Catégorie",
        "Type", "TVA", "Qté", "PPH", "PU achat", "Péremption", "Total",
      ];
      const body = data.map((r) => [
        r.delivery_date ?? "",
        r.delivery_ref_final ?? r.delivery_ref ?? "",
        r.supplier ?? "",
        r.product ?? "",
        r.category ?? "",
        r.category_type === "pharmacie" ? "Pharmacie"
          : r.category_type === "parapharmacie" ? "Parapharmacie"
            : "",
        r.tva ?? "",
        r.quantity ?? 0,
        r.pph ?? 0,
        r.unit_price ?? 0,
        r.expiry_date ?? "",
        r.total ?? 0,
      ]);
      await downloadXlsx(
        [header, ...body],
        exportFilename("ACHAT", "xlsx", filters.date_from, filters.date_to),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("achats.exportFailed");
      toast.error(msg);
    }
  }, [filters, t]);

  return {
    filters,
    setSearch, setDateRange, setCategories, setTva, setSort, setPage, setPageSize, reset,
    suggestQ, setSuggestQ,
    handleExport,
    list: list.data,
    isLoading: list.isLoading,
    isError: list.isError,
    supplierSummary: supplierSummary.data,
    supplierLoading: supplierSummary.isLoading,
    categories: categories.data ?? [],
    tvaRates: tvaRates.data ?? [],
    suggestions: suggestions.data ?? null,
    suggestionsLoading: suggestions.isFetching,
  };
}