"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type DataTablePaginationProps = {
  currentPage: number;
  pageCount: number;
  setCurrentPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  total?: number;
  variant?: "default" | "simple";
};

export function DataTablePagination({
  currentPage,
  pageCount,
  setCurrentPage,
  pageSize,
  setPageSize,
  total,
  variant = "default",
}: DataTablePaginationProps) {
  const pageSizeOptions = useMemo(() => {
    const baseOptions = [10, 20, 30, 40, 50];
    const optionsSet = new Set(baseOptions);
    if (!optionsSet.has(pageSize)) optionsSet.add(pageSize);
    return Array.from(optionsSet).sort((a, b) => a - b);
  }, [pageSize]);

  const safePageCount = pageCount > 0 ? pageCount : 1;
  const isFirst = currentPage <= 1;
  const isLast = currentPage >= safePageCount;

  const NavButtons = () => (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className="hidden h-8 w-8 lg:flex"
        onClick={() => setCurrentPage(1)}
        disabled={isFirst}
        aria-label="Première page"
      >
        <ChevronsLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => setCurrentPage(currentPage - 1)}
        disabled={isFirst}
        aria-label="Page précédente"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => setCurrentPage(currentPage + 1)}
        disabled={isLast}
        aria-label="Page suivante"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="hidden h-8 w-8 lg:flex"
        onClick={() => setCurrentPage(safePageCount)}
        disabled={isLast}
        aria-label="Dernière page"
      >
        <ChevronsRight className="h-4 w-4" />
      </Button>
    </div>
  );

  if (variant === "simple") {
    return (
      <div className="flex items-center gap-2 ml-auto">
        <NavButtons />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between flex-wrap px-2 w-full gap-3">
      <p className="text-sm text-muted-foreground whitespace-nowrap">
        {typeof total === "number"
          ? `${total.toLocaleString("fr-MA")} résultat${total !== 1 ? "s" : ""}`
          : null}
      </p>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Lignes par page</span>
          <Select
            value={`${pageSize}`}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            Page <span className="font-medium text-foreground">{currentPage}</span> sur{" "}
            <span className="font-medium text-foreground">{safePageCount}</span>
          </span>
          <NavButtons />
        </div>
      </div>
    </div>
  );
}

DataTablePagination.displayName = "DataTablePagination";
