/** /analyse page state: filters + mode + search + client-side pagination + Excel
 *  export + Liste CSV upload trigger. Pagination is client-side (rows are already
 *  in memory from the API response). Resets to page 1 on mode/filter/search change. */
import { useEffect, useMemo, useState } from "react";

import type { DataTablePagination } from "@/components/shared/DataTable";
import { useAnalyseListe, useAnalyseMarge } from "@/hooks/analyse";
import { MARGE_MODE_LABELS } from "@/types";
import type { AnalyseFilters, AnalyseMargeRow, ListeItem, MargeMode } from "@/types";
import { downloadXlsx, exportFilename } from "@/utils/table";
import { normalizeText } from "@/utils/text";

import { EXPORT_COLS } from "../_constants";
import { computeKpisFromRows } from "../_utils/kpis";


const DEFAULT_FILTERS: AnalyseFilters = {
  date_from:     null,
  date_to:       null,
  category_type: "all",
};

// Which row field carries the "label" of each mode — used for autocomplete.
const MODE_LABEL_FIELD: Record<MargeMode, keyof AnalyseMargeRow> = {
  produit:     "product",
  categorie:   "category",
  laboratoire: "laboratoire",
  grossiste:   "grossiste",
  operateur:   "client",
  mois:        "mois",
  annee:       "annee",
  liste:       "product",
};


export function useAnalysePage() {
  const [filters,  setFilters]  = useState<AnalyseFilters>(DEFAULT_FILTERS);
  const [mode,     setMode]     = useState<MargeMode>("produit");
  const [search,   setSearch]   = useState("");
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Auto-fetch query for 7 group-by modes; Liste uses the mutation below.
  const margeQ = useAnalyseMarge(filters, mode);
  const listeM = useAnalyseListe();

  // When mode === liste, the active result lives on the mutation; otherwise on the query.
  const activeData = mode === "liste" ? listeM.data : margeQ.data;
  const isLoading  = mode === "liste" ? listeM.isPending : margeQ.isLoading;

  // Client-side search filter — accent- AND case-insensitive (partial match).
  const filteredRows = useMemo(() => {
    if (!activeData?.rows) return [];
    if (!search.trim()) return activeData.rows;
    const q = normalizeText(search.trim());
    return activeData.rows.filter((r) =>
      normalizeText(r.product).includes(q) ||
      normalizeText(r.category).includes(q) ||
      normalizeText(r.laboratoire).includes(q) ||
      normalizeText(r.grossiste).includes(q) ||
      normalizeText(r.client).includes(q) ||
      normalizeText(r.mois).includes(q) ||
      normalizeText(r.annee).includes(q),
    );
  }, [activeData, search]);

  // KPI cards adapt to the client-side text search: with a search active, the
  // whole KPI block is recomputed from the FILTERED rows (exact TS mirror of
  // backend _compute_kpis — branches per mode on the fields rows carry). With
  // no search, the backend KPIs pass through untouched (incl. the
  // Dashboard-aligned CA). Works for liste too: not_found rows carry qty/ca 0
  // and null metrics, so they contribute nothing.
  const kpis = useMemo(() => {
    if (!activeData?.kpis) return undefined;
    if (!search.trim()) return activeData.kpis;
    return computeKpisFromRows(filteredRows);
  }, [activeData, filteredRows, search]);

  // Autocomplete — suggest the current mode's labels (products, laboratoires, …)
  // from the FULL loaded row set (not the filtered one), accent/case-insensitive,
  // top 8 distinct matches. All rows are already in memory → no API round-trip.
  const suggestions = useMemo(() => {
    const q = normalizeText(search.trim());
    if (q.length < 2 || !activeData?.rows?.length) return null;
    const field = MODE_LABEL_FIELD[mode];
    const seen = new Set<string>();
    const out:  string[] = [];
    for (const r of activeData.rows) {
      const label = String(r[field] ?? "").trim();
      if (!label || seen.has(label) || !normalizeText(label).includes(q)) continue;
      seen.add(label);
      out.push(label);
      if (out.length >= 8) break;
    }
    return { [MARGE_MODE_LABELS[mode]]: out };
  }, [activeData, mode, search]);

  // Reset to page 1 whenever the active dataset or filters change.
  useEffect(() => { setPage(1); }, [mode, filters, search]);

  // Slice the filtered rows for the current page.
  const pageRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page, pageSize],
  );

  const pagination: DataTablePagination = {
    page,
    pageSize,
    total: filteredRows.length,
    onPage:     setPage,
    onPageSize: setPageSize,
  };

  // Excel export — OLD-APP PARITY (client request): headers/order from
  // EXPORT_COLS, filename "APCM - ANALYSE {MODE} {from} - {to}.xlsx" and sheet
  // name "Analyse" exactly as apcm-pharma generated them. Exports the full
  // search-filtered set (not just the visible page).
  function handleExport() {
    if (!filteredRows.length) return;
    const cols = EXPORT_COLS[mode];
    const header = cols.map((c) => c.label);
    const dataRows: (string | number)[][] = filteredRows.map((row) =>
      cols.map((c) => {
        const v = c.raw(row);
        return v == null ? "" : v;
      })
    );
    downloadXlsx(
      [header, ...dataRows],
      exportFilename(`ANALYSE ${mode.toUpperCase()}`, "xlsx", filters.date_from, filters.date_to),
      "Analyse",
    );
  }

  function submitListe(items: ListeItem[]) {
    listeM.mutate({ items, ...filters });
  }

  function clearAll() {
    setFilters(DEFAULT_FILTERS);
    setSearch("");
  }

  // Switching mode tabs clears the text search: it filters the CURRENT mode's
  // rows, so a product name carried into e.g. Catégorie matches nothing and the
  // page misleadingly shows "Aucun résultat". Dates/category filters stay (valid
  // for every mode).
  function changeMode(m: MargeMode) {
    setMode(m);
    setSearch("");
  }

  return {
    filters, setFilters,
    mode,    setMode: changeMode,
    search,  setSearch,
    suggestions,
    isLoading,
    error:    margeQ.isError ? margeQ.error : (listeM.isError ? listeM.error : null),
    kpis,
    rows:     pageRows,
    pagination,
    totalRows: activeData?.rows.length ?? 0,
    handleExport,
    submitListe,
    listeSubmitted: !!listeM.data,
    clearAll,
  };
}
