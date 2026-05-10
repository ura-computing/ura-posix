import { useState, useMemo, useCallback } from "react";
import { useAnalyseMarge } from "@/hooks/usePharmacyRapports";
import { eCategoryType } from "@/types";
import { MARGE_COLS, type MargeMode } from "@/pages/rapports/margeTable";
import { downloadBlob } from "@/pages/rapports/shared";
import { exportFilename } from "@/utils/table";
import { currentMonth } from "@/utils/dateRange";
import { tokenizeSearch } from "@/utils/search";

export function useAnalysePage() {
  const _initial = currentMonth();
  const [dateFrom, setDateFrom] = useState(_initial.from);
  const [dateTo, setDateTo] = useState(_initial.to);
  const [categoryType, setCategoryType] = useState<eCategoryType>(eCategoryType.ALL);
  const [margeMode, setMargeMode] = useState<MargeMode>("produit");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { margeData, margeLoading } = useAnalyseMarge(dateFrom, dateTo, categoryType, margeMode);

  const allRows = useMemo(
    () => (margeData?.rows ?? []) as Record<string, unknown>[],
    [margeData],
  );

  const filteredRows = useMemo(() => {
    const tokens = tokenizeSearch(search);
    if (tokens.length === 0) return allRows.map((r, i) => ({ row: r, idx: i }));
    return allRows
      .map((r, i) => ({ row: r, idx: i }))
      .filter(({ row }) => {
        const haystack = Object.values(row)
          .filter((v) => typeof v === "string")
          .join("  ")
          .toLowerCase();
        return tokens.every((t) => haystack.includes(t));
      });
  }, [allRows, search]);

  const kpis = useMemo(() => {
    // Priority: checked rows > search-filtered rows > all rows (global KPIs from backend)
    const hasChecked = selected.size > 0;
    const hasSearch = search.trim().length > 0;
    const sel = hasChecked
      ? allRows.filter((_, i) => selected.has(i))
      : hasSearch
        ? filteredRows.map((f) => f.row)
        : [];
    const ca = sel.reduce((s, r) => s + (Number(r.ca ?? r.total) || 0), 0);
    const qty = sel.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    const pcts = sel.map((r) => ({ v: Number(r.marge_pct ?? r.marge_pct_avg ?? NaN), label: String(r.product ?? r.category ?? ""), qty: Number(r.qty ?? 0) })).filter((x) => !isNaN(x.v));
    const dhs = sel.map((r) => ({ v: Number(r.marge_dh ?? r.marge_dh_avg ?? NaN), label: String(r.product ?? r.category ?? ""), qty: Number(r.qty ?? 0) })).filter((x) => !isNaN(x.v));
    const margePctAvg = pcts.length ? pcts.reduce((s, x) => s + x.v, 0) / pcts.length : null;
    const margeDhAvg = dhs.length ? dhs.reduce((s, x) => s + x.v, 0) / dhs.length : null;
    // Use best/worst margins (from min/max purchase prices per product)
    const pctsWorst = sel.map((r) => ({ v: Number(r.marge_pct_worst ?? r.marge_pct ?? NaN), label: String(r.product ?? r.category ?? ""), qty: Number(r.qty ?? 0) })).filter((x) => !isNaN(x.v));
    const pctsBest = sel.map((r) => ({ v: Number(r.marge_pct_best ?? r.marge_pct ?? NaN), label: String(r.product ?? r.category ?? ""), qty: Number(r.qty ?? 0) })).filter((x) => !isNaN(x.v));
    const dhsWorst = sel.map((r) => ({ v: Number(r.marge_dh_worst ?? r.marge_dh ?? NaN), label: String(r.product ?? r.category ?? ""), qty: Number(r.qty ?? 0) })).filter((x) => !isNaN(x.v));
    const dhsBest = sel.map((r) => ({ v: Number(r.marge_dh_best ?? r.marge_dh ?? NaN), label: String(r.product ?? r.category ?? ""), qty: Number(r.qty ?? 0) })).filter((x) => !isNaN(x.v));
    const margePctMin = pctsWorst.length ? pctsWorst.reduce((a, b) => a.v < b.v ? a : b) : null;
    const margePctMax = pctsBest.length ? pctsBest.reduce((a, b) => a.v > b.v ? a : b) : null;
    const margeDhMin = dhsWorst.length ? dhsWorst.reduce((a, b) => a.v < b.v ? a : b) : null;
    const margeDhMax = dhsBest.length ? dhsBest.reduce((a, b) => a.v > b.v ? a : b) : null;
    const unitsAvailable = sel.reduce((s, r) => s + (Number(r.stock_dispo) || 0), 0);
    const totalPuPurchased = sel.reduce((s, r) => s + (Number(r.total_achat_cost) || 0), 0);
    const ppvTotalAvailable = sel.reduce((s, r) => s + ((Number(r.ppv) || 0) * (Number(r.stock_dispo) || 0)), 0);
    return {
      count: sel.length,
      ca, qty, margePctAvg, margeDhAvg,
      margePctMin: margePctMin ? { label: margePctMin.label, value: margePctMin.v, qty: margePctMin.qty } : null,
      margePctMax: margePctMax ? { label: margePctMax.label, value: margePctMax.v, qty: margePctMax.qty } : null,
      margeDhMin: margeDhMin ? { label: margeDhMin.label, value: margeDhMin.v, qty: margeDhMin.qty } : null,
      margeDhMax: margeDhMax ? { label: margeDhMax.label, value: margeDhMax.v, qty: margeDhMax.qty } : null,
      unitsAvailable, totalPuPurchased, ppvTotalAvailable,
    };
  }, [allRows, selected, search, filteredRows]);

  const toggleRow = useCallback((idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === allRows.length ? new Set() : new Set(allRows.map((_, i) => i)),
    );
  }, [allRows]);

  const exportCsv = useCallback(() => {
    // Priority: explicit selection > search-filtered > all rows.
    // Honors the active search filter so the export matches what the user sees.
    const sel = selected.size > 0
      ? allRows.filter((_, i) => selected.has(i))
      : filteredRows.map((f) => f.row);
    if (!sel.length) return;
    const cols = MARGE_COLS[margeMode];
    const esc = (v: unknown) => {
      if (v == null || typeof v === "object") return "";
      const s = String(v);
      return s.includes(";") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = cols.map((c) => esc(c.label)).join(";");
    // Strict: only emit cells declared in MARGE_COLS so suppliers/grossistes/etc.
    // never leak into a CSV from a mode whose header doesn't list them.
    const lines = sel.map((row) => cols.map((c) => esc(row[c.key])).join(";"));
    const csv = [header, ...lines].join("\n");
    downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }), exportFilename(`ANALYSE ${margeMode.toUpperCase()}`, "csv", dateFrom || undefined, dateTo || undefined));
  }, [allRows, filteredRows, selected, margeMode, dateFrom, dateTo]);

  const resetSelection = useCallback(() => {
    setSelected(new Set());
    setSearch("");
  }, []);

  // Build filtered margeData so table + KPIs use the same filtered rows
  const filteredMargeData = useMemo(() => {
    if (!margeData) return undefined;
    if (!search.trim()) return margeData;
    return { ...margeData, rows: filteredRows.map((f) => f.row) };
  }, [margeData, search, filteredRows]);

  return {
    // Filters
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    categoryType, setCategoryType,
    margeMode, setMargeMode,
    search, setSearch,
    // Data
    margeData: filteredMargeData, margeLoading, allRows, filteredRows,
    // Selection
    selected, kpis,
    toggleRow, toggleAll, resetSelection,
    // Export
    exportCsv,
  };
}
