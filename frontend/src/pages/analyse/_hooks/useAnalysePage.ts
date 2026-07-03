/** /analyse page state: filters + mode + search + client-side pagination + Excel
 *  export + Liste CSV upload trigger. Pagination is client-side (rows are already
 *  in memory from the API response). Resets to page 1 on mode/filter/search change. */
import { useEffect, useMemo, useState } from "react";

import type { DataTablePagination } from "@/components/shared/DataTable";
import { useAnalyseListe, useAnalyseMarge } from "@/hooks/analyse";
import type { AnalyseFilters, ListeItem, MargeMode } from "@/types";
import { downloadXlsx, exportFilename } from "@/utils/table";

import { MARGE_COLS } from "../_constants";


const DEFAULT_FILTERS: AnalyseFilters = {
  date_from:     null,
  date_to:       null,
  category_type: "all",
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

  // Client-side search filter (case-insensitive on the row's primary label).
  const filteredRows = useMemo(() => {
    if (!activeData?.rows) return [];
    if (!search.trim()) return activeData.rows;
    const norm = (s: unknown) => String(s ?? "").toLowerCase();
    const q = norm(search.trim());
    return activeData.rows.filter((r) =>
      norm(r.product).includes(q) ||
      norm(r.category).includes(q) ||
      norm(r.laboratoire).includes(q) ||
      norm(r.grossiste).includes(q) ||
      norm(r.client).includes(q) ||
      norm(r.mois).includes(q) ||
      norm(r.annee).includes(q),
    );
  }, [activeData, search]);

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

  function handleExport() {
    if (!filteredRows.length) return;
    const cols = MARGE_COLS[mode];
    const header = cols.map((c) => c.label);
    const dataRows: (string | number)[][] = filteredRows.map((row) =>
      cols.map((c) => {
        const v = c.raw ? c.raw(row) : "";
        return v == null ? "" : v;
      })
    );
    downloadXlsx(
      [header, ...dataRows],
      exportFilename(`analyse-${mode}`, "xlsx", filters.date_from, filters.date_to),
      `Analyse-${mode}`,
    );
  }

  function submitListe(items: ListeItem[]) {
    listeM.mutate({ items, ...filters });
  }

  function clearAll() {
    setFilters(DEFAULT_FILTERS);
    setSearch("");
  }

  return {
    filters, setFilters,
    mode,    setMode,
    search,  setSearch,
    isLoading,
    error:    margeQ.isError ? margeQ.error : (listeM.isError ? listeM.error : null),
    kpis:     activeData?.kpis,
    rows:     pageRows,
    pagination,
    totalRows: activeData?.rows.length ?? 0,
    handleExport,
    submitListe,
    listeSubmitted: !!listeM.data,
    clearAll,
  };
}
