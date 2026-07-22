/** Per-mode table for /analyse. Wraps the shared DataTable primitive; column
 *  defs come from MARGE_COLS[mode]. Pagination state lives in useAnalysePage. */
import { DataTable, type ColumnDef, type DataTablePagination } from "@/components/shared/DataTable";
import { useT } from "@/i18n/I18nProvider";
import { useMonthsShort } from "@/i18n/dates";
import type { AnalyseMargeRow, MargeMode } from "@/types";

import { MARGE_COLS } from "../_constants";


export interface AnalyseTableProps {
  mode:        MargeMode;
  rows:        AnalyseMargeRow[];
  loading:     boolean;
  pagination:  DataTablePagination;
  sortBy:      string | null;
  sortOrder:   "asc" | "desc";
  onSort:      (key: string) => void;
}

const MONTH_IDX: Record<string, number> = {
  m01: 0, m02: 1, m03: 2, m04: 3, m05: 4, m06: 5, m07: 6, m08: 7, m09: 8, m10: 9, m11: 10, m12: 11,
};


export function AnalyseTable({ mode, rows, loading, pagination, sortBy, sortOrder, onSort }: AnalyseTableProps) {
  const t = useT();
  const monthsShort = useMonthsShort();

  // Map MARGE_COLS entries into ColumnDef. Labels are translation keys → t().
  // The Année-pivot month columns take their localized short name; the Liste
  // "Statut" cell translates found / not_found.
  const columns: ColumnDef<AnalyseMargeRow>[] = MARGE_COLS[mode].map((c) => ({
    key:      c.key,
    label:    c.key in MONTH_IDX ? monthsShort[MONTH_IDX[c.key]] : t(c.label),
    align:    c.align,
    sortable: !!c.raw,
    render:   c.key === "match_status"
      ? (r: AnalyseMargeRow) => (
          r.match_status === "found"
            ? <span className="rounded-full bg-success-subtle px-2 py-0.5 text-xs font-semibold text-success">{t("analyse.trouve")}</span>
            : <span className="rounded-full bg-error-subtle px-2 py-0.5 text-xs font-semibold text-error">{t("analyse.introuvable")}</span>
        )
      : c.render,
  }));

  return (
    <DataTable<AnalyseMargeRow>
      rows={rows}
      columns={columns}
      isLoading={loading}
      pagination={pagination}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSort={onSort}
      emptyTitle={t("common.noResult")}
      emptyHint={t("analyse.tableEmptyHint")}
    />
  );
}
