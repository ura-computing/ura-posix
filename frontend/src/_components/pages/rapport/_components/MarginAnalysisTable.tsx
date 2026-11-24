import { useState } from "react";
import { TabBar } from "@/_components/molecules/TabBar";
import type { MargeMode } from "@/types";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { DataTable } from "@/_components/organisms/DataTable";
import type { ColumnDef } from "@/_components/organisms/DataTable";
import { formatQty, formatMAD, formatPct } from "@/utils/format";

/** Section 2e — Analyse de marge. Tabs switch the backend `mode` query param;
 *  each mode returns a different wide-row dict shape, so the column list is
 *  selected per tab. Built on the shared DataTable. */

const buildTabs = (t: TFn): { id: MargeMode; label: string }[] => [
  { id: "produit", label: t("rapportAdmin.tabParProduit") },
  { id: "categorie", label: t("rapportAdmin.tabParCategorie") },
  { id: "grossiste", label: t("rapportAdmin.tabParGrossiste") },
];

// Per-mode column projection — extracts a subset of the wide-row dict's
// fields. Cells render via the row's positional accessor; numeric cells use
// font-mono + tabular-nums via DataTable's `align: "right"` styling.

type Row = Record<string, unknown>;

/** Wide-row cell → number, or null (shown « — »). */
const cell = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function columnsFor(mode: MargeMode, t: TFn): ColumnDef<Row>[] {
  if (mode === "produit") {
    return [
      {
        key: "product",
        label: t("col.produit"),
        sortable: false,
        render: (r) => <span className="font-semibold text-foreground">{String(r["product"] ?? "—")}</span>,
      },
      {
        key: "category",
        label: t("col.categorie"),
        sortable: false,
        render: (r) => <span className="text-muted-foreground">{String(r["category"] ?? "—")}</span>,
      },
      { key: "qty", label: t("col.qte"), sortable: false, align: "right", render: (r) => formatQty(cell(r["qty"])) },
      {
        key: "ventes",
        label: t("rapportAdmin.ventesMad"),
        sortable: false,
        align: "right",
        render: (r) => formatMAD(cell(r["ca"])),
      },
      { key: "ppv", label: t("col.ppv"), sortable: false, align: "right", render: (r) => formatMAD(cell(r["ppv"])) },
      {
        key: "marge_pct",
        label: t("col.margePct"),
        sortable: false,
        align: "right",
        render: (r) => formatPct(cell(r["marge_pct"])),
      },
      {
        key: "marge_dh",
        label: t("col.margeDh"),
        sortable: false,
        align: "right",
        render: (r) => formatMAD(cell(r["marge_dh"])),
      },
      {
        key: "tva",
        label: t("col.tva"),
        sortable: false,
        render: (r) => <span className="text-muted-foreground">{String(r["tva"] ?? "—")}</span>,
      },
    ];
  }
  if (mode === "categorie") {
    return [
      {
        key: "category",
        label: t("col.categorie"),
        sortable: false,
        render: (r) => <span className="font-semibold text-foreground">{String(r["category"] ?? "—")}</span>,
      },
      { key: "qty", label: t("col.qte"), sortable: false, align: "right", render: (r) => formatQty(cell(r["qty"])) },
      {
        key: "ventes",
        label: t("rapportAdmin.caMad"),
        sortable: false,
        align: "right",
        render: (r) => formatMAD(cell(r["ca"])),
      },
      {
        key: "marge_pct",
        label: t("rapportAdmin.margePctMoy"),
        sortable: false,
        align: "right",
        render: (r) => formatPct(cell(r["marge_pct_avg"])),
      },
      {
        key: "marge_dh",
        label: t("rapportAdmin.margeDhMoy"),
        sortable: false,
        align: "right",
        render: (r) => formatMAD(cell(r["marge_dh_avg"])),
      },
    ];
  }
  // grossiste
  return [
    {
      key: "grossiste",
      label: t("col.grossiste"),
      sortable: false,
      render: (r) => <span className="font-semibold text-foreground">{String(r["grossiste"] ?? "—")}</span>,
    },
    { key: "qty", label: t("col.qte"), sortable: false, align: "right", render: (r) => formatQty(cell(r["qty"])) },
    {
      key: "ventes",
      label: t("rapportAdmin.caMad"),
      sortable: false,
      align: "right",
      render: (r) => formatMAD(cell(r["ca"])),
    },
    {
      key: "marge_pct",
      label: t("rapportAdmin.margePctMoy"),
      sortable: false,
      align: "right",
      render: (r) => formatPct(cell(r["marge_pct_avg"])),
    },
    {
      key: "marge_dh",
      label: t("rapportAdmin.margeDhMoy"),
      sortable: false,
      align: "right",
      render: (r) => formatMAD(cell(r["marge_dh_avg"])),
    },
  ];
}

interface MarginAnalysisTableProps {
  mode: MargeMode;
  onModeChange: (mode: MargeMode) => void;
  rows: Row[];
  isLoading?: boolean;
}

export function MarginAnalysisTable({ mode, onModeChange, rows, isLoading }: MarginAnalysisTableProps) {
  const t = useT();
  const columns = columnsFor(mode, t);
  const tabs = buildTabs(t);
  // Every row is loaded; show them page by page (same as /analyses). The page is kept with
  // the (tab, rows) it was picked for: another tab, pharmacy or period shows page 1 again.
  const pageFor = `${mode}|${rows.length}`;
  const [picked, setPicked] = useState({ pageFor, page: 1 });
  const page = picked.pageFor === pageFor ? picked.page : 1;
  const [pageSize, setPageSize] = useState(25);
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="flex flex-col gap-3.5">
      <h2 className="text-base font-bold tracking-tight text-foreground">{t("rapportAdmin.analyseMarge")}</h2>
      <TabBar<MargeMode> tabs={tabs} activeId={mode} onChange={onModeChange} />
      <DataTable
        rows={pageRows}
        columns={columns}
        isLoading={isLoading}
        rowKey={(_r, i) => (page - 1) * pageSize + i}
        emptyTitle={t("rapportAdmin.aucuneLigne")}
        emptyHint={t("rapportAdmin.aucuneDonneeRegroupement")}
        scrollOnPage="table"
        pagination={{
          page,
          pageSize,
          total: rows.length,
          onPage: (next) => setPicked({ pageFor, page: next }),
          onPageSize: setPageSize,
        }}
      />
    </div>
  );
}
