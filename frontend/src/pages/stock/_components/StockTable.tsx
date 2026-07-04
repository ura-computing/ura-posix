import { X } from "lucide-react";

import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { cn } from "@/utils/cn";
import { formatQty } from "@/utils/format";
import type { AbcdClass, StockRow } from "@/types";

import { ABCD_COLORS, STATUS_LABELS, STATUS_META } from "../_constants";
import type { StockSortKey } from "../_hooks/useStockPage";


interface StockTableProps {
  rows:        StockRow[];
  isLoading:   boolean;
  classFilter: AbcdClass | null;
  status:      string;
  search:      string;
  sortBy:      StockSortKey;
  sortOrder:   "asc" | "desc";
  onSort:      (key: StockSortKey) => void;
  page:        number;
  pageSize:    number;
  onPage:      (p: number) => void;
  onPageSize:  (n: number) => void;
  onClose:     () => void;
}


/** Low-opacity rgba from an ABCD hex (used for the class pill bg). */
function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}


function ClassPill({ klass }: { klass: AbcdClass }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-bold"
      style={{ background: hexA(ABCD_COLORS[klass], 0.16), color: ABCD_COLORS[klass] }}
    >
      {klass}
    </span>
  );
}


function StatusPill({ status }: { status: StockRow["status"] }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-medium",
      meta.pill,
    )}>
      <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}


const COLUMNS: ColumnDef<StockRow, StockSortKey>[] = [
  { key: "product", label: "Produit", width: 280,
    render: (r) => <span className="block max-w-[260px] truncate text-base" title={r.product}>{r.product}</span> },
  { key: "category", label: "Classe", width: 80,
    render: (r) => <ClassPill klass={r.category} /> },
  { key: "units_sold_12m", label: "Ventes 12m", width: 110, align: "right",
    render: (r) => formatQty(r.units_sold_12m) },
  { key: "stock_min", label: "Stock min", width: 100, align: "right",
    render: (r) => <span className="text-muted-foreground">{formatQty(r.stock_min)}</span> },
  { key: "stock_max", label: "Stock max", width: 100, align: "right",
    render: (r) => <span className="text-muted-foreground">{formatQty(r.stock_max)}</span> },
  { key: "current_stock", label: "Stock actuel", width: 120, align: "right",
    render: (r) => r.current_stock == null
      ? <span className="text-muted-foreground">—</span>
      : <span className={cn(
          "inline-block rounded px-1.5 py-0.5 font-semibold",
          r.status === "negatif" && "bg-error/10 text-error",
        )}>{formatQty(r.current_stock)}</span> },
  { key: "status", label: "Statut", width: 140,
    render: (r) => <StatusPill status={r.status} /> },
];


export function StockTable({
  rows, isLoading, classFilter, status, search, sortBy, sortOrder, onSort,
  page, pageSize, onPage, onPageSize, onClose,
}: StockTableProps) {
  // Active-filter banner above the table (Stock-specific UX).
  const topBanner = (
    <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-surface-subtle px-3.5 py-2.5">
      <span className="text-xs font-semibold text-muted-foreground">Filtré sur</span>
      {classFilter !== null && (
        <span
          className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold"
          style={{ background: hexA(ABCD_COLORS[classFilter], 0.16), color: ABCD_COLORS[classFilter] }}
        >
          Classe {classFilter}
        </span>
      )}
      {status !== "" && (
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
          {STATUS_LABELS[status] ?? status}
        </span>
      )}
      {search.trim() !== "" && (
        <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
          « {search} »
        </span>
      )}
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        · {formatQty(rows.length)} produits
      </span>
      <button
        type="button"
        onClick={onClose}
        className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-error/40 hover:bg-error-subtle hover:text-error"
      >
        <X className="size-3" /> Fermer
      </button>
    </div>
  );

  // Client-side page slice — Stock fetches the whole filtered set at once.
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <DataTable<StockRow, StockSortKey>
      rows={pageRows}
      columns={COLUMNS}
      isLoading={isLoading}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSort={onSort}
      pagination={{
        page, pageSize, total: rows.length,
        onPage, onPageSize,
      }}
      topBanner={topBanner}
      emptyTitle="Aucun produit trouvé"
      emptyHint="Ajustez les filtres pour voir d'autres produits."
      rowKey={(r, i) => `${r.product}-${i}`}
    />
  );
}
