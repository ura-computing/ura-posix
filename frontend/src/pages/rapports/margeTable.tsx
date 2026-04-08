import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { AnalyseMargeResponse } from "@/api/stats";
import { DataTablePagination } from "@/components/DataTable/dataTablePagination";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MargeMode = "produit" | "categorie" | "fournisseur" | "bl" | "laboratoire" | "operateur" | "mois";
type SortState = { key: string; dir: "asc" | "desc" };

export const SIM_LABEL_KEY: Record<MargeMode, string> = {
  produit: "product", categorie: "category", fournisseur: "supplier", bl: "delivery_ref",
  laboratoire: "laboratoire", operateur: "client", mois: "mois",
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
  fournisseur: [
    { key: "supplier",  label: "Fournisseur" },
    { key: "prix_max",  label: "Prix max", numeric: true },
    { key: "prix_min",  label: "Prix min", numeric: true },
    { key: "prix_avg",  label: "Prix moy.", numeric: true },
    { key: "qty",       label: "Qté", numeric: true },
    { key: "ca",        label: "CA (MAD)", numeric: true },
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
    { key: "laboratoire", label: "Laboratoire" },
    { key: "prix_max",    label: "Prix max", numeric: true },
    { key: "prix_min",    label: "Prix min", numeric: true },
    { key: "prix_avg",    label: "Prix moy.", numeric: true },
    { key: "qty",         label: "Qté", numeric: true },
    { key: "ca",          label: "CA (MAD)", numeric: true },
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
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AnalyseMargeTable({ mode, data, loading, selectable, selected, onToggle }: {
  mode: MargeMode;
  data: AnalyseMargeResponse | undefined;
  loading: boolean;
  selectable?: boolean;
  selected?: Set<number>;
  onToggle?: (globalIndex: number) => void;
}) {
  const [sort, setSort] = useState<SortState>({ key: "", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const cols = MARGE_COLS[mode];
  const rawRows = (data?.rows ?? []) as Record<string, unknown>[];

  const sorted = useMemo(() => {
    if (!sort.key) return rawRows;
    return [...rawRows].sort((a, b) => {
      const av = a[sort.key] ?? "";
      const bv = b[sort.key] ?? "";
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rawRows, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const rows = sorted.slice((page - 1) * pageSize, page * pageSize);

  const toggle = (key: string) => {
    setPage(1);
    setSort((s) => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  };

  if (loading) return <Skeleton className="h-48 w-full" />;
  if (!sorted.length) return (
    <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">Aucune donnée</div>
  );

  const fmtCell = (v: unknown) => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
    return String(v);
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {selectable && <th className="w-8 px-2 py-2.5" />}
              {cols.map((col) => (
                <th
                  key={col.key}
                  className={`px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground cursor-pointer select-none whitespace-nowrap hover:text-foreground ${col.numeric ? "text-right" : ""}`}
                  onClick={() => toggle(col.key)}
                >
                  {col.label}
                  {sort.key === col.key ? (sort.dir === "asc" ? " ↑" : " ↓") : " ↕"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const globalIdx = (page - 1) * pageSize + i;
              const isSelected = selectable && selected?.has(globalIdx);
              const children = (row.children as Record<string, unknown>[] | undefined);
              const hasChildren = mode === "produit" && children && children.length > 1;
              const isExpanded = expanded.has(globalIdx);
              return (<>
              <tr
                key={i}
                className={`border-b border-border last:border-0 hover:bg-muted/30 ${isSelected ? "bg-primary/5" : ""} ${selectable || hasChildren ? "cursor-pointer" : ""}`}
                onClick={hasChildren ? () => setExpanded((prev) => { const next = new Set(prev); next.has(globalIdx) ? next.delete(globalIdx) : next.add(globalIdx); return next; }) : selectable && onToggle ? () => onToggle(globalIdx) : undefined}
              >
                {selectable && (
                  <td className="w-8 px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={!!isSelected}
                      onChange={() => onToggle?.(globalIdx)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-3.5 w-3.5 rounded border-border"
                    />
                  </td>
                )}
                {cols.map((col, ci) => (
                  <td key={col.key} className={`px-3 py-2 text-[12px] ${col.numeric ? "text-right tabular-nums" : ""}`}>
                    {ci === 0 && hasChildren ? (
                      <span className="inline-flex items-center gap-1">
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        {fmtCell(row[col.key])}
                        <span className="text-[10px] text-muted-foreground ml-1">({children!.length})</span>
                      </span>
                    ) : fmtCell(row[col.key])}
                  </td>
                ))}
              </tr>
              {hasChildren && isExpanded && children!.map((child, ci) => (
                <tr key={`${i}-child-${ci}`} className="border-b border-border last:border-0 bg-muted/20">
                  {selectable && <td className="w-8" />}
                  {cols.map((col, colIdx) => (
                    <td key={col.key} className={`px-3 py-1.5 text-[11px] text-muted-foreground ${col.numeric ? "text-right tabular-nums" : ""}`}>
                      {colIdx === 0 ? <span className="pl-5">{fmtCell(child[col.key])}</span> : fmtCell(child[col.key])}
                    </td>
                  ))}
                </tr>
              ))}
              </>);
            })}
          </tbody>
        </table>
      </div>
      <DataTablePagination
        currentPage={page}
        pageCount={pageCount}
        setCurrentPage={setPage}
        pageSize={pageSize}
        setPageSize={(s) => { setPageSize(s); setPage(1); }}
        total={sorted.length}
      />
    </div>
  );
}
