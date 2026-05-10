import { useMemo, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, Download, FileSpreadsheet, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table as TableUI,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/utils/cn";
import { exportToXlsx, exportToPdf, type ExportColumn } from "@/utils/exportTable";
import { exportFilename } from "@/utils/table";

export type AlertColumn<T> = {
  key: string;
  header: string;
  accessor: (row: T) => string | number | null | undefined;
  align?: "left" | "right";
  format?: (value: ReturnType<AlertColumn<T>["accessor"]>, row: T) => React.ReactNode;
};

type Props<T> = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  products: T[];
  columns: AlertColumn<T>[];
};

export function AlertDetailDialog<T>({
  open,
  onOpenChange,
  title,
  description,
  products,
  columns,
}: Props<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const tableColumns = useMemo<ColumnDef<T>[]>(
    () =>
      columns.map((c) => ({
        id: c.key,
        header: c.header,
        accessorFn: c.accessor as (row: T) => unknown,
        cell: ({ row, getValue }) => {
          const v = getValue() as ReturnType<AlertColumn<T>["accessor"]>;
          return c.format ? c.format(v, row.original) : (v ?? "—");
        },
      })),
    [columns],
  );

  const table = useReactTable({
    data: products,
    columns: tableColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const totalRows = products.length;

  // Build export columns + rows once. We export `accessor` values (raw) so the
  // spreadsheet/PDF contain plain strings & numbers — the React-node `format`
  // is display-only and skipped. Rows follow the current sorted order.
  const exportCols: ExportColumn[] = columns.map((c) => ({
    key: c.key,
    header: c.header,
    align: c.align,
    value: (row) => c.accessor(row as T),
  }));
  const exportRows = table.getRowModel().rows.map((r) => r.original as Record<string, unknown>);
  const fileBase = exportFilename(`ALERTES ${title}`, "", undefined, undefined).replace(/\.$/, "");

  const handleExportXlsx = () => exportToXlsx(fileBase, exportCols, exportRows);
  const handleExportPdf = () => exportToPdf(fileBase, title, exportCols, exportRows);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-lg">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
          <p className="text-xs text-muted-foreground mt-1 tabular-nums">
            {totalRows} produit{totalRows !== 1 ? "s" : ""}
          </p>
        </DialogHeader>

        <div className="overflow-auto flex-1">
          <TableUI>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                {table.getHeaderGroups()[0]?.headers.map((header) => {
                  const col = columns.find((c) => c.key === header.column.id);
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "select-none",
                        col?.align === "right" && "text-right",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => header.column.toggleSorting(sorted === "asc")}
                        className={cn(
                          "inline-flex items-center gap-1 hover:text-foreground transition-colors",
                          col?.align === "right" && "ml-auto",
                        )}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span className="inline-flex flex-col leading-none ml-0.5">
                          <ChevronUp className={cn("h-3 w-3 -mb-1", sorted === "asc" ? "opacity-100" : "opacity-30")} />
                          <ChevronDown className={cn("h-3 w-3", sorted === "desc" ? "opacity-100" : "opacity-30")} />
                        </span>
                      </button>
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-32 text-center text-sm text-muted-foreground">
                    Aucun produit.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => {
                      const col = columns.find((c) => c.key === cell.column.id);
                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            col?.align === "right" && "text-right tabular-nums",
                          )}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </TableUI>
        </div>

        <div className="px-6 py-3 border-t flex justify-end gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={totalRows === 0}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Exporter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={handleExportXlsx} className="cursor-pointer">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span className="ml-2">Excel (.xlsx)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportPdf} className="cursor-pointer">
                <FileText className="h-4 w-4 text-red-600" />
                <span className="ml-2">PDF</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
