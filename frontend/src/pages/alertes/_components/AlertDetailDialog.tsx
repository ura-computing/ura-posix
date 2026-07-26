// src/pages/alertes/_components/AlertDetailDialog.tsx
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/utils/cn";
import { formatMAD, formatPct, formatQty } from "@/utils/format";
import { downloadXlsx, exportFilename } from "@/utils/table";
import { ABCD_COLORS } from "@/pages/stock/_constants";
import type { StockRow } from "@/types";
import { useT } from "@/i18n/I18nProvider";

export interface AlertColumn<T = any> {
  key: string;
  label: string;
  align?: "left" | "right";
  cell: (row: T) => ReactNode;        // formatted JSX for the cell
  raw: (row: T) => string | number;   // RAW value for Excel export (Excel formats/sums)
  sortValue?: (row: T) => number | string; // defaults to raw()
}

function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

/* ---- column sets (one per alert kind) ---- */

type MarginRow = { product: string; marge_pct: number; ca: number };
export const MARGIN_COLUMNS: AlertColumn<MarginRow>[] = [
  { key: "product", label: "col.produit", align: "left", raw: (r) => r.product,
    cell: (r) => <span className="text-sm font-medium" title={r.product}>{r.product}</span> },
  { key: "marge_pct", label: "alertes.marge", align: "right", raw: (r) => r.marge_pct,
    cell: (r) => <span className={cn("font-mono", r.marge_pct < 0 && "text-error")}>{formatPct(r.marge_pct)}</span> },
  { key: "ca", label: "col.ca", align: "right", raw: (r) => r.ca,
    cell: (r) => <span className="font-mono">{formatMAD(r.ca)}</span> },
];

type VsaRow = {
  product:         string;
  category:        string | null;
  ppv:             number | null;
  units_sold:      number;
  ca:              number;
  last_vente_date: string | null;
};
export const VENTES_SANS_ACHAT_COLUMNS: AlertColumn<VsaRow>[] = [
  { key: "product", label: "col.produit", align: "left", raw: (r) => r.product,
    cell: (r) => <span className="text-sm font-medium" title={r.product}>{r.product}</span> },
  { key: "category", label: "col.categorie", align: "left", raw: (r) => r.category ?? "",
    cell: (r) => <span className="text-sm text-muted-foreground">{r.category ?? "—"}</span> },
  { key: "units_sold", label: "alertes.qteVendue", align: "right", raw: (r) => r.units_sold,
    cell: (r) => <span className="font-mono">{formatQty(r.units_sold)}</span> },
  { key: "ca", label: "col.ca", align: "right", raw: (r) => r.ca,
    cell: (r) => <span className="font-mono">{formatMAD(r.ca)}</span> },
  { key: "ppv", label: "col.ppv", align: "right", raw: (r) => r.ppv ?? 0,
    cell: (r) => r.ppv == null
      ? <span className="text-muted-foreground">—</span>
      : <span className="font-mono">{formatMAD(r.ppv)}</span> },
  { key: "last_vente_date", label: "alertes.derniereVente", align: "left", raw: (r) => r.last_vente_date ?? "",
    sortValue: (r) => (r.last_vente_date ? Date.parse(r.last_vente_date) : -Infinity),
    cell: (r) => <span className="font-mono">{r.last_vente_date ?? "—"}</span> },
];

type PeremRow = { product: string; expiry_date: string | null; quantity: number; ppv: number };
export const PEREMPTION_COLUMNS: AlertColumn<PeremRow>[] = [
  { key: "product", label: "col.produit", align: "left", raw: (r) => r.product,
    cell: (r) => <span className="text-sm font-medium" title={r.product}>{r.product}</span> },
  { key: "expiry_date", label: "alertes.dateExpiration", align: "left",
    raw: (r) => r.expiry_date ?? "",
    sortValue: (r) => (r.expiry_date ? Date.parse(r.expiry_date) : Infinity),
    cell: (r) =>
      r.expiry_date ? (
        <span className={cn("font-mono", new Date(r.expiry_date) < new Date() && "text-error")}>{r.expiry_date}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ) },
  { key: "quantity", label: "alertes.quantite", align: "right", raw: (r) => r.quantity,
    cell: (r) => <span className="font-mono">{formatQty(r.quantity)}</span> },
  { key: "ppv", label: "col.ppv", align: "right", raw: (r) => r.ppv,
    cell: (r) => <span className="font-mono">{formatMAD(r.ppv)}</span> },
];

export const STOCK_COLUMNS: AlertColumn<StockRow>[] = [
  { key: "product", label: "col.produit", align: "left", raw: (r) => r.product,
    cell: (r) => <span className="text-sm font-medium" title={r.product}>{r.product}</span> },
  { key: "category", label: "stock.classe", align: "left", raw: (r) => r.category,
    cell: (r) => (
      <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold"
        style={{ background: hexA(ABCD_COLORS[r.category], 0.16), color: ABCD_COLORS[r.category] }}>
        {r.category}
      </span>
    ) },
  { key: "current_stock", label: "stock.stockActuel", align: "right",
    raw: (r) => r.current_stock ?? 0,
    sortValue: (r) => r.current_stock ?? -Infinity,
    cell: (r) =>
      r.current_stock == null ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span className={cn("font-mono", r.current_stock < 0 && "rounded bg-error/10 px-1.5 text-error")}>
          {formatQty(r.current_stock)}
        </span>
      ) },
  { key: "stock_min", label: "stock.stockMin", align: "right", raw: (r) => r.stock_min,
    cell: (r) => <span className="font-mono text-muted-foreground">{formatQty(r.stock_min)}</span> },
  { key: "stock_max", label: "stock.stockMax", align: "right", raw: (r) => r.stock_max,
    cell: (r) => <span className="font-mono text-muted-foreground">{formatQty(r.stock_max)}</span> },
  { key: "ppv", label: "col.ppv", align: "right", raw: (r) => r.ppv ?? 0,
    cell: (r) => (r.ppv == null ? <span className="text-muted-foreground">—</span> : <span className="font-mono">{formatMAD(r.ppv)}</span>) },
];

export interface AlertDetailDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  products: any[];
  columns: AlertColumn[];
  defaultSortKey: string;
  dateFrom?: string;
  dateTo?: string;
}

export function AlertDetailDialog({
  open, onClose, title, subtitle, products, columns, defaultSortKey, dateFrom, dateTo,
}: AlertDetailDialogProps) {
  const t = useT();
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // reset sort whenever the dialog target changes
  useEffect(() => {
    setSortKey(defaultSortKey);
    setSortOrder("asc");
  }, [title, defaultSortKey]);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return products;
    const val = col.sortValue ?? col.raw;
    const dir = sortOrder === "asc" ? 1 : -1;
    return [...products].sort((a, b) => {
      const x = val(a), y = val(b);
      if (typeof x === "string" || typeof y === "string") return String(x).localeCompare(String(y), "fr") * dir;
      return ((x as number) - (y as number)) * dir;
    });
  }, [products, columns, sortKey, sortOrder]);

  const toggleSort = (key: string) => {
    if (key === sortKey) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortOrder("asc"); }
  };

  const handleExport = () => {
    if (sorted.length === 0) return;
    const aoa = [columns.map((c) => c.label), ...sorted.map((r) => columns.map((c) => c.raw(r)))];
    downloadXlsx(aoa, exportFilename(`ALERTES ${title}`, "xlsx", dateFrom, dateTo));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[88vh] w-full max-w-[1400px] flex-col gap-0 p-0">
        {/* header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              <span className="rounded-md border border-border bg-surface-subtle px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-muted-foreground">
                {formatQty(products.length)} {t("common.wProduits")}
              </span>
            </div>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-auto px-5 py-4">
          {products.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">{t("alertes.emptyCat")}</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-[13px]">
                  <thead>
                    <tr>
                      {columns.map((c) => {
                        const active = sortKey === c.key;
                        const Icon = !active ? ArrowUpDown : sortOrder === "asc" ? ArrowUp : ArrowDown;
                        return (
                          <th
                            key={c.key}
                            onClick={() => toggleSort(c.key)}
                            className={cn(
                              "sticky top-0 z-[1] cursor-pointer select-none whitespace-nowrap border-b border-border bg-surface-subtle p-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground",
                              c.align === "right" ? "text-right" : "text-left",
                            )}
                          >
                            <span className={cn("inline-flex items-center gap-1.5", c.align === "right" && "flex-row-reverse")}>
                              {t(c.label)}
                              <Icon className={cn("size-3", active ? "text-primary" : "opacity-50")} />
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((row, i) => (
                      <tr key={i} className="hover:bg-surface-subtle">
                        {columns.map((c) => (
                          <td
                            key={c.key}
                            className={cn(
                              "border-b border-border/60 p-2.5 align-top",
                              c.align === "right"
                                ? "whitespace-nowrap text-right"
                                : "whitespace-normal break-words text-left",
                            )}
                          >
                            {c.cell(row)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-subtle px-5 py-3">
          <button
            type="button"
            onClick={handleExport}
            disabled={sorted.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3.5 py-2 text-[13px] font-semibold text-secondary-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            <Download className="size-4" /> {t("common.export")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-secondary px-4 py-2 text-[13px] font-semibold text-secondary-foreground hover:bg-muted cursor-pointer"
          >
            {t("common.close")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
