/**
 * Shared data-table primitive — one visual contract across Stock, Achats,
 * Ventes, Analyse. Pages declare `columns: ColumnDef<R>[]` and pass sort +
 * pagination state through; everything else (shell, header, body row, sort
 * UI, empty / loading states, pagination footer) lives here.
 *
 * Pattern matches the KpiTile / FilterBar / Segmented shared primitives.
 */
import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { Skeleton } from "@/_components/atoms/Skeleton";
import { SingleSelect } from "@/_components/molecules/SingleSelect";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { formatQty } from "@/utils/format";
import { EmptyState } from "@/_components/molecules/EmptyState";
import { SortButton } from "@/_components/molecules/SortButton";

// Pagination footer sits below the (possibly long) table; without this, changing
// page leaves the viewport scrolled down at the footer with no visual cue that
// the table above just changed. Walk up to the nearest scrollable ancestor
// (AppLayout's <main overflow-auto>) and scroll it back to the top so the new
// page's rows are visible immediately.
function scrollNearestAncestorToTop(el: HTMLElement | null) {
  let node = el?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if (/(auto|scroll)/.test(overflowY) && node.scrollHeight > node.clientHeight) {
      node.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    node = node.parentElement;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// `scrollOnPage="table"`: a table low on a page (admin Rapport) — scroll back only up to
// the TABLE's top, and only when that top is out of view (`scroll-mt-24` leaves room
// above it).
const STICKY_ROOM = 96; // px, = scroll-mt-24

function scrollTableTopIntoView(el: HTMLElement | null) {
  if (!el) return;
  let node = el.parentElement;
  while (node && !(/(auto|scroll)/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight)) {
    node = node.parentElement;
  }
  const viewTop = node ? node.getBoundingClientRect().top : 0;
  if (el.getBoundingClientRect().top < viewTop + STICKY_ROOM) el.scrollIntoView({ block: "start", behavior: "smooth" });
}

export interface ColumnDef<R, K extends string = string> {
  key: K;
  label: string;
  width?: number; // px; sets style.width + minWidth
  align?: "left" | "right"; // default "left"; right adds tabular-nums + font-mono on cells
  sortable?: boolean; // default true; non-sortable headers skip the button + icon
  render: (row: R) => ReactNode;
}

export interface DataTablePagination {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
  pageSizes?: number[]; // default [10, 25, 50]
}

export interface DataTableProps<R, K extends string = string> {
  rows: R[];
  columns: ColumnDef<R, K>[];
  isLoading?: boolean;
  sortBy?: K | null;
  sortOrder?: "asc" | "desc";
  onSort?: (key: K) => void;
  pagination?: DataTablePagination;
  emptyTitle?: string; // default "Aucun résultat"
  emptyHint?: string;
  topBanner?: ReactNode; // Stock's filter banner; renders above the table shell
  /** Optional unique row key extractor. Defaults to index. */
  rowKey?: (row: R, index: number) => string | number;
  className?: string;
  /** Page change scrolls back to the page's top (default: list pages like Achats / Ventes)
   *  or only to this table's top (`"table"`: a table low on a page, e.g. admin Rapport). */
  scrollOnPage?: "page" | "table";
  /** A list with its details beside it (« Traçabilité »): click / Entrée picks a row, shown selected. */
  onRowClick?: (row: R, index: number) => void;
  isRowSelected?: (row: R, index: number) => boolean;
  /** A row's own look (e.g. « Historique »: sales light green, purchases light blue). */
  rowClassName?: (row: R, index: number) => string;
}

export function DataTable<R, K extends string = string>({
  rows,
  columns,
  isLoading,
  sortBy,
  sortOrder = "desc",
  onSort,
  pagination,
  emptyTitle,
  emptyHint,
  topBanner,
  rowKey,
  className,
  scrollOnPage = "page",
  onRowClick,
  isRowSelected,
  rowClassName,
}: DataTableProps<R, K>) {
  const t = useT();
  const rootRef = useRef<HTMLDivElement>(null);
  const emptyLabel = emptyTitle ?? t("common.noResult");
  // Loading + empty short-circuits. Render the real header + shimmer rows so the
  // table's shape is visible while data loads (smooth swap to real rows).
  if (isLoading && rows.length === 0) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {topBanner}
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-border bg-surface-subtle">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={cn(
                        "px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                        col.align === "right" ? "text-right" : "text-left",
                      )}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    {columns.map((col) => (
                      <td key={col.key} className="px-2.5 py-2.5">
                        <Skeleton className={cn("h-4", col.align === "right" ? "ml-auto w-14" : "w-3/4")} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {topBanner}
        <EmptyState title={emptyLabel} hint={emptyHint} className="py-16" />
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn("flex flex-col gap-3", scrollOnPage === "table" && "scroll-mt-24", className)}>
      {topBanner}
      {/* Table card. Stays overflow-hidden so the rounded corners clip the
          horizontal scrollbar cleanly. Pagination footer is a SIBLING (below)
          so its sticky positioning resolves to <main>, not this card. */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className="border-b border-border bg-surface-subtle">
                {columns.map((col) => {
                  const sortable = col.sortable !== false && !!onSort;
                  const headerCls = cn(
                    "px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                    col.align === "right" ? "text-right" : "text-left",
                  );
                  return (
                    <th
                      key={col.key}
                      style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                      className={headerCls}
                      aria-sort={
                        sortable
                          ? sortBy === col.key
                            ? sortOrder === "asc"
                              ? "ascending"
                              : "descending"
                            : "none"
                          : undefined
                      }
                    >
                      {sortable ? (
                        <SortButton
                          active={sortBy === col.key}
                          order={sortOrder}
                          alignRight={col.align === "right"}
                          onSort={() => onSort?.(col.key)}
                        >
                          {col.label}
                        </SortButton>
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
                  aria-selected={isRowSelected ? isRowSelected(row, i) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row, i) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(row, i);
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    "border-b border-border last:border-0 hover:bg-surface-subtle/50",
                    onRowClick && "cursor-pointer focus-visible:outline-2 focus-visible:outline-ring",
                    rowClassName?.(row, i),
                    isRowSelected?.(row, i) && "bg-accent hover:bg-accent",
                  )}
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

      {pagination && (
        <PaginationFooter
          {...pagination}
          onPage={(p) => {
            if (scrollOnPage === "table") scrollTableTopIntoView(rootRef.current);
            else scrollNearestAncestorToTop(rootRef.current);
            pagination.onPage(p);
          }}
        />
      )}
    </div>
  );
}

function PaginationFooter({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  pageSizes = [10, 25, 50],
}: DataTablePagination) {
  const t = useT();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  // The size in use is always a choice (Ventes, Achats, Historique show 20, not one of 10 / 25 / 50): else the
  // selector shows nothing but its arrow.
  const sizes = pageSizes.includes(pageSize) ? pageSizes : [...pageSizes, pageSize].sort((a, b) => a - b);
  const pageSizeOptions = sizes.map((n) => ({ value: String(n), label: `${n} ${t("common.perPage")}` }));
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
        {formatQty(total)} {t("common.results")}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="!h-9 !px-3"
          aria-label={t("shared.pagePrev")}
        >
          <ChevronLeft className="size-4" />
          <span className="ml-1">{t("common.previous")}</span>
        </Button>
        <span className="text-muted-foreground">
          {t("common.page")} {page} / {pageCount}
        </span>
        <Button
          variant="ghost"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
          className="!h-9 !px-3"
          aria-label={t("shared.pageNext")}
        >
          <span className="mr-1">{t("common.next")}</span>
          <ChevronRight className="size-4" />
        </Button>
        <SingleSelect
          label=""
          options={pageSizeOptions}
          value={String(pageSize)}
          onChange={(v) => {
            onPageSize(Number(v));
            onPage(1);
          }}
          placement="top"
          align="end"
        />
      </div>
    </div>
  );
}
