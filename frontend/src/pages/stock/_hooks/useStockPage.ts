// src/pages/stock/_hooks/useStockPage.ts
import { useCallback, useMemo, useState } from "react";
// Both hooks are thin TanStack Query wrappers you already ship:
//   useStockAbcd(filters[, options]) -> listStockAbcd(filters)
//   usePeremptions()                 -> listPeremptions()
import { useStockAbcd, usePeremptions } from "@/hooks/stats";
import { useGlobalDateRange } from "@/hooks/useGlobalDateRange";
import { monthsAgo, todayIso } from "@/utils/dateRange";
import type { DialogDescriptor } from "@/pages/alertes/_hooks/useAlertesPage";
import { downloadXlsx, exportFilename } from "@/utils/table";
import type { AbcdClass, StockRow } from "@/types";

export type StockSortKey =
  | "product"
  | "category"
  | "units_sold_12m"
  | "stock_min"
  | "stock_max"
  | "current_stock"
  | "status";

/**
 * Orchestrates the Stock page: DUAL fetch (full = distribution/gauge/alerts,
 * filtered = table only) + filter / sort / pagination state + Excel export.
 */
export function useStockPage() {
  // ---- filter + view state ----
  // Date range comes from the cross-route global context. Other filters
  // (class, status, search, sort, pagination) stay page-local.
  const { from: globalFrom, to: globalTo, setRange } = useGlobalDateRange();
  // Stock-only default: trailing 12 months → today. Computed LOCALLY so it's the
  // effective range for this page's queries + picker WITHOUT writing to the
  // shared cross-route context — other routes stay unaffected. Any explicit
  // range (picked here or on another tab) lands in the global context and
  // overrides this default; `isDateDefault` tells the UI when no range is set.
  const defaultFrom = useMemo(() => monthsAgo(12), []);
  const defaultTo   = useMemo(() => todayIso(), []);
  const isDateDefault = globalFrom === null && globalTo === null;
  const dateFrom = globalFrom ?? defaultFrom;
  const dateTo   = globalTo   ?? defaultTo;
  const setDateFrom = (v: string) => setRange(v || null, globalTo);
  const setDateTo   = (v: string) => setRange(globalFrom, v || null);
  // Default class = "A" so pharmacists land on their best-sellers immediately.
  // "Tout réinitialiser" / "Fermer" still clear to null — the default only applies on first mount.
  const [classFilter, setClassFilter] = useState<AbcdClass | null>("A");
  const [status, setStatus] = useState<string>(""); // "" = Tous statuts
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<StockSortKey>("units_sold_12m");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  // Peremption-card → product-list dialog. Same DialogDescriptor type as
  // /alertes uses so the shared <AlertDetailDialog/> wires up identically.
  const [dialog, setDialog] = useState<DialogDescriptor | null>(null);

  /** Table renders only when at least one of these is active. */
  const hasTableFilter =
    classFilter !== null || status !== "" || search.trim() !== "";

  // ---- 1) FULL fetch: drives circles + gauge + alert cards (NO class/status/search) ----
  const fullQuery = useStockAbcd({
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });

  // ---- 2) FILTERED fetch: drives ONLY the conditional table ----
  const filteredQuery = useStockAbcd(
    {
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      class_filter: classFilter ?? undefined,
      status: status || undefined,
      search: search || undefined,
      sort_by: sortBy,
      sort_order: sortOrder,
    },
    { enabled: hasTableFilter },
  );

  const peremptionsQuery = usePeremptions();

  const fullProducts: StockRow[] = fullQuery.data?.products ?? [];

  // ---- health gauge score: ideal / non-inconnu * 10 ----
  const healthScore = useMemo(() => {
    const withStatus = fullProducts.filter((p) => p.status !== "inconnu").length;
    if (withStatus === 0) return 0;
    const healthy = fullProducts.filter((p) => p.status === "ideal").length;
    return (healthy / withStatus) * 10;
  }, [fullProducts]);

  // ---- sort handler: same column toggles asc/desc, new column -> asc ----
  const toggleSort = useCallback((key: StockSortKey) => {
    setPage(1);
    setSortBy((prevKey) => {
      setSortOrder((prevOrder) =>
        prevKey === key && prevOrder === "asc" ? "desc" : "asc",
      );
      return key;
    });
  }, []);

  const selectClass = useCallback((c: AbcdClass) => {
    setPage(1);
    setClassFilter((prev) => (prev === c ? null : c)); // click same circle clears
  }, []);

  const clearAll = useCallback(() => {
    setRange(null, null);
    setClassFilter(null);
    setStatus("");
    setSearch("");
    setPage(1);
  }, []);

  const closeTable = useCallback(() => {
    setClassFilter(null);
    setStatus("");
    setSearch("");
    setPage(1);
  }, []);

  // ---- Excel export: the CURRENT filtered-by-status table (9 columns).
  // When a table filter (status / class / search) is active, the filtered fetch
  // has the server-side filtered rows → export exactly what the user sees.
  // With no table filter, `filteredQuery` is disabled, so fall back to the
  // date-only full set (identical rows in that case).
  const handleExport = useCallback(() => {
    const header = [
      "Produit",
      "Classe",
      "Ventes 12m",
      "Stock actuel",
      "Stock min",
      "Stock max",
      "PPV",
      "PU moyen",
      "Statut",
    ];
    const rowsToExport = hasTableFilter
      ? (filteredQuery.data?.products ?? [])
      : fullProducts;
    const body = rowsToExport.map((r) => [
      r.product,
      r.category,
      r.units_sold_12m,
      r.current_stock ?? 0,
      r.stock_min,
      r.stock_max,
      r.ppv ?? 0,
      r.avg_pu ?? 0,
      r.status,
    ]);
    downloadXlsx(
      [header, ...body],
      exportFilename("STOCK", "xlsx", dateFrom, dateTo),
    );
  }, [fullProducts, filteredQuery.data, hasTableFilter, dateFrom, dateTo]);

  return {
    // queries
    fullQuery,
    filteredQuery,
    peremptionsQuery,
    // derived
    fullProducts,
    healthScore,
    hasTableFilter,
    isExportLoading: hasTableFilter && filteredQuery.isLoading,
    isEmpty: (fullQuery.data?.total_references ?? 0) === 0,
    // filter state + setters
    dateFrom,
    dateTo,
    isDateDefault,
    classFilter,
    status,
    search,
    setDateFrom,
    setDateTo,
    setStatus,
    setSearch,
    selectClass,
    // table state
    sortBy,
    sortOrder,
    toggleSort,
    page,
    setPage,
    pageSize,
    setPageSize,
    // actions
    clearAll,
    closeTable,
    handleExport,
    // peremption dialog
    dialog,
    openDialog:  setDialog,
    closeDialog: () => setDialog(null),
  };
}

export type UseStockPage = ReturnType<typeof useStockPage>;