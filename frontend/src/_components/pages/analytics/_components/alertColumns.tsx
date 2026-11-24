/** The columns of the alert window (AlertDetailDialog), one set per alert kind: the cell and the raw
 *  value of the Excel export. */
import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import { formatMAD, formatPct, formatQty } from "@/utils/format";
import { ABCD_COLORS } from "@/_components/pages/analytics/constants";
import type { StockRow } from "@/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- one window for 4 row types
export interface AlertColumn<T = any> {
  key: string;
  label: string;
  align?: "left" | "right";
  cell: (row: T) => ReactNode; // formatted JSX for the cell
  raw: (row: T) => string | number; // RAW value for Excel export (Excel formats/sums)
  sortValue?: (row: T) => number | string; // defaults to raw()
}

function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

/* ---- column sets (one per alert kind) ---- */

type MarginRow = { product: string; marge_pct: number; ca: number };
export const MARGIN_COLUMNS: AlertColumn<MarginRow>[] = [
  {
    key: "product",
    label: "col.produit",
    align: "left",
    raw: (r) => r.product,
    cell: (r) => (
      <span className="text-sm font-medium" title={r.product}>
        {r.product}
      </span>
    ),
  },
  {
    key: "marge_pct",
    label: "alertes.marge",
    align: "right",
    raw: (r) => r.marge_pct,
    cell: (r) => <span className={cn("font-mono", r.marge_pct < 0 && "text-error")}>{formatPct(r.marge_pct)}</span>,
  },
  {
    key: "ca",
    label: "col.ca",
    align: "right",
    raw: (r) => r.ca,
    cell: (r) => <span className="font-mono">{formatMAD(r.ca)}</span>,
  },
];

type VsaRow = {
  product: string;
  category: string | null;
  ppv: number | null;
  units_sold: number;
  ca: number;
  last_vente_date: string | null;
};
export const VENTES_SANS_ACHAT_COLUMNS: AlertColumn<VsaRow>[] = [
  {
    key: "product",
    label: "col.produit",
    align: "left",
    raw: (r) => r.product,
    cell: (r) => (
      <span className="text-sm font-medium" title={r.product}>
        {r.product}
      </span>
    ),
  },
  {
    key: "category",
    label: "col.categorie",
    align: "left",
    raw: (r) => r.category ?? "",
    cell: (r) => <span className="text-sm text-muted-foreground">{r.category ?? "—"}</span>,
  },
  {
    key: "units_sold",
    label: "alertes.qteVendue",
    align: "right",
    raw: (r) => r.units_sold,
    cell: (r) => <span className="font-mono">{formatQty(r.units_sold)}</span>,
  },
  {
    key: "ca",
    label: "col.ca",
    align: "right",
    raw: (r) => r.ca,
    cell: (r) => <span className="font-mono">{formatMAD(r.ca)}</span>,
  },
  {
    key: "ppv",
    label: "col.ppv",
    align: "right",
    raw: (r) => r.ppv ?? 0,
    cell: (r) =>
      r.ppv == null ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span className="font-mono">{formatMAD(r.ppv)}</span>
      ),
  },
  {
    key: "last_vente_date",
    label: "alertes.derniereVente",
    align: "left",
    raw: (r) => r.last_vente_date ?? "",
    sortValue: (r) => (r.last_vente_date ? Date.parse(r.last_vente_date) : -Infinity),
    cell: (r) => <span className="font-mono">{r.last_vente_date ?? "—"}</span>,
  },
];

type PeremRow = { product: string; expiry_date: string | null; quantity: number; ppv: number };
export const PEREMPTION_COLUMNS: AlertColumn<PeremRow>[] = [
  {
    key: "product",
    label: "col.produit",
    align: "left",
    raw: (r) => r.product,
    cell: (r) => (
      <span className="text-sm font-medium" title={r.product}>
        {r.product}
      </span>
    ),
  },
  {
    key: "expiry_date",
    label: "alertes.dateExpiration",
    align: "left",
    raw: (r) => r.expiry_date ?? "",
    sortValue: (r) => (r.expiry_date ? Date.parse(r.expiry_date) : Infinity),
    cell: (r) =>
      r.expiry_date ? (
        <span className={cn("font-mono", new Date(r.expiry_date) < new Date() && "text-error")}>{r.expiry_date}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: "quantity",
    label: "alertes.quantite",
    align: "right",
    raw: (r) => r.quantity,
    cell: (r) => <span className="font-mono">{formatQty(r.quantity)}</span>,
  },
  {
    key: "ppv",
    label: "col.ppv",
    align: "right",
    raw: (r) => r.ppv,
    cell: (r) => <span className="font-mono">{formatMAD(r.ppv)}</span>,
  },
];

export const STOCK_COLUMNS: AlertColumn<StockRow>[] = [
  {
    key: "product",
    label: "col.produit",
    align: "left",
    raw: (r) => r.product,
    cell: (r) => (
      <span className="text-sm font-medium" title={r.product}>
        {r.product}
      </span>
    ),
  },
  {
    key: "category",
    label: "stock.classe",
    align: "left",
    raw: (r) => r.category,
    cell: (r) => (
      <span
        className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold"
        style={{ background: hexA(ABCD_COLORS[r.category], 0.16), color: ABCD_COLORS[r.category] }}
      >
        {r.category}
      </span>
    ),
  },
  {
    key: "current_stock",
    label: "stock.stockActuel",
    align: "right",
    raw: (r) => r.current_stock ?? 0,
    sortValue: (r) => r.current_stock ?? -Infinity,
    cell: (r) =>
      r.current_stock == null ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span className={cn("font-mono", r.current_stock < 0 && "rounded bg-error/10 px-1.5 text-error")}>
          {formatQty(r.current_stock)}
        </span>
      ),
  },
  {
    key: "stock_min",
    label: "stock.stockMin",
    align: "right",
    raw: (r) => r.stock_min,
    cell: (r) => <span className="font-mono text-muted-foreground">{formatQty(r.stock_min)}</span>,
  },
  {
    key: "stock_max",
    label: "stock.stockMax",
    align: "right",
    raw: (r) => r.stock_max,
    cell: (r) => <span className="font-mono text-muted-foreground">{formatQty(r.stock_max)}</span>,
  },
  {
    key: "ppv",
    label: "col.ppv",
    align: "right",
    raw: (r) => r.ppv ?? 0,
    cell: (r) =>
      r.ppv == null ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span className="font-mono">{formatMAD(r.ppv)}</span>
      ),
  },
];
