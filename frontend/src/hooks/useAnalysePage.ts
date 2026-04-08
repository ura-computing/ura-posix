import { useState, useMemo, useCallback } from "react";
import { useAnalyseMarge } from "@/hooks/usePharmacyRapports";
import { eCategoryType } from "@/types";
import { MARGE_COLS, SIM_LABEL_KEY, type MargeMode } from "@/pages/rapports/margeTable";
import { downloadBlob } from "@/pages/rapports/shared";

export function useAnalysePage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
    if (!search.trim()) return allRows.map((r, i) => ({ row: r, idx: i }));
    const q = search.toLowerCase();
    return allRows
      .map((r, i) => ({ row: r, idx: i }))
      .filter(({ row }) => String(row[SIM_LABEL_KEY[margeMode]] ?? "").toLowerCase().includes(q));
  }, [allRows, search, margeMode]);

  const kpis = useMemo(() => {
    const sel = allRows.filter((_, i) => selected.has(i));
    const ca = sel.reduce((s, r) => s + (Number(r.ca ?? r.total) || 0), 0);
    const qty = sel.reduce((s, r) => s + (Number(r.qty) || 0), 0);
    const pcts = sel.map((r) => Number(r.marge_pct ?? r.marge_pct_avg ?? NaN)).filter((v) => !isNaN(v));
    const dhs = sel.map((r) => Number(r.marge_dh ?? r.marge_dh_avg ?? NaN)).filter((v) => !isNaN(v));
    return {
      count: sel.length,
      ca,
      qty,
      margePctAvg: pcts.length ? pcts.reduce((s, v) => s + v, 0) / pcts.length : null,
      margeDhAvg: dhs.length ? dhs.reduce((s, v) => s + v, 0) / dhs.length : null,
    };
  }, [allRows, selected]);

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
    const sel = allRows.filter((_, i) => selected.has(i));
    if (!sel.length) return;
    const cols = MARGE_COLS[margeMode];
    const esc = (v: unknown) => {
      if (v == null || typeof v === "object") return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = cols.map((c) => esc(c.label)).join(",");
    const lines = sel.map((row) => cols.map((c) => esc(row[c.key])).join(","));
    const csv = [header, ...lines].join("\n");
    downloadBlob(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }), `analyse_${margeMode}_selection.csv`);
  }, [allRows, selected, margeMode]);

  const resetSelection = useCallback(() => {
    setSelected(new Set());
    setSearch("");
  }, []);

  return {
    // Filters
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    categoryType, setCategoryType,
    margeMode, setMargeMode,
    search, setSearch,
    // Data
    margeData, margeLoading, allRows, filteredRows,
    // Selection
    selected, kpis,
    toggleRow, toggleAll, resetSelection,
    // Export
    exportCsv,
  };
}
