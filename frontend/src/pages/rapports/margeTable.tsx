import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
  ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getExpandedRowModel,
  useReactTable,
  type PaginationState,
} from "@tanstack/react-table";
import type { AnalyseMargeResponse } from "@/api/stats";
import { DataTable } from "@/components/DataTable/dataTable";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MargeMode = "produit" | "categorie" | "grossiste" | "bl" | "laboratoire" | "operateur" | "mois" | "annee";

export const SIM_LABEL_KEY: Record<MargeMode, string> = {
  produit: "product", categorie: "category", grossiste: "grossiste", bl: "delivery_ref",
  laboratoire: "laboratoire", operateur: "client", mois: "mois", annee: "annee",
};

export const MARGE_COLS: Record<MargeMode, { key: string; label: string; numeric?: boolean }[]> = {
  produit:     [
    { key: "product",       label: "Produit" },
    { key: "stock_dispo",   label: "Stock dispo", numeric: true },
    { key: "qty",           label: "Vente total unit", numeric: true },
    { key: "ca",            label: "Vente total DH", numeric: true },
    { key: "prix_max",      label: "Prix unit +", numeric: true },
    { key: "prix_min",      label: "Prix unit -", numeric: true },
    { key: "prix_avg",      label: "Prix unit X", numeric: true },
    { key: "ppv",           label: "PPV", numeric: true },
    { key: "marge_pct",     label: "Marge% X", numeric: true },
    { key: "marge_dh",      label: "Marge DH X", numeric: true },
    { key: "category",      label: "Catégorie" },
    { key: "tva",           label: "TVA" },
  ],
  categorie:   [
    { key: "category",      label: "Catégorie" },
    { key: "prix_max",      label: "Prix max", numeric: true },
    { key: "prix_min",      label: "Prix min", numeric: true },
    { key: "prix_avg",      label: "Prix moy.", numeric: true },
    { key: "marge_pct_avg", label: "Marge % moy.", numeric: true },
    { key: "marge_dh_avg",  label: "Marge DH moy.", numeric: true },
    { key: "qty",           label: "Qté", numeric: true },
    { key: "ca",            label: "CA (MAD)", numeric: true },
  ],
  grossiste: [
    { key: "grossiste",     label: "Grossiste" },
    { key: "prix_max",      label: "Prix max", numeric: true },
    { key: "prix_min",      label: "Prix min", numeric: true },
    { key: "prix_avg",      label: "Prix moy.", numeric: true },
    { key: "marge_pct_avg", label: "Marge % moy.", numeric: true },
    { key: "marge_dh_avg",  label: "Marge DH moy.", numeric: true },
    { key: "qty",           label: "Qté", numeric: true },
    { key: "ca",            label: "CA (MAD)", numeric: true },
  ],
  bl:          [
    { key: "delivery_ref",  label: "Référence BL" },
    { key: "supplier",      label: "Fournisseur" },
    { key: "delivery_date", label: "Date livraison" },
    { key: "nb_produits",   label: "Nb produits", numeric: true },
    { key: "qty",           label: "Quantité", numeric: true },
    { key: "total",         label: "Total achats (MAD)", numeric: true },
  ],
  laboratoire: [
    { key: "laboratoire",   label: "Laboratoire" },
    { key: "prix_max",      label: "Prix max", numeric: true },
    { key: "prix_min",      label: "Prix min", numeric: true },
    { key: "prix_avg",      label: "Prix moy.", numeric: true },
    { key: "marge_pct_avg", label: "Marge % moy.", numeric: true },
    { key: "marge_dh_avg",  label: "Marge DH moy.", numeric: true },
    { key: "qty",           label: "Qté", numeric: true },
    { key: "ca",            label: "CA (MAD)", numeric: true },
  ],
  operateur: [
    { key: "client",          label: "Opérateur / Client" },
    { key: "nb_transactions", label: "Transactions", numeric: true },
    { key: "qty",             label: "Qté", numeric: true },
    { key: "ca",              label: "CA (MAD)", numeric: true },
  ],
  mois: [
    { key: "mois",            label: "Mois" },
    { key: "nb_transactions", label: "Transactions", numeric: true },
    { key: "qty",             label: "Qté", numeric: true },
    { key: "ca",              label: "CA (MAD)", numeric: true },
  ],
  annee: [
    { key: "annee", label: "Année" },
    { key: "m01",   label: "Jan", numeric: true },
    { key: "m02",   label: "Fév", numeric: true },
    { key: "m03",   label: "Mar", numeric: true },
    { key: "m04",   label: "Avr", numeric: true },
    { key: "m05",   label: "Mai", numeric: true },
    { key: "m06",   label: "Juin", numeric: true },
    { key: "m07",   label: "Juil", numeric: true },
    { key: "m08",   label: "Août", numeric: true },
    { key: "m09",   label: "Sep", numeric: true },
    { key: "m10",   label: "Oct", numeric: true },
    { key: "m11",   label: "Nov", numeric: true },
    { key: "m12",   label: "Déc", numeric: true },
    { key: "ca",    label: "Total", numeric: true },
  ],
};

// ── Cell renderer ─────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function fmtCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AnalyseMargeTable({
  mode,
  data,
  loading,
  selectable,
  selected,
  onToggle,
}: {
  mode: MargeMode;
  data: AnalyseMargeResponse | undefined;
  loading: boolean;
  selectable?: boolean;
  selected?: Set<number>;
  onToggle?: (globalIndex: number) => void;
}) {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const rawRows = (data?.rows ?? []) as Row[];

  const columns = useMemo<ColumnDef<Row>[]>(() => {
    const defs: ColumnDef<Row>[] = [];

    if (selectable) {
      defs.push({
        id: "__select",
        size: 40,
        enableSorting: false,
        enableHiding: false,
        header: () => null,
        cell: ({ row }) => {
          // Only top-level rows are selectable (depth 0)
          if (row.depth > 0) return null;
          const idx = Number(row.id);
          const isSel = selected?.has(idx) ?? false;
          return (
            <input
              type="checkbox"
              checked={isSel}
              onChange={() => onToggle?.(idx)}
              onClick={(e) => e.stopPropagation()}
              className="h-3.5 w-3.5 rounded border-border cursor-pointer"
            />
          );
        },
      });
    }

    const cols = MARGE_COLS[mode];
    cols.forEach((col, colIdx) => {
      defs.push({
        id: col.key,
        accessorKey: col.key,
        size: col.numeric ? 120 : 180,
        header: () => <span className={col.numeric ? "w-full text-right" : ""}>{col.label}</span>,
        sortingFn: col.numeric ? "basic" : "alphanumeric",
        cell: ({ row, getValue }) => {
          const value = getValue();
          const isFirst = colIdx === 0;
          const canExpand = isFirst && mode === "produit" && row.getCanExpand();
          const indent = row.depth > 0 && isFirst ? "pl-5" : "";
          const content = fmtCell(value);
          const childCount =
            canExpand ? (row.original.children as Row[] | undefined)?.length ?? 0 : 0;

          if (canExpand) {
            return (
              <span
                className="inline-flex items-center gap-1 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  row.toggleExpanded();
                }}
              >
                {row.getIsExpanded() ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                {content}
                {childCount > 1 && (
                  <span className="text-[10px] text-muted-foreground ml-1">({childCount})</span>
                )}
              </span>
            );
          }

          return (
            <span className={`${col.numeric ? "text-right tabular-nums block" : ""} ${indent}`}>
              {content}
            </span>
          );
        },
      });
    });

    return defs;
  }, [mode, selectable, selected, onToggle]);

  const table = useReactTable({
    data: rawRows,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSubRows: (row) =>
      mode === "produit" && Array.isArray(row.children) && (row.children as Row[]).length > 1
        ? (row.children as Row[])
        : undefined,
    getRowId: (_row, idx, parent) => (parent ? `${parent.id}.${idx}` : String(idx)),
  });

  return (
    <DataTable
      table={table}
      isLoading={loading}
      pagination={{
        currentPage: pagination.pageIndex + 1,
        setCurrentPage: (p) => setPagination((s) => ({ ...s, pageIndex: p - 1 })),
        pageCount: table.getPageCount(),
        pageSize: pagination.pageSize,
        setPageSize: (s) => setPagination({ pageIndex: 0, pageSize: s }),
        total: rawRows.length,
      }}
      emptyState={<p className="text-sm text-muted-foreground text-center py-4">Aucune donnée</p>}
    />
  );
}
