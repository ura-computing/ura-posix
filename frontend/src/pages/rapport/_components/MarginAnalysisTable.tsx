/** Section 2e — Analyse de marge. Tabs switch the backend `mode` query param;
 *  each mode returns a different wide-row dict shape, so the column list is
 *  selected per tab. Built on the shared DataTable. */
import { DataTable } from "@/components/shared/DataTable";
import { useT, type TFn } from "@/i18n/I18nProvider";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { MargeMode } from "@/types";


const buildTabs = (t: TFn): { id: MargeMode; label: string }[] => [
  { id: "produit",   label: t("rapportAdmin.tabParProduit") },
  { id: "categorie", label: t("rapportAdmin.tabParCategorie") },
  { id: "grossiste", label: t("rapportAdmin.tabParGrossiste") },
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
  return v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " %";
}


function columnsFor(mode: MargeMode, t: TFn): ColumnDef<Row>[] {
  if (mode === "produit") {
    return [
      { key: "product",   label: t("col.produit"),                 sortable: false, render: (r) => <span className="font-semibold text-foreground">{String(r["product"] ?? "—")}</span> },
      { key: "category",  label: t("col.categorie"),               sortable: false, render: (r) => <span className="text-muted-foreground">{String(r["category"] ?? "—")}</span> },
      { key: "qty",       label: t("col.qte"),                     sortable: false, align: "right", render: (r) => num(r["qty"], 2) },
      { key: "ventes",    label: t("rapportAdmin.ventesMad"),      sortable: false, align: "right", render: (r) => mad(r["ventes_total"]) },
      { key: "ppv",       label: t("col.ppv"),                     sortable: false, align: "right", render: (r) => mad(r["prix_avg"]) },
      { key: "marge_pct", label: t("col.margePct"),                sortable: false, align: "right", render: (r) => pct(r["marge_pct"]) },
      { key: "marge_dh",  label: t("col.margeDh"),                 sortable: false, align: "right", render: (r) => mad(r["marge_dh"]) },
      { key: "tva",       label: t("col.tva"),                     sortable: false, render: (r) => <span className="text-muted-foreground">{String(r["tva"] ?? "—")}</span> },
    ];
  }
  if (mode === "categorie") {
    return [
      { key: "category",  label: t("col.categorie"),               sortable: false, render: (r) => <span className="font-semibold text-foreground">{String(r["category"] ?? "—")}</span> },
      { key: "qty",       label: t("col.qte"),                     sortable: false, align: "right", render: (r) => num(r["qty"], 2) },
      { key: "ventes",    label: t("rapportAdmin.caMad"),          sortable: false, align: "right", render: (r) => mad(r["ventes_total"]) },
      { key: "marge_pct", label: t("rapportAdmin.margePctMoy"),    sortable: false, align: "right", render: (r) => pct(r["marge_pct"]) },
      { key: "marge_dh",  label: t("rapportAdmin.margeDhMoy"),     sortable: false, align: "right", render: (r) => mad(r["marge_dh"]) },
    ];
  }
  // grossiste
  return [
    { key: "supplier",  label: t("col.grossiste"),               sortable: false, render: (r) => <span className="font-semibold text-foreground">{String(r["supplier"] ?? "—")}</span> },
    { key: "qty",       label: t("col.qte"),                     sortable: false, align: "right", render: (r) => num(r["qty"], 2) },
    { key: "ventes",    label: t("rapportAdmin.caMad"),          sortable: false, align: "right", render: (r) => mad(r["ventes_total"]) },
    { key: "marge_pct", label: t("rapportAdmin.margePctMoy"),    sortable: false, align: "right", render: (r) => pct(r["marge_pct"]) },
    { key: "marge_dh",  label: t("rapportAdmin.margeDhMoy"),     sortable: false, align: "right", render: (r) => mad(r["marge_dh"]) },
  ];
}


export interface MarginAnalysisTableProps {
  mode:         MargeMode;
  onModeChange: (mode: MargeMode) => void;
  rows:         Row[];
  isLoading?:   boolean;
}


export function MarginAnalysisTable({ mode, onModeChange, rows, isLoading }: MarginAnalysisTableProps) {
  const t = useT();
  const columns = columnsFor(mode, t);
  const tabs = buildTabs(t);

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold tracking-tight text-foreground">{t("rapportAdmin.analyseMarge")}</h2>
        <div className="inline-flex gap-0.5 rounded-xl border border-border bg-surface-subtle p-0.5">
          {tabs.map((tab) => {
            const active = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onModeChange(tab.id)}
                className={`cursor-pointer rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition ${
                  active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
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
        emptyTitle={t("rapportAdmin.aucuneLigne")}
        emptyHint={t("rapportAdmin.aucuneDonneeRegroupement")}
      />
    </div>
  );
}
