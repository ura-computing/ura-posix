/** « Statistiques », all following the page dates: the period's figures vs the period just before
 *  (whole months: as many months, else as many days); 3 charts + « Détail mensuel » (copied for
 *  Excel) over the period's months (at least 12: a short period → the 12 months ending with it);
 *  « Historique (par année) » (sales light green, purchases light blue; « Tous · Ventes · Achats »);
 *  « Top fournisseurs » of the period and each supplier's latest purchase price (« Voir tout » = the
 *  whole list in a window). */
import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { CategorySegment } from "@/_components/CategorySegment";
import { DataTable, type ColumnDef } from "@/_components/DataTable";
import { KpiTile } from "@/_components/KpiTile";
import type { MonthFigures, ProductStats, SupplierPrice, SupplierShare } from "@/types";
import { useMonths, useMonthsShort } from "@/i18n/dates";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { formatDate, formatMAD, formatMoney, formatNumStr, formatPct, formatQty, pctChange } from "@/utils/format";

import type { StatsRange } from "../hooks";
import { CopyButton } from "./CopyButton";
import { SeeAllDialog } from "./SeeAllDialog";
import { SheetCard, TileNumber } from "./SheetCard";
import { ChartLegend, MonthsChart, type ChartSeries } from "./StatsCharts";
import { historyLines, kindLabel, LINE_TONE, yearColumns, type HistoryFilter, type HistoryLine } from "./yearHistory";

const SALES = "var(--chart-1)";
const PURCHASES = "var(--chart-2)";
const dash = <span className="text-muted-foreground">—</span>;
const mad = (n: number | null) => (n != null ? <span className="whitespace-nowrap">{formatMAD(n)}</span> : dash);
const money = (n: number | null) => (n != null ? formatNumStr(n, 2) : dash);
/** A copied number for Excel: French style, no thousands space (« 1234,50 »). */
const cell = (n: number | null, decimals: 0 | 2) => (n == null ? "" : formatNumStr(n, decimals).replace(/\s/g, ""));

// No fixed widths: the columns fit the page (no sideways scroll on a laptop screen).
const monthColumns = (t: TFn, monthName: (m: string) => string): ColumnDef<MonthFigures>[] => [
  {
    key: "month",
    label: t("col.mois"),
    sortable: false,
    render: (r) => <span className="whitespace-nowrap">{monthName(r.month)}</span>,
  },
  {
    key: "sold",
    label: t("products.colSoldUnits"),
    align: "right",
    sortable: false,
    render: (r) => formatQty(r.sold),
  },
  {
    key: "bought",
    label: t("products.colBoughtUnits"),
    align: "right",
    sortable: false,
    render: (r) => formatQty(r.bought),
  },
  // « CA (MAD) », « Marge (MAD) »: the header says MAD, the cells only the number (narrower).
  { key: "ca", label: t("products.colCaMad"), align: "right", sortable: false, render: (r) => money(r.ca) },
  {
    key: "marge",
    label: t("products.colMargeMad"),
    align: "right",
    sortable: false,
    render: (r) => money(r.marge),
  },
];

const supplierColumns = (t: TFn): ColumnDef<SupplierShare>[] => [
  {
    key: "supplier",
    label: t("col.fournisseur"),
    sortable: false,
    render: (r) => r.supplier ?? <span className="text-muted-foreground">{t("products.noSupplier")}</span>,
  },
  {
    key: "quantity",
    label: t("products.colQty"),
    width: 70,
    align: "right",
    sortable: false,
    render: (r) => formatQty(r.quantity),
  },
  {
    key: "pct",
    label: t("products.colPctTotal"),
    width: 80,
    align: "right",
    sortable: false,
    render: (r) => (r.pct != null ? formatPct(r.pct) : dash),
  },
];

/** The window adds the date of each price. */
const priceColumns = (t: TFn, withDate = false): ColumnDef<SupplierPrice>[] => [
  {
    key: "supplier",
    label: t("col.fournisseur"),
    sortable: false,
    render: (r) => r.supplier ?? <span className="text-muted-foreground">{t("products.noSupplier")}</span>,
  },
  {
    key: "unit_price",
    label: t("products.colPu"),
    width: 110,
    align: "right",
    sortable: false,
    render: (r) => mad(r.unit_price),
  },
  ...(withDate
    ? [
        {
          key: "date",
          label: t("col.date"),
          width: 110,
          sortable: false,
          render: (r: SupplierPrice) => (r.date ? formatDate(r.date) : dash),
        },
      ]
    : []),
];

const LAST_PRICES_SHOWN = 5;

/** « Voir tout (N) » of a card (shown disabled when there is nothing). */
function SeeAllButton({ n, onClick }: { n: number; onClick: () => void }) {
  const t = useT();
  return (
    <Button variant="secondary" size="sm" onClick={onClick} disabled={n === 0}>
      {t("products.seeAllN", { n })}
      <ArrowRight className="size-3.5" />
    </Button>
  );
}

export function StatsTab({ stats, range }: { stats: ProductStats | null; range: StatsRange }) {
  const t = useT();
  const months = useMonths();
  const monthsShort = useMonthsShort();
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [seeAll, setSeeAll] = useState<"suppliers" | "prices" | null>(null);
  if (!range.from || !range.to) {
    return <p className="py-10 text-center text-base text-muted-foreground">{t("products.pickDates")}</p>;
  }
  if (!stats) return <p className="py-10 text-center text-sm text-muted-foreground">{t("common.loading")}</p>;

  const { period: now, previous: before, monthly } = stats;
  const change = (a: number | null, b: number | null) => {
    const c = a == null || b == null ? null : pctChange(a, b);
    return c == null ? null : { value: c };
  };
  const units = (n: number) => <TileNumber value={formatQty(n)} unit={t("common.wUnites")} />;
  const madTile = (n: number | null) => (n != null ? <TileNumber value={formatMoney(n)} unit="MAD" /> : "—");
  const monthName = (m: string) => `${months[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
  const sold: ChartSeries = { key: "sold", label: t("nav.ventes"), values: monthly.map((m) => m.sold), color: SALES };
  const bought: ChartSeries = {
    key: "bought",
    label: t("nav.achats"),
    values: monthly.map((m) => m.bought),
    color: PURCHASES,
  };
  const monthKeys = monthly.map((m) => m.month);
  // « Détail mensuel » for Excel: one line per month, tab-separated, French numbers.
  const header = [
    t("col.mois"),
    t("products.colSoldUnits"),
    t("products.colBoughtUnits"),
    t("products.colCaMad"),
    t("products.colMargeMad"),
  ];
  const tsv = [
    header,
    ...monthly.map((m) => [monthName(m.month), cell(m.sold, 0), cell(m.bought, 0), cell(m.ca, 2), cell(m.marge, 2)]),
  ]
    .map((r) => r.join("\t"))
    .join("\n");
  // « Historique (par année) »: the lines of the filter; for Excel, the same columns.
  const historyRows = historyLines(stats.history, historyFilter);
  const historyTsv = [
    [
      t("col.annee"),
      t("col.type"),
      ...monthsShort.map((m) => m.replace(/\.$/, "")),
      t("col.total"),
      t("products.colSpentMad"),
    ],
    ...historyRows.map((l) => [
      String(l.year),
      kindLabel(t, l.kind),
      ...l.units.map((n) => cell(n, 0)),
      cell(l.total, 0),
      cell(l.amount, 2),
    ]),
  ]
    .map((r) => r.join("\t"))
    .join("\n");
  // « Top fournisseurs »: the 3 biggest, then « Autres » = every other one together.
  const boughtInPeriod = stats.suppliers.reduce((sum, s) => sum + s.quantity, 0);
  const rest = stats.suppliers.slice(3).reduce((sum, s) => sum + s.quantity, 0);
  const suppliers: SupplierShare[] = [
    ...stats.suppliers.slice(0, 3),
    ...(stats.suppliers.length > 3
      ? [
          {
            supplier: t("products.others"),
            quantity: rest,
            pct: boughtInPeriod > 0 ? Math.round((rest / boughtInPeriod) * 10_000) / 100 : null,
          },
        ]
      : []),
  ];
  const historyOptions = [
    { value: "all" as const, label: t("products.kindAll"), activeBg: "bg-primary text-primary-foreground shadow-sm" },
    { value: "sales" as const, label: t("nav.ventes"), activeBg: "bg-primary text-primary-foreground shadow-sm" },
    { value: "purchases" as const, label: t("nav.achats"), activeBg: "bg-primary text-primary-foreground shadow-sm" },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* One line: the period, what the % compare with, the months of the charts + « Détail mensuel »
          (the period's months, at least 12). */}
      <p className="text-sm text-muted-foreground">
        <span>
          {t("products.periodHint", {
            from: formatDate(stats.date_from),
            to: formatDate(stats.date_to),
            pfrom: formatDate(stats.previous_from),
            pto: formatDate(stats.previous_to),
          })}
        </span>{" "}
        <span>
          {t("products.monthsRange", {
            from: monthName(monthly[0].month),
            to: monthName(monthly[monthly.length - 1].month),
            n: monthly.length,
          })}
        </span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiTile label={t("products.qtySold")} value={units(now.sold)} delta={change(now.sold, before.sold)} />
        <KpiTile label={t("products.qtyBought")} value={units(now.bought)} delta={change(now.bought, before.bought)} />
        <KpiTile label={t("products.ca")} value={madTile(now.ca)} delta={change(now.ca, before.ca)} />
        <KpiTile
          label={t("products.margeGeneree")}
          value={madTile(now.marge)}
          delta={change(now.marge, before.marge)}
        />
        <KpiTile
          label={t("products.transactions")}
          value={formatQty(now.transactions)}
          delta={change(now.transactions, before.transactions)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SheetCard title={t("products.salesByMonth")}>
          <MonthsChart months={monthKeys} series={[sold]} kind="bars" label={t("products.salesByMonth")} />
        </SheetCard>
        <SheetCard title={t("products.purchasesByMonth")}>
          <MonthsChart months={monthKeys} series={[bought]} kind="bars" label={t("products.purchasesByMonth")} />
        </SheetCard>
        <SheetCard title={t("products.salesVsPurchases")} actions={<ChartLegend series={[sold, bought]} />}>
          <MonthsChart months={monthKeys} series={[sold, bought]} kind="lines" label={t("products.salesVsPurchases")} />
        </SheetCard>
      </div>

      <SheetCard
        title={t("products.yearHistory")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <CategorySegment value={historyFilter} options={historyOptions} onChange={setHistoryFilter} />
            <CopyButton value={historyTsv} label={t("products.copyHistory")} copiedText={t("products.tableCopied")} />
          </div>
        }
      >
        <DataTable<HistoryLine>
          rows={historyRows}
          columns={yearColumns(t, monthsShort)}
          emptyTitle={t(
            historyFilter === "sales"
              ? "products.noSale"
              : historyFilter === "purchases"
                ? "products.noPurchaseEver"
                : "products.noMovement",
          )}
          rowKey={(r) => `${r.year}-${r.kind}`}
          rowClassName={(r) => LINE_TONE[r.kind]}
        />
      </SheetCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SheetCard
          title={t("products.monthlyDetail")}
          actions={<CopyButton value={tsv} label={t("products.copyTable")} copiedText={t("products.tableCopied")} />}
        >
          <DataTable<MonthFigures> rows={monthly} columns={monthColumns(t, monthName)} rowKey={(r) => r.month} />
        </SheetCard>

        <div className="flex flex-col gap-4">
          <SheetCard
            title={t("products.topSuppliers")}
            actions={<SeeAllButton n={stats.suppliers.length} onClick={() => setSeeAll("suppliers")} />}
          >
            <DataTable<SupplierShare>
              rows={suppliers}
              columns={supplierColumns(t)}
              emptyTitle={t("products.noPurchase")}
              rowKey={(_, i) => i}
            />
          </SheetCard>
          <SheetCard
            title={t("products.lastPrices")}
            actions={<SeeAllButton n={stats.last_prices.length} onClick={() => setSeeAll("prices")} />}
          >
            <DataTable<SupplierPrice>
              rows={stats.last_prices.slice(0, LAST_PRICES_SHOWN)}
              columns={priceColumns(t)}
              emptyTitle={t("products.noPricedPurchase")}
              rowKey={(_, i) => i}
            />
          </SheetCard>
        </div>
      </div>

      <SeeAllDialog<SupplierShare>
        open={seeAll === "suppliers"}
        title={t("products.allSuppliers")}
        rows={stats.suppliers}
        columns={supplierColumns(t)}
        onClose={() => setSeeAll(null)}
      />
      <SeeAllDialog<SupplierPrice>
        open={seeAll === "prices"}
        title={t("products.allLastPrices")}
        rows={stats.last_prices}
        columns={priceColumns(t, true)}
        onClose={() => setSeeAll(null)}
      />
    </div>
  );
}
