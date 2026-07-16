/** Per-mode table for /analyse. Wraps the shared DataTable primitive; column
 *  defs come from MARGE_COLS[mode]. Pagination state lives in useAnalysePage. */
import { DataTable, type ColumnDef, type DataTablePagination } from "@/components/shared/DataTable";
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


export function AnalyseTable({ mode, rows, loading, pagination, sortBy, sortOrder, onSort }: AnalyseTableProps) {
  // Map MARGE_COLS entries (already typed AnalyseColDef) into the shared ColumnDef shape.
  // PG-014: every column with a `raw` accessor is sortable — the hook sorts the
  // FULL filtered row set client-side (rows are all in memory), then paginates.
  const columns: ColumnDef<AnalyseMargeRow>[] = MARGE_COLS[mode].map((c) => ({
    key:      c.key,
    label:    c.label,
    align:    c.align,
    sortable: !!c.raw,
    render:   c.render,
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
      emptyTitle="Aucun résultat"
      emptyHint="Ajustez les filtres ou changez de mode pour voir d'autres données."
    />
  );
}
