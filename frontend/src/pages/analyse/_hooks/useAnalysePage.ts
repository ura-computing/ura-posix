/** /analyse page state: filters + mode + search + client-side pagination + Excel
 *  export + Liste CSV upload trigger. Pagination is client-side (rows are already
 *  in memory from the API response). Resets to page 1 on mode/filter/search change. */
import { useEffect, useMemo, useState } from "react";

import type { DataTablePagination } from "@/components/shared/DataTable";
import { useAnalyseListe, useAnalyseMarge } from "@/hooks/analyse";
import { MARGE_MODE_LABELS } from "@/types";
import type { AnalyseFilters, AnalyseMargeRow, ListeItem, MargeMode } from "@/types";
import { downloadXlsx, exportFilename } from "@/utils/table";
import { normalizeText, matchesText, matchesFields } from "@/utils/text";

import { EXPORT_COLS, MARGE_COLS } from "../_constants";
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
  // PG-014: client-side sort — rows are fully in memory, so sorting covers the
  // ENTIRE filtered set (not just the visible page), as the QA rule requires.
  const [sortBy,    setSortBy]    = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Auto-fetch query for 7 group-by modes; Liste uses the mutation below.
  // In année mode the search box filters ventes by PRODUCT server-side (so each
  // month reflects that product's quantities); other modes filter rows client-side.
  const margeFilters = mode === "annee" ? { ...filters, product: search.trim() || null } : filters;
  const margeQ = useAnalyseMarge(margeFilters, mode);
  const listeM = useAnalyseListe();

  // When mode === liste, the active result lives on the mutation; otherwise on the query.
  const activeData = mode === "liste" ? listeM.data : margeQ.data;
  const isLoading  = mode === "liste" ? listeM.isPending : margeQ.isLoading;

  // Client-side search filter — accent/case-insensitive, `*` wildcard aware
  // (prefix `rino*`, suffix `*enil`, infix `ri*il`), each token may match any field.
  const filteredRows = useMemo(() => {
    if (!activeData?.rows) return [];
    // Année mode already filtered server-side by product — don't also filter the
    // year rows client-side (a product name never matches a year label).
    if (mode === "annee") return activeData.rows;
    if (!search.trim()) return activeData.rows;
    return activeData.rows.filter((r) =>
      matchesFields([r.product, r.category, r.laboratoire, r.grossiste, r.client, r.mois, r.annee], search),
    );
  }, [activeData, search, mode]);

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
      if (!label || seen.has(label) || !matchesText(label, search)) continue;
      seen.add(label);
      out.push(label);
      if (out.length >= 8) break;
    }
    return { [MARGE_MODE_LABELS[mode]]: out };
  }, [activeData, mode, search]);

  // Reset to page 1 whenever the active dataset or filters change.
  useEffect(() => { setPage(1); }, [mode, filters, search]);

  // Sort the FULL filtered set using the column's `raw` accessor (same values
  // the Excel export uses). Nulls sort last in both directions; strings use
  // French collation.
  const sortedRows = useMemo(() => {
    if (!sortBy) return filteredRows;
    const col = MARGE_COLS[mode].find((c) => c.key === sortBy);
    if (!col?.raw) return filteredRows;
    const dir = sortOrder === "asc" ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      const va = col.raw!(a);
      const vb = col.raw!(b);
      const aEmpty = va == null || va === "";
      const bEmpty = vb == null || vb === "";
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1;   // empties last, regardless of direction
      if (bEmpty) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "fr") * dir;
    });
  }, [filteredRows, sortBy, sortOrder, mode]);

  // Slice the sorted rows for the current page.
  const pageRows = useMemo(
    () => sortedRows.slice((page - 1) * pageSize, page * pageSize),
    [sortedRows, page, pageSize],
  );

  const pagination: DataTablePagination = {
    page,
    pageSize,
    total: sortedRows.length,
    onPage:     setPage,
    onPageSize: setPageSize,
  };

  // Same-column click toggles direction; new column starts desc (largest first,
  // matching Achats/Ventes behavior).
  function toggleSort(key: string) {
    setPage(1);
    if (sortBy === key) {
      setSortOrder((o) => (o === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(key);
      setSortOrder("desc");
    }
  }

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
  // page misleadingly shows "Aucun résultat". The sort resets too (columns
  // differ per mode). Dates/category filters stay (valid for every mode).
  function changeMode(m: MargeMode) {
    setMode(m);
    setSearch("");
    setSortBy(null);
    setSortOrder("desc");
  }

  return {
    filters, setFilters,
    mode,    setMode: changeMode,
    search,  setSearch,
    suggestions,
    sortBy, sortOrder, toggleSort,
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
