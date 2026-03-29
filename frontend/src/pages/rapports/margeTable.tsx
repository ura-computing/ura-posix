import { useState, useMemo } from "react";
import type { AnalyseMargeResponse } from "@/api/stats";
import { DataTablePagination } from "@/components/data-table/dataTablePagination";
import { Skeleton } from "@/components/ui/skeleton";

// ── Types ─────────────────────────────────────────────────────────────────────

export type MargeMode = "produit" | "categorie" | "fournisseur" | "bl";
type SortState = { key: string; dir: "asc" | "desc" };

export const SIM_LABEL_KEY: Record<MargeMode, string> = {
  produit: "product", categorie: "category", fournisseur: "supplier", bl: "delivery_ref",
};

export const MARGE_COLS: Record<MargeMode, { key: string; label: string; numeric?: boolean }[]> = {
  produit:     [
    { key: "product",   label: "Produit" },
    { key: "category",  label: "Catégorie" },
    { key: "tva",       label: "TVA" },
    { key: "ppv",       label: "PPV", numeric: true },
    { key: "prix_max",  label: "Prix max", numeric: true },
    { key: "prix_min",  label: "Prix min", numeric: true },
    { key: "prix_avg",  label: "Prix moy.", numeric: true },
    { key: "marge_pct", label: "Marge %", numeric: true },
    { key: "marge_dh",  label: "Marge DH", numeric: true },
    { key: "qty",       label: "Qté", numeric: true },
    { key: "ca",        label: "CA (MAD)", numeric: true },
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
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AnalyseMargeTable({ mode, data, loading }: {
  mode: MargeMode;
  data: AnalyseMargeResponse | undefined;
  loading: boolean;
}) {
  const [sort, setSort] = useState<SortState>({ key: "", dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30">
                {cols.map((col) => (
                  <td key={col.key} className={`px-3 py-2 text-[12px] ${col.numeric ? "text-right tabular-nums" : ""}`}>
                    {fmtCell(row[col.key])}
                  </td>
                ))}
              </tr>
            ))}
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
