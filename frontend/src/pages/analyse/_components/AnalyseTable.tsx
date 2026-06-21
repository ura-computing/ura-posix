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
}


export function AnalyseTable({ mode, rows, loading, pagination }: AnalyseTableProps) {
  // Map MARGE_COLS entries (already typed AnalyseColDef) into the shared ColumnDef shape.
  const columns: ColumnDef<AnalyseMargeRow>[] = MARGE_COLS[mode].map((c) => ({
    key:      c.key,
    label:    c.label,
    align:    c.align,
    sortable: false,                 // Analyse is read-only — sort lives in the API for now
    render:   c.render,
  }));

  return (
    <DataTable<AnalyseMargeRow>
      rows={rows}
      columns={columns}
      isLoading={loading}
      pagination={pagination}
      emptyTitle="Aucun résultat"
      emptyHint="Ajustez les filtres ou changez de mode pour voir d'autres données."
    />
  );
}
