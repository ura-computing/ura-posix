// src/pages/alertes/_hooks/useAlertesPage.ts
import { useCallback, useMemo, useState } from "react";
// Already shipped at @/hooks/stats:
import { useMarginAlerts, usePeremptions, useStockAbcd, useVentesSansAchat } from "@/hooks/stats";
import { useGlobalDateRange } from "@/hooks/useGlobalDateRange";
import type { AlertColumn } from "../_components/AlertDetailDialog";

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
  const dateTo   = globalTo   ?? "";
  const setDateFrom = (v: string) => setRange(v || null, globalTo);
  const setDateTo   = (v: string) => setRange(globalFrom, v || null);
  const [category, setCategory] = useState<CategoryType>("all");
  const [dialog, setDialog] = useState<DialogDescriptor | null>(null);

  const marginQuery = useMarginAlerts({
    date_from:     dateFrom || null,
    date_to:       dateTo   || null,
    category_type: category || "all",
  });
  const vsaQuery = useVentesSansAchat({
    date_from:     dateFrom || null,
    date_to:       dateTo   || null,
    category_type: category || "all",
  });
  const peremptionsQuery = usePeremptions(); // ignores date + category (backend)
  const stockQuery = useStockAbcd({
    date_from: dateFrom || null,
    date_to:   dateTo   || null,
  }); // ignores category

  // ---- stock alerts derived CLIENT-SIDE from stockAbcd.products ----
  const products = stockQuery.data?.products ?? [];
  const negatif = useMemo(() => products.filter((p) => p.status === "negatif"), [products]);
  const sousStock = useMemo(() => products.filter((p) => p.status === "sous-stock"), [products]);
  const surStock = useMemo(() => products.filter((p) => p.status === "sur-stock"), [products]);

  // ---- stock metrics (exact apcm-pharma formulas) ----
  const negUnits = useMemo(
    () => negatif.reduce((s, p) => s + (p.current_stock != null && p.current_stock < 0 ? Math.abs(p.current_stock) : 0), 0),
    [negatif],
  );
  const sousPpv = useMemo(
    () => sousStock.reduce((s, p) => (p.ppv != null ? s + p.ppv * Math.max(0, p.stock_min - (p.current_stock ?? 0)) : s), 0),
    [sousStock],
  );
  const surPpv = useMemo(
    () => surStock.reduce((s, p) => (p.ppv != null ? s + p.ppv * Math.max(0, (p.current_stock ?? 0) - p.stock_max) : s), 0),
    [surStock],
  );

  const margin = marginQuery.data;
  const perem = peremptionsQuery.data;
  const vsa = vsaQuery.data;

  const counts = {
    marginNeg:      margin?.negative.count ?? 0,
    marginLow:      margin?.low.count ?? 0,
    ventesSansAchat: vsa?.count ?? 0,
    expired:   perem?.expired.count ?? 0,
    veryClose: perem?.very_close.count ?? 0,
    close:     perem?.close.count ?? 0,
    negatif:   negatif.length,
    sousStock: sousStock.length,
    surStock:  surStock.length,
  };
  // Total actionable alerts across all brackets.
  const totalAlerts = Object.values(counts).reduce((a, b) => a + b, 0);
  // Expired + very-close = the "act today" subset.
  const peremptionCritical = counts.expired + counts.veryClose;

  const isLoading = marginQuery.isLoading || peremptionsQuery.isLoading || stockQuery.isLoading || vsaQuery.isLoading;
  const isError = marginQuery.isError || peremptionsQuery.isError || stockQuery.isError || vsaQuery.isError;
  const isEmpty = !isLoading && !isError && totalAlerts === 0;

  const refetchAll = useCallback(() => {
    marginQuery.refetch();
    vsaQuery.refetch();
    peremptionsQuery.refetch();
    stockQuery.refetch();
  }, [marginQuery, vsaQuery, peremptionsQuery, stockQuery]);

  const resetAll = useCallback(() => {
    setRange(null, null);
    setCategory("all");
  }, [setRange]);

  return {
    // filter state
    dateFrom, dateTo, category,
    setDateFrom, setDateTo, setCategory, resetAll,
    // queries + data
    marginQuery, vsaQuery, peremptionsQuery, stockQuery, margin, perem, vsa,
    // derived stock
    negatif, sousStock, surStock, negUnits, sousPpv, surPpv,
    // counts
    counts, totalAlerts, peremptionCritical,
    // status
    isLoading, isError, isEmpty, refetchAll,
    // dialog
    dialog, openDialog: setDialog, closeDialog: () => setDialog(null),
  };
}

export type UseAlertesPage = ReturnType<typeof useAlertesPage>;
