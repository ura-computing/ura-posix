/** Section 2e — Analyse de marge. Tabs switch the backend `mode` query param;
 *  each mode returns a different wide-row dict shape, so the column list is
 *  selected per tab. Built on the shared DataTable. */
import { DataTable } from "@/components/shared/DataTable";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { MargeMode } from "@/types";


const TABS: { id: MargeMode; label: string }[] = [
  { id: "produit",   label: "Par produit" },
  { id: "categorie", label: "Par catégorie" },
  { id: "grossiste", label: "Par grossiste" },
];


// Per-mode column projection — extracts a subset of the wide-row dict's
// fields. Cells render via the row's positional accessor; numeric cells use
// font-mono + tabular-nums via DataTable's `align: "right"` styling.

type Row = Record<string, unknown>;

function num(v: unknown, decimals = 0): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return v.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function mad(v: unknown): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MAD";
}
function pct(v: unknown): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return v.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " %";
}


function columnsFor(mode: MargeMode): ColumnDef<Row>[] {
  if (mode === "produit") {
    return [
      { key: "product",   label: "Produit",        sortable: false, render: (r) => <span className="font-semibold text-foreground">{String(r["product"] ?? "—")}</span> },
      { key: "category",  label: "Catégorie",      sortable: false, render: (r) => <span className="text-muted-foreground">{String(r["category"] ?? "—")}</span> },
      { key: "qty",       label: "Qté",            sortable: false, align: "right", render: (r) => num(r["qty"], 2) },
      { key: "ventes",    label: "Ventes (MAD)",   sortable: false, align: "right", render: (r) => mad(r["ventes_total"]) },
      { key: "ppv",       label: "PPV",            sortable: false, align: "right", render: (r) => mad(r["prix_avg"]) },
      { key: "marge_pct", label: "Marge %",        sortable: false, align: "right", render: (r) => pct(r["marge_pct"]) },
      { key: "marge_dh",  label: "Marge DH",       sortable: false, align: "right", render: (r) => mad(r["marge_dh"]) },
      { key: "tva",       label: "TVA",            sortable: false, render: (r) => <span className="text-muted-foreground">{String(r["tva"] ?? "—")}</span> },
    ];
  }
  if (mode === "categorie") {
    return [
      { key: "category",  label: "Catégorie",      sortable: false, render: (r) => <span className="font-semibold text-foreground">{String(r["category"] ?? "—")}</span> },
      { key: "qty",       label: "Qté",            sortable: false, align: "right", render: (r) => num(r["qty"], 2) },
      { key: "ventes",    label: "CA (MAD)",       sortable: false, align: "right", render: (r) => mad(r["ventes_total"]) },
      { key: "marge_pct", label: "Marge % moy.",   sortable: false, align: "right", render: (r) => pct(r["marge_pct"]) },
      { key: "marge_dh",  label: "Marge DH moy.",  sortable: false, align: "right", render: (r) => mad(r["marge_dh"]) },
    ];
  }
  // grossiste
  return [
    { key: "supplier",  label: "Grossiste",      sortable: false, render: (r) => <span className="font-semibold text-foreground">{String(r["supplier"] ?? "—")}</span> },
    { key: "qty",       label: "Qté",            sortable: false, align: "right", render: (r) => num(r["qty"], 2) },
    { key: "ventes",    label: "CA (MAD)",       sortable: false, align: "right", render: (r) => mad(r["ventes_total"]) },
    { key: "marge_pct", label: "Marge % moy.",   sortable: false, align: "right", render: (r) => pct(r["marge_pct"]) },
    { key: "marge_dh",  label: "Marge DH moy.",  sortable: false, align: "right", render: (r) => mad(r["marge_dh"]) },
  ];
}


export interface MarginAnalysisTableProps {
  mode:         MargeMode;
  onModeChange: (mode: MargeMode) => void;
  rows:         Row[];
  isLoading?:   boolean;
}


export function MarginAnalysisTable({ mode, onModeChange, rows, isLoading }: MarginAnalysisTableProps) {
  const columns = columnsFor(mode);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold tracking-tight text-foreground">Analyse de marge</h2>
        <div className="inline-flex gap-0.5 rounded-xl border border-border bg-surface-subtle p-0.5">
          {TABS.map((t) => {
            const active = mode === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onModeChange(t.id)}
                className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition ${
                  active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        isLoading={isLoading}
        rowKey={(_r, i) => i}
        emptyTitle="Aucune ligne"
        emptyHint="Aucune donnée pour ce regroupement sur la période sélectionnée."
      />
    </div>
  );
}
