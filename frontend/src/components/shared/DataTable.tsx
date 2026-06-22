/**
 * Shared data-table primitive — one visual contract across Stock, Achats,
 * Ventes, Analyse. Pages declare `columns: ColumnDef<R>[]` and pass sort +
 * pagination state through; everything else (shell, header, body row, sort
 * UI, empty / loading states, pagination footer) lives here.
 *
 * Pattern matches the KpiTile / FilterBar / CategorySegment shared primitives.
 */
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { AsyncButton } from "@/components/shared/AsyncButton";
import { SingleSelectPopover } from "@/components/shared/SingleSelectPopover";
import { cn } from "@/utils/cn";
import { formatQty } from "@/utils/format";


export interface ColumnDef<R, K extends string = string> {
  key:       K;
  label:     string;
  width?:    number;             // px; sets style.width + minWidth
  align?:    "left" | "right";   // default "left"; right adds tabular-nums + font-mono on cells
  sortable?: boolean;            // default true; non-sortable headers skip the button + icon
  render:    (row: R) => ReactNode;
}


export interface DataTablePagination {
  page:       number;
  pageSize:   number;
  total:      number;
  onPage:     (p: number) => void;
  onPageSize: (n: number) => void;
  pageSizes?: number[];          // default [10, 25, 50]
}


export interface DataTableProps<R, K extends string = string> {
  rows:        R[];
  columns:     ColumnDef<R, K>[];
  isLoading?:  boolean;
  sortBy?:     K | null;
  sortOrder?:  "asc" | "desc";
  onSort?:     (key: K) => void;
  pagination?: DataTablePagination;
  emptyTitle?: string;           // default "Aucun résultat"
  emptyHint?:  string;
  topBanner?:  ReactNode;        // Stock's filter banner; renders above the table shell
  /** Optional unique row key extractor. Defaults to index. */
  rowKey?:     (row: R, index: number) => string | number;
  className?:  string;
}


function SortIcon({ active, order }: { active: boolean; order: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="size-3 text-muted-foreground/60" />;
  return order === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />;
}


export function DataTable<R, K extends string = string>({
  rows, columns, isLoading, sortBy, sortOrder = "desc", onSort,
  pagination, emptyTitle = "Aucun résultat", emptyHint, topBanner, rowKey,
  className,
}: DataTableProps<R, K>) {
  // Loading + empty short-circuits (no shell when empty/loading — matches existing tables).
  if (isLoading && rows.length === 0) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {topBanner}
        <div className="flex items-center justify-center rounded-xl border border-border bg-card py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {topBanner}
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <p className="text-sm font-medium text-foreground">{emptyTitle}</p>
          {emptyHint && <p className="text-xs text-muted-foreground">{emptyHint}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {topBanner}
      {/* Table card. Stays overflow-hidden so the rounded corners clip the
          horizontal scrollbar cleanly. Pagination footer is a SIBLING (below)
          so its sticky positioning resolves to <main>, not this card. */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-subtle">
                {columns.map((col) => {
                  const sortable = col.sortable !== false && !!onSort;
                  const headerCls = cn(
                    "px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground",
                    col.align === "right" ? "text-right" : "text-left",
                  );
                  return (
                    <th
                      key={col.key}
                      style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                      className={headerCls}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => onSort?.(col.key)}
                          className={cn(
                            "inline-flex cursor-pointer items-center gap-1 hover:text-foreground",
                            col.align === "right" && "flex-row-reverse",
                          )}
                        >
                          {col.label}
                          <SortIcon active={sortBy === col.key} order={sortOrder} />
                        </button>
                      ) : (
                        <span>{col.label}</span>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={rowKey ? rowKey(row, i) : i}
                  className="border-b border-border last:border-0 hover:bg-surface-subtle/50"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                      className={cn(
                        "px-2.5 py-2",
                        col.align === "right" ? "text-right tabular-nums font-mono" : "text-left",
                      )}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pagination && <PaginationFooter {...pagination} />}
    </div>
  );
}


function PaginationFooter({
  page, pageSize, total, onPage, onPageSize, pageSizes = [10, 25, 50],
}: DataTablePagination) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pageSizeOptions = pageSizes.map((n) => ({ value: String(n), label: `${n} / page` }));
  return (
    // Mirrors the FilterBar at the top of the page: sticky-pinned to <main>,
    // own card shell, same z-20 layer. Lives OUTSIDE the table card so its
    // sticky positioning resolves to <main> directly (no clipping ancestor).
    <div
      className={cn(
        "sticky bottom-0 z-20 flex flex-wrap items-center justify-between gap-3",
        "rounded-xl border border-border bg-card px-4 py-2 text-xs shadow-sm",
      )}
    >
      <span className="font-mono tabular-nums text-muted-foreground">
        {formatQty(total)} résultats
      </span>
      <div className="flex items-center gap-2">
        <AsyncButton
          variant="ghost"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="!h-9 !px-3"
          aria-label="Page précédente"
        >
          <ChevronLeft className="size-4" />
          <span className="ml-1">Précédent</span>
        </AsyncButton>
        <span className="text-muted-foreground">Page {page} / {pageCount}</span>
        <AsyncButton
          variant="ghost"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
          className="!h-9 !px-3"
          aria-label="Page suivante"
        >
          <span className="mr-1">Suivant</span>
          <ChevronRight className="size-4" />
        </AsyncButton>
        <SingleSelectPopover
          label=""
          options={pageSizeOptions}
          value={String(pageSize)}
          onChange={(v) => { onPageSize(Number(v)); onPage(1); }}
          placement="top"
          align="end"
        />
      </div>
    </div>
  );
}
