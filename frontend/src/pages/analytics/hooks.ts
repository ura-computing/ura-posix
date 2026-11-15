// src/pages/alertes/_hooks/useAlertesPage.ts
import { useCallback, useMemo, useState } from "react";
// Already shipped at @/hooks/stats:
import { useGlobalDateRange } from "@/hooks/useGlobalDateRange";
import { useMarginAlerts, type MarginAlertsFilters } from "@/hooks/sharedQueries";
import type { AlertColumn } from "./_components/alertColumns";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { API } from "@/api/api";

import type { PeremptionsResponse, StockAbcdResponse, StockFilters, VentesSansAchatResponse } from "@/types";

/** Same vocabulary as StatsFilters.category_type so the segmented selector
 *  matches /rapport visually + semantically. "all" = no filter. */
export type CategoryType = "all" | "pharmacie" | "parapharmacie";

export interface DialogDescriptor {
  title: string;
  subtitle?: string;
  products: unknown[];
  columns: AlertColumn[];
  defaultSortKey: string;
}

/**
 * Bundles the 3 Alertes queries + filter state + client-derived stock
 * brackets/metrics + the shared detail-dialog open/close state.
 *
 * NOTE (intentional, per apcm-pharma audit): the `category` filter is sent ONLY
 * to useMarginAlerts. usePeremptions + useStockAbcd ignore it (their endpoints
 * don't accept category_type), so the péremption + stock cards always reflect
 * the FULL pharmacy.
 */
export function useAlertesPage() {
  // Date range lives in the cross-route global context — picking dates on
  // /alertes carries them over to /achats, /ventes, /rapport, etc.
  const { from: globalFrom, to: globalTo, setRange } = useGlobalDateRange();
  const dateFrom = globalFrom ?? "";
  const dateTo = globalTo ?? "";
  const setDateFrom = (v: string) => setRange(v || null, globalTo);
  const setDateTo = (v: string) => setRange(globalFrom, v || null);
  /** Set BOTH ends at once. Calling setDateFrom then setDateTo loses the new
   *  start: setDateTo still sees the old `globalFrom` (stale closure). */
  const setPeriod = useCallback(
    (from: string | null, to: string | null) => setRange(from || null, to || null),
    [setRange],
  );
  const [category, setCategory] = useState<CategoryType>("all");
  const [dialog, setDialog] = useState<DialogDescriptor | null>(null);

  const {
    marginAlerts: margin,
    isLoading: marginLoading,
    isError: marginError,
    reload: reloadMargin,
  } = useMarginAlerts({
    date_from: dateFrom || null,
    date_to: dateTo || null,
    category_type: category || "all",
  });
  const {
    ventesSansAchat: vsa,
    isLoading: vsaLoading,
    isError: vsaError,
    reload: reloadVsa,
  } = useVentesSansAchat({
    date_from: dateFrom || null,
    date_to: dateTo || null,
    category_type: category || "all",
  });
  // ignores date + category (backend)
  const { peremptions: perem, isLoading: peremLoading, isError: peremError, reload: reloadPerem } = usePeremptions();
  const {
    abcd,
    isLoading: stockLoading,
    isError: stockError,
    reload: reloadStock,
  } = useStockAbcd({
    date_from: dateFrom || null,
    date_to: dateTo || null,
  }); // ignores category

  // ---- stock alerts derived CLIENT-SIDE from stockAbcd.products ----
  const products = useMemo(() => abcd?.products ?? [], [abcd]);
  const negatif = useMemo(() => products.filter((p) => p.status === "negatif"), [products]);
  const sousStock = useMemo(() => products.filter((p) => p.status === "sous-stock"), [products]);
  const surStock = useMemo(() => products.filter((p) => p.status === "sur-stock"), [products]);

  // ---- stock metrics (exact apcm-pharma formulas) ----
  const negUnits = useMemo(
    () =>
      negatif.reduce((s, p) => s + (p.current_stock != null && p.current_stock < 0 ? Math.abs(p.current_stock) : 0), 0),
    [negatif],
  );
  const sousPpv = useMemo(
    () =>
      sousStock.reduce(
        (s, p) => (p.ppv != null ? s + p.ppv * Math.max(0, p.stock_min - (p.current_stock ?? 0)) : s),
        0,
      ),
    [sousStock],
  );
  const surPpv = useMemo(
    () =>
      surStock.reduce((s, p) => (p.ppv != null ? s + p.ppv * Math.max(0, (p.current_stock ?? 0) - p.stock_max) : s), 0),
    [surStock],
  );

  const counts = {
    marginNeg: margin?.negative.count ?? 0,
    marginLow: margin?.low.count ?? 0,
    ventesSansAchat: vsa?.count ?? 0,
    expired: perem?.expired.count ?? 0,
    veryClose: perem?.very_close.count ?? 0,
    close: perem?.close.count ?? 0,
    negatif: negatif.length,
    sousStock: sousStock.length,
    surStock: surStock.length,
  };
  // Total actionable alerts across all brackets.
  const totalAlerts = Object.values(counts).reduce((a, b) => a + b, 0);
  // Expired + very-close = the "act today" subset.
  const peremptionCritical = counts.expired + counts.veryClose;

  const isLoading = marginLoading || peremLoading || stockLoading || vsaLoading;
  const isError = marginError || peremError || stockError || vsaError;
  const isEmpty = !isLoading && !isError && totalAlerts === 0;

  const refetchAll = useCallback(() => {
    reloadMargin();
    reloadVsa();
    reloadPerem();
    reloadStock();
  }, [reloadMargin, reloadVsa, reloadPerem, reloadStock]);

  const resetAll = useCallback(() => {
    setRange(null, null);
    setCategory("all");
  }, [setRange]);

  return {
    // filter state
    dateFrom,
    dateTo,
    category,
    setDateFrom,
    setDateTo,
    setPeriod,
    setCategory,
    resetAll,
    // queries + data
    margin,
    perem,
    vsa,
    // derived stock
    negatif,
    sousStock,
    surStock,
    negUnits,
    sousPpv,
    surPpv,
    // counts
    counts,
    totalAlerts,
    peremptionCritical,
    // status
    isLoading,
    isError,
    isEmpty,
    refetchAll,
    // dialog
    dialog,
    openDialog: setDialog,
    closeDialog: () => setDialog(null),
  };
}

export type UseAlertesPage = ReturnType<typeof useAlertesPage>;

/** TanStack Query wrappers for stats endpoints.
 *
 *  Thin: each hook hands off to its sibling `@/api/stats` function. The hooks
 *  layer exists so consumers can pass `{ enabled }` (e.g. the Stock page's
 *  filtered fetch only runs when at least one filter is active).
 */

/** Subset of StatsFilters used by margin-alerts (no include_non_declared). */

interface UseStockAbcdOptions {
  enabled?: boolean;
}

/**
 * Fetch the stock-abcd payload (distribution + total_references + ppv_potentiel
 * + products[]). Filters are forwarded to the backend; the query key encodes
 * either the "full" cache slot (date only) or the "filtered" slot (everything).
 */
export function useStockAbcd(filters: Partial<StockFilters>, options: UseStockAbcdOptions = {}) {
  // "Full" slot = only date in cache key. If ANY filter narrows the result,
  // route through the "filtered" slot to keep both caches independent.
  const isFiltered = Boolean(filters.class_filter || filters.status || filters.sort_by);
  const queryKey = isFiltered
    ? API.stats.stockAbcdFiltered.key(filters as StockFilters)
    : API.stats.stockAbcdFull.key(filters.date_from ?? null, filters.date_to ?? null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      api.get<StockAbcdResponse>(API.stats.stockAbcdFull.url, {
        params: filters,
      }),
    enabled: options.enabled ?? true,
  });
  return {
    abcd: data,
    isLoading,
    isError,
    reload: () => void refetch(),
  };
}

export function usePeremptions() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.stats.peremptions.key,
    queryFn: () => api.get<PeremptionsResponse>(API.stats.peremptions.url),
    staleTime: 60_000,
  });
  return {
    peremptions: data,
    isLoading,
    isError,
    reload: () => void refetch(),
  };
}

/** Products with ventes in the window but no matching achat — the root cause of
 *  "—" cells for Marge %/DH on /ventes. Same filter shape as MarginAlerts. */
function useVentesSansAchat(filters: MarginAlertsFilters) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: API.stats.ventesSansAchat.key(
      filters.date_from ?? null,
      filters.date_to ?? null,
      filters.category_type ?? "all",
    ),
    queryFn: () =>
      api.get<VentesSansAchatResponse>(API.stats.ventesSansAchat.url, {
        params: filters,
      }),
    staleTime: 60_000,
  });
  return {
    ventesSansAchat: data,
    isLoading,
    isError,
    reload: () => void refetch(),
  };
}
