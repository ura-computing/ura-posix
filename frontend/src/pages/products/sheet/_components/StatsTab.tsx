/** « Statistiques »: the period's figures vs the days just before (same number), the last 12
 *  months (3 charts + « Détail mensuel », copied for Excel), « Tendances » over the period,
 *  « Top fournisseurs » of the period and each supplier's latest purchase price. */
import { BarChart3, FileText, LineChart, Receipt, TrendingUp, Truck } from "lucide-react";

import { DataTable, type ColumnDef } from "@/_components/DataTable";
import { KpiTile } from "@/_components/KpiTile";
import type { MonthFigures, ProductStats, SupplierShare } from "@/types";
import { useMonths } from "@/i18n/dates";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { formatDate, formatMAD, formatNumStr, formatPct, formatQty, pctChange } from "@/utils/format";

import type { StatsRange } from "../hooks";
import { CopyButton } from "./CopyButton";
import { SheetCard } from "./SheetCard";
import { ChartLegend, MonthsChart, TrendLine, type ChartSeries } from "./StatsCharts";

const SALES = "var(--chart-1)";
const PURCHASES = "var(--chart-2)";
const dash = <span className="text-muted-foreground">—</span>;
const mad = (n: number | null) => (n != null ? <span className="whitespace-nowrap">{formatMAD(n)}</span> : dash);
const money = (n: number | null) => (n != null ? formatNumStr(n, 2) : dash);
/** A copied number for Excel: French style, no thousands space (« 1234,50 »). */
const cell = (n: number | null, decimals: 0 | 2) => (n == null ? "" : formatNumStr(n, decimals).replace(/\s/g, ""));

// No fixed widths: the columns fit the page (no sideways scroll on a laptop screen).
const monthColumns = (t: TFn, monthName: (m: string) => string): ColumnDef<MonthFigures>[] => [
  { key: "month", label: t("col.mois"), sortable: false, render: (r) => monthName(r.month) },
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

type LastPrice = ProductStats["last_prices"][number];
const priceColumns = (t: TFn): ColumnDef<LastPrice>[] => [
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
];

export function StatsTab({ stats, range }: { stats: ProductStats | null; range: StatsRange }) {
  const t = useT();
  const months = useMonths();
  if (!range.from || !range.to) {
    return <p className="py-10 text-center text-base text-muted-foreground">{t("products.pickDates")}</p>;
  }
  if (!stats) return <p className="py-10 text-center text-sm text-muted-foreground">{t("common.loading")}</p>;

  const { period: now, previous: before, monthly } = stats;
  const change = (a: number | null, b: number | null) => {
    const c = a == null || b == null ? null : pctChange(a, b);
    return c == null ? null : { value: c };
  };
  const units = (n: number) => (
    <>
      {formatQty(n)} {t("common.wUnites")}
    </>
  );
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
  const trendTitle = (start: string) =>
    stats.trend_unit === "month" ? monthName(start.slice(0, 7)) : formatDate(start);
  const suppliers = [
    ...stats.top_suppliers,
    ...(stats.other_suppliers ? [{ ...stats.other_suppliers, supplier: t("products.others") }] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t("products.periodHint", {
          from: formatDate(stats.date_from),
          to: formatDate(stats.date_to),
          pfrom: formatDate(stats.previous_from),
          pto: formatDate(stats.previous_to),
        })}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiTile label={t("products.qtySold")} value={units(now.sold)} delta={change(now.sold, before.sold)} />
        <KpiTile label={t("products.qtyBought")} value={units(now.bought)} delta={change(now.bought, before.bought)} />
        <KpiTile label={t("products.ca")} value={formatMAD(now.ca)} delta={change(now.ca, before.ca)} />
        <KpiTile
          label={t("products.margeGeneree")}
          value={now.marge != null ? formatMAD(now.marge) : "—"}
          delta={change(now.marge, before.marge)}
        />
        <KpiTile
          label={t("products.transactions")}
          value={formatQty(now.transactions)}
          delta={change(now.transactions, before.transactions)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SheetCard title={t("products.salesByMonth")} icon={<BarChart3 className="size-5" />}>
          <MonthsChart months={monthKeys} series={[sold]} kind="bars" label={t("products.salesByMonth")} />
        </SheetCard>
        <SheetCard title={t("products.purchasesByMonth")} icon={<BarChart3 className="size-5" />}>
          <MonthsChart months={monthKeys} series={[bought]} kind="bars" label={t("products.purchasesByMonth")} />
        </SheetCard>
        <SheetCard
          title={t("products.salesVsPurchases")}
          icon={<LineChart className="size-5" />}
          actions={<ChartLegend series={[sold, bought]} />}
        >
          <MonthsChart months={monthKeys} series={[sold, bought]} kind="lines" label={t("products.salesVsPurchases")} />
        </SheetCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SheetCard
          title={t("products.monthlyDetail")}
          icon={<FileText className="size-5" />}
          actions={<CopyButton value={tsv} label={t("products.copyTable")} copiedText={t("products.tableCopied")} />}
        >
          <DataTable<MonthFigures> rows={monthly} columns={monthColumns(t, monthName)} rowKey={(r) => r.month} />
        </SheetCard>

        <div className="flex flex-col gap-4">
          <SheetCard title={t("products.trends")} icon={<TrendingUp className="size-5" />}>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["sold", t("products.salesTrend"), SALES, change(now.sold, before.sold)],
                  ["bought", t("products.purchasesTrend"), PURCHASES, change(now.bought, before.bought)],
                ] as const
              ).map(([key, label, color, delta]) => (
                <KpiTile key={key} label={label} delta={delta}>
                  <TrendLine
                    values={stats.trend.map((p) => p[key])}
                    titles={stats.trend.map((p) => `${trendTitle(p.start)} : ${formatNumStr(p[key])}`)}
                    color={color}
                    label={label}
                  />
                </KpiTile>
              ))}
            </div>
          </SheetCard>

          <div className="grid gap-4 min-[1800px]:grid-cols-2">
            <SheetCard title={t("products.topSuppliers")} icon={<Truck className="size-5" />}>
              <DataTable<SupplierShare>
                rows={suppliers}
                columns={supplierColumns(t)}
                emptyTitle={t("products.noPurchase")}
                rowKey={(_, i) => i}
              />
            </SheetCard>
            <SheetCard title={t("products.lastPrices")} icon={<Receipt className="size-5" />}>
              <DataTable<LastPrice>
                rows={stats.last_prices}
                columns={priceColumns(t)}
                emptyTitle={t("products.noPricedPurchase")}
                rowKey={(_, i) => i}
              />
            </SheetCard>
          </div>
        </div>
      </div>
    </div>
  );
}
