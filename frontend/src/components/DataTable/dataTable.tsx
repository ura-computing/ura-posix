"use client";

import type { Table, Column } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { DataTablePagination } from "@/components/DataTable/dataTablePagination";
import {
  Table as TableUI,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/utils/cn";

type PaginationProps = {
  currentPage: number;
  setCurrentPage: (p: number) => void;
  pageCount: number;
  pageSize: number;
  setPageSize: (s: number) => void;
  total?: number;
};

type DataTableProps<TData> = {
  table: Table<TData>;
  isLoading?: boolean;
  pagination?: PaginationProps;
  paginationVariant?: "default" | "simple";
  emptyState?: React.ReactNode;
};

export function DataTable<TData>({
  table,
  isLoading = false,
  pagination,
  paginationVariant = "default",
  emptyState,
}: DataTableProps<TData>) {
  const columns = table.getAllColumns();
  const leafColumns = table.getAllLeafColumns();
  const pageSize = pagination?.pageSize ?? 10;

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [isOverflowing, setIsOverflowing] = useState({ horizontal: false, vertical: false });

  useEffect(() => {
    const checkOverflow = () => {
      if (tableRef.current && tableContainerRef.current) {
        setIsOverflowing({
          horizontal: tableRef.current.offsetWidth > tableContainerRef.current.clientWidth,
          vertical: tableRef.current.offsetHeight > tableContainerRef.current.clientHeight,
        });
      }
    };
    checkOverflow();
    window.addEventListener("resize", checkOverflow);
    const id = setTimeout(checkOverflow, 100);
    return () => { window.removeEventListener("resize", checkOverflow); clearTimeout(id); };
  }, [table.getRowModel().rows.length, pageSize]);

  const hasRows = table.getRowModel().rows.length > 0;

  return (
    <div className={cn("flex", "flex-col", "flex-1", "gap-4")}>
      <div ref={tableContainerRef} className={cn("rounded-md", "border", "overflow-x-auto")}>
        <TableUI ref={tableRef} style={{ tableLayout: "fixed", width: "100%" }}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={getCommonStyles({ column: header.column, isOverflowing })}
                  >
                    {!header.isPlaceholder && (
                      <div className={cn("flex", "items-center", "gap-1")}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="relative">
            {isLoading ? (
              <>
                {Array.from({ length: pageSize < 1 ? 1 : pageSize }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`} aria-hidden="true">
                    {leafColumns.map((col) => (
                      <TableCell
                        key={`skeleton-${i}-${col.id}`}
                        style={getCommonStyles({ column: col, isOverflowing })}
                        className={cn("truncate")}
                      >
                        <div className="h-8" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className={cn("absolute", "inset-0", "pointer-events-none")}
                  >
                    <Loader2 className={cn("absolute top-1/2 left-1/2 animate-spin text-primary h-8 w-8 -translate-x-1/2 -translate-y-1/2")} />
                  </TableCell>
                </TableRow>
              </>
            ) : hasRows ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={String((row.original as { id?: unknown })?.id ?? row.id)} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => {
                    const raw = cell.getValue();
                    const tip = typeof raw === "string" || typeof raw === "number" ? String(raw) : undefined;
                    return (
                      <TableCell key={cell.id} style={getCommonStyles({ column: cell.column, isOverflowing })}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="truncate">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </div>
                          </TooltipTrigger>
                          {tip && <TooltipContent><p>{tip}</p></TooltipContent>}
                        </Tooltip>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <DataTableNoData isOverflowing={isOverflowing} columnsLength={columns.length} emptyState={emptyState} />
            )}
          </TableBody>
        </TableUI>
      </div>
      {!isLoading && hasRows && pagination && (
        <div className="sticky bottom-0 bg-background border-t py-3 -mx-2 px-2 md:-mx-4 md:px-4 lg:-mx-6 lg:px-6">
          <DataTablePagination
            currentPage={pagination.currentPage}
            pageCount={pagination.pageCount}
            setCurrentPage={pagination.setCurrentPage}
            pageSize={pagination.pageSize}
            setPageSize={pagination.setPageSize}
            total={pagination.total}
            variant={paginationVariant}
          />
        </div>
      )}
    </div>
  );
}

function DataTableNoData({
  isOverflowing,
  columnsLength,
  emptyState,
}: {
  isOverflowing: { horizontal: boolean; vertical: boolean };
  columnsLength: number;
  emptyState?: React.ReactNode;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={columnsLength} className={cn("relative", "text-center")} style={{ height: "490px" }}>
        <div
          className={cn("absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background")}
          style={{
            position: isOverflowing.horizontal ? "sticky" : "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: isOverflowing.horizontal ? 2 : 1,
            width: isOverflowing.horizontal ? "fit-content" : "100%",
            minWidth: "300px",
          }}
        >
          {emptyState ?? (
            <>
              <div className={cn("text-lg font-semibold text-foreground")}>Aucune donnée</div>
              <div className={cn("text-sm text-muted-foreground")}>Cette table est vide pour le moment.</div>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function getCommonStyles<TData>({
  column,
  isOverflowing,
}: {
  column: Column<TData>;
  isOverflowing: { horizontal: boolean; vertical: boolean };
}): React.CSSProperties {
  const isPinned = column.getIsPinned();
  const isLastLeft = isPinned === "left" && column.getIsLastColumn("left");
  const isFirstRight = isPinned === "right" && column.getIsFirstColumn("right");

  return {
    boxShadow:
      isOverflowing.horizontal && isLastLeft ? "-4px 0 4px -4px var(--border) inset"
      : isOverflowing.horizontal && isFirstRight ? "4px 0 4px -4px var(--border) inset"
      : undefined,
    left: isOverflowing.horizontal && isPinned === "left" ? `${column.getStart("left")}px` : undefined,
    right: isOverflowing.horizontal && isPinned === "right" ? `${column.getAfter("right")}px` : undefined,
    opacity: 1,
    position: isOverflowing.horizontal && isPinned ? "sticky" : "relative",
    background: isOverflowing.horizontal && isPinned ? "var(--background)" : "",
    borderTopRightRadius: isOverflowing.horizontal && isPinned === "right" ? "var(--radius)" : undefined,
    borderBottomRightRadius: isOverflowing.horizontal && isPinned === "right" ? "var(--radius)" : undefined,
    borderTopLeftRadius: isOverflowing.horizontal && isPinned === "left" ? "var(--radius)" : undefined,
    borderBottomLeftRadius: isOverflowing.horizontal && isPinned === "left" ? "var(--radius)" : undefined,
    width: column.getSize(),
    zIndex: isOverflowing.horizontal && isPinned ? 1 : 0,
  };
}

DataTable.displayName = "DataTable";
