/** /analyse page state: filters + mode + search + client-side pagination + Excel
 *  export + Liste CSV upload trigger. Pagination is client-side (rows are already
 *  in memory from the API response). Resets to page 1 on mode/filter/search change. */
import { useCallback, useEffect, useMemo, useState } from "react";

import type { DataTablePagination } from "@/_components/DataTable";
import { MARGE_MODE_LABELS } from "@/types";
import type {
  AnalyseFilters,
  AnalyseMargeResponse,
  AnalyseMargeRow,
  ListeItem,
  MargeMode,
  ListeRequest,
  AnalyseMargeKpis,
  MargeKpiPoint,
} from "@/types";
import { downloadXlsx, exportFilename } from "@/utils/table";
import { normalizeText, matchesText, matchesFields } from "@/utils/text";

import { EXPORT_COLS, MARGE_COLS } from "./constants";
import { useMutation } from "@tanstack/react-query";
import { useAnalyseMarge } from "@/hooks/sharedQueries";
import { api } from "@/api/client";
import { API } from "@/api/api";

const DEFAULT_FILTERS: AnalyseFilters = {
  date_from: null,
  date_to: null,
  category_type: "all",
};

// Which row field carries the "label" of each mode — used for autocomplete.
const MODE_LABEL_FIELD: Record<MargeMode, keyof AnalyseMargeRow> = {
  produit: "product",
  categorie: "category",
  laboratoire: "laboratoire",
  grossiste: "grossiste",
  operateur: "client",
  mois: "mois",
  annee: "annee",
  liste: "product",
};

export function useAnalysePage() {
  const [filters, setFilters] = useState<AnalyseFilters>(DEFAULT_FILTERS);
  const [mode, setMode] = useState<MargeMode>("produit");
  const [search, setSearch] = useState("");
  // The page is kept with the (mode, filters, search) it was picked for: any change
  // of those shows page 1 again, without a reset effect.
  const pageFor = JSON.stringify([mode, filters, search]);
  const [picked, setPicked] = useState({ pageFor, page: 1 });
  const page = picked.pageFor === pageFor ? picked.page : 1;
  const setPage = useCallback((next: number) => setPicked({ pageFor, page: next }), [pageFor]);
  const [pageSize, setPageSize] = useState(25);
  // Uploaded Liste items, kept so date/category filter changes can re-run Liste.
  const [listeItems, setListeItems] = useState<ListeItem[] | null>(null);
  // PG-014: client-side sort — rows are fully in memory, so sorting covers the
  // ENTIRE filtered set (not just the visible page), as the QA rule requires.
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Auto-fetch query for 7 group-by modes; Liste uses the mutation below.
  // In année mode the search box filters ventes by PRODUCT server-side (so each
  // month reflects that product's quantities); other modes filter rows client-side.
  const margeFilters = mode === "annee" ? { ...filters, product: search.trim() || null } : filters;
  const { analyse, isLoading: margeLoading, error: margeError } = useAnalyseMarge(margeFilters, mode);
  const { runListe, liste, isListeLoading, listeError } = useAnalyseListe();

  // When mode === liste, the active result lives on the mutation; otherwise on the query.
  const activeData = mode === "liste" ? liste : analyse;
  const isLoading = mode === "liste" ? isListeLoading : margeLoading;

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
  // Année: the server already filtered by product → its KPIs are the right ones
  // (year rows carry no stock / marge fields to recompute from).
  const kpis = useMemo(() => {
    if (!activeData?.kpis) return undefined;
    if (!search.trim() || mode === "annee") return activeData.kpis;
    return computeKpisFromRows(filteredRows);
  }, [activeData, filteredRows, search, mode]);

  // Autocomplete — suggest the current mode's labels (products, laboratoires, …)
  // from the FULL loaded row set (not the filtered one), accent/case-insensitive,
  // all distinct matches. All rows are already in memory → no API round-trip.
  const suggestions = useMemo(() => {
    const q = normalizeText(search.trim());
    if (q.length < 2 || !activeData?.rows?.length) return null;
    const field = MODE_LABEL_FIELD[mode];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of activeData.rows) {
      const label = String(r[field] ?? "").trim();
      if (!label || seen.has(label) || !matchesText(label, search)) continue;
      seen.add(label);
      out.push(label);
    }
    return { [MARGE_MODE_LABELS[mode]]: out };
  }, [activeData, mode, search]);

  // Liste is a mutation (no auto-refetch like the query modes). Re-run it when the
  // date / category (Mixte / Pharmacie / Parapharmacie) filters change so the rows
  // AND the KPI cards follow the selected window. (Text search stays client-side.)
  useEffect(() => {
    if (mode === "liste" && listeItems) {
      runListe({ items: listeItems, ...filters });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, filters.date_from, filters.date_to, filters.category_type]);

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
      if (aEmpty) return 1; // empties last, regardless of direction
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
    onPage: setPage,
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
      }),
    );
    downloadXlsx(
      [header, ...dataRows],
      exportFilename(`ANALYSE ${mode.toUpperCase()}`, "xlsx", filters.date_from, filters.date_to),
      "Analyse",
    );
  }

  function submitListe(items: ListeItem[]) {
    setListeItems(items);
    runListe({ items, ...filters });
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
    filters,
    setFilters,
    mode,
    setMode: changeMode,
    search,
    setSearch,
    suggestions,
    sortBy,
    sortOrder,
    toggleSort,
    isLoading,
    error: margeError ?? listeError,
    kpis,
    rows: pageRows,
    pagination,
    totalRows: activeData?.rows.length ?? 0,
    handleExport,
    submitListe,
    listeSubmitted: !!liste,
    clearAll,
  };
}

/** TanStack Query wrappers for /v1/stats/analyse-marge + /v1/stats/analyse-liste.
 *
 *  Pattern matches the other stats hooks (useStats, useMarginAlerts, useStockAbcd).
 *  - useAnalyseMarge (hooks/sharedQueries.ts, shared with Rapport): GET per (mode, filters).
 *  - useAnalyseListe: POST with CSV-parsed items. Mutation-shape since upload is user-triggered.
 */

export function useAnalyseListe() {
  const { mutate, data, isPending, isError, error } = useMutation({
    mutationFn: (body: ListeRequest) => api.post<AnalyseMargeResponse>(API.stats.analyseListe.url, body),
  });
  return {
    runListe: mutate,
    liste: data,
    isListeLoading: isPending,
    listeError: isError ? error : null,
  };
}

/** Client-side mirror of the backend `_compute_kpis` (backend/app/analytics/analyse_queries.py).
 *
 *  Purpose: the /analyses KPI cards must ADAPT to the client-side text search.
 *  Date/category filters already flow through the API (backend recomputes), but
 *  the text search only filters rows in the browser — so when a search is
 *  active we recompute the whole KPI block from the filtered rows with the
 *  exact same algorithm the backend uses:
 *
 *   - rows carrying `marge_pct`     (produit, liste)                → branch A
 *   - rows carrying `marge_pct_avg` (categorie/grossiste/laboratoire) → branch B
 *   - neither (operateur/mois/annee)                                → marge KPIs null
 *
 *  One deliberate difference: backend `total_ventes_dh` comes from SQL for
 *  Dashboard parity; client-side we can only sum the visible rows' `ca` —
 *  which is exactly what "adapted to the search" means here.
 */

const round2 = (x: number) => Math.round(x * 100) / 100;
const round3 = (x: number) => Math.round(x * 1000) / 1000;
/** Numeric coercion for optional row fields (None/undefined → 0). */
const n = (v: number | null | undefined) => Number(v ?? 0);
/** Python `a or b` semantics: falls back when a is null/undefined OR 0. */
const orFb = (a: number | null | undefined, b: number | null | undefined) => n(a) || n(b);

const maxBy = <T>(arr: T[], f: (t: T) => number): T => arr.reduce((a, b) => (f(b) > f(a) ? b : a));
const minBy = <T>(arr: T[], f: (t: T) => number): T => arr.reduce((a, b) => (f(b) < f(a) ? b : a));

export function computeKpisFromRows(rows: AnalyseMargeRow[]): AnalyseMargeKpis {
  const totalCa = rows.reduce((s, r) => s + n(r.ca), 0);
  const totalUnites = rows.reduce((s, r) => s + n(r.qty), 0);
  const unitsAvail = rows.reduce((s, r) => s + n(r.stock_dispo), 0);
  const puPurchased = rows.reduce((s, r) => s + n(r.total_achat_cost), 0);
  const ppvAvail = rows.reduce((s, r) => s + n(r.ppv_potentiel), 0);

  const kpis: AnalyseMargeKpis = {
    total_ventes_dh: round2(totalCa),
    total_ventes_unites: round2(totalUnites),
    // Backend: `round(x, 2) if x else None` — zero sums render as "—".
    total_units_available: unitsAvail ? round2(unitsAvail) : null,
    total_pu_purchased: puPurchased ? round2(puPurchased) : null,
    ppv_total_available: ppvAvail ? round2(ppvAvail) : null,
    marge_pct_avg: null,
    marge_pct_min: null,
    marge_pct_max: null,
    marge_dh_avg: null,
    marge_dh_min: null,
    marge_dh_max: null,
    difference_gain_dh: null,
  };

  const margeRows = rows.filter((r) => r.marge_pct != null);
  const margeAvgRows = rows.filter((r) => r.marge_pct_avg != null);

  if (margeRows.length) {
    // Branch A — produit/liste rows. Marge moyenne (%) is the Dashboard
    // "marge mixte": (1 − Σqty·PU / Σqty·PPV) × 100.
    const totalQty = margeRows.reduce((s, r) => s + n(r.qty), 0);
    if (totalQty) {
      const sumQtyPpv = margeRows.reduce((s, r) => s + n(r.qty) * n(r.ppv), 0);
      const sumQtyPu = margeRows.reduce((s, r) => s + n(r.qty) * n(r.pu), 0);
      kpis.marge_pct_avg = sumQtyPpv ? round3((1 - sumQtyPu / sumQtyPpv) * 100) : null;
      kpis.marge_dh_avg = round2(margeRows.reduce((s, r) => s + n(r.qty) * n(r.marge_dh), 0) / totalQty);
    }
    const bestPctVal = (r: AnalyseMargeRow) => orFb(r.marge_pct_best, r.marge_pct);
    const worstPctVal = (r: AnalyseMargeRow) => orFb(r.marge_pct_worst, r.marge_pct);
    const bestDhVal = (r: AnalyseMargeRow) => orFb(r.marge_dh_best, r.marge_dh);
    const worstDhVal = (r: AnalyseMargeRow) => orFb(r.marge_dh_worst, r.marge_dh);
    const bp = maxBy(margeRows, bestPctVal);
    const wp = minBy(margeRows, worstPctVal);
    const bd = maxBy(margeRows, bestDhVal);
    const wd = minBy(margeRows, worstDhVal);
    const pt = (r: AnalyseMargeRow, value: number): MargeKpiPoint => ({
      label: r.product ?? "",
      value,
      qty: n(r.qty),
    });
    kpis.marge_pct_max = pt(bp, bestPctVal(bp));
    kpis.marge_pct_min = pt(wp, worstPctVal(wp));
    kpis.marge_dh_max = pt(bd, bestDhVal(bd));
    kpis.marge_dh_min = pt(wd, worstDhVal(wd));
    // NB: backend multiplies by the PLAIN marge_dh here, not the best/worst variant.
    kpis.difference_gain_dh = round2(n(bd.qty) * n(bd.marge_dh) - n(wd.qty) * n(wd.marge_dh));
  } else if (margeAvgRows.length) {
    // Branch B — categorie/grossiste/laboratoire rows (pre-averaged per group).
    const sample = margeAvgRows[0] as Record<string, unknown>;
    const labelKey =
      sample.category !== undefined
        ? "category"
        : sample.grossiste !== undefined
          ? "grossiste"
          : sample.laboratoire !== undefined
            ? "laboratoire"
            : "category";
    const labelOf = (r: AnalyseMargeRow) => String((r as unknown as Record<string, unknown>)[labelKey] ?? "");
    const totalQty = margeAvgRows.reduce((s, r) => s + n(r.qty), 0);
    if (totalQty) {
      kpis.marge_pct_avg = round3(margeAvgRows.reduce((s, r) => s + n(r.qty) * n(r.marge_pct_avg), 0) / totalQty);
      kpis.marge_dh_avg = round2(margeAvgRows.reduce((s, r) => s + n(r.qty) * n(r.marge_dh_avg), 0) / totalQty);
    }
    const bp = maxBy(margeAvgRows, (r) => n(r.marge_pct_avg));
    const wp = minBy(margeAvgRows, (r) => n(r.marge_pct_avg));
    const bd = maxBy(margeAvgRows, (r) => n(r.marge_dh_avg));
    const wd = minBy(margeAvgRows, (r) => n(r.marge_dh_avg));
    kpis.marge_pct_max = {
      label: labelOf(bp),
      value: n(bp.marge_pct_avg),
      qty: n(bp.qty),
    };
    kpis.marge_pct_min = {
      label: labelOf(wp),
      value: n(wp.marge_pct_avg),
      qty: n(wp.qty),
    };
    kpis.marge_dh_max = {
      label: labelOf(bd),
      value: n(bd.marge_dh_avg),
      qty: n(bd.qty),
    };
    kpis.marge_dh_min = {
      label: labelOf(wd),
      value: n(wd.marge_dh_avg),
      qty: n(wd.qty),
    };
    kpis.difference_gain_dh = round2(n(bd.qty) * n(bd.marge_dh_avg) - n(wd.qty) * n(wd.marge_dh_avg));
  }

  return kpis;
}
