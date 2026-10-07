/** « Statistiques »: key figures (same 12 months as the Stock page), other figures, and
 *  sales / purchases per year. Marge, stock and coverage = the sheet's (same numbers). */
import { BarChart3, Boxes, CalendarDays, Coins, Percent, TrendingUp } from "lucide-react";

import { DataTable, type ColumnDef } from "@/_components/DataTable";
import { KpiTile } from "@/_components/KpiTile";
import type { ProductSheet, ProductStats, YearSummary } from "@/types";
import { useMonths } from "@/i18n/dates";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { formatDate, formatMAD, formatPct, formatQty, formatQtyDec } from "@/utils/format";

import { FieldList, SheetCard } from "./SheetCard";

const dash = <span className="text-muted-foreground">—</span>;

const yearColumns = (t: TFn): ColumnDef<YearSummary>[] => [
  { key: "year", label: t("col.annee"), width: 90, sortable: false, render: (r) => r.year },
  {
    key: "units_sold",
    label: t("products.colUnitsSold"),
    width: 130,
    align: "right",
    sortable: false,
    render: (r) => formatQty(r.units_sold),
  },
  {
    key: "ca",
    label: t("products.colCa"),
    width: 150,
    align: "right",
    sortable: false,
    render: (r) => <span className="whitespace-nowrap">{formatMAD(r.ca)}</span>,
  },
  {
    key: "units_bought",
    label: t("products.colUnitsBought"),
    width: 130,
    align: "right",
    sortable: false,
    render: (r) => formatQty(r.units_bought),
  },
  {
    key: "amount_bought",
    label: t("products.colAmountBought"),
    width: 150,
    align: "right",
    sortable: false,
    render: (r) => <span className="whitespace-nowrap">{formatMAD(r.amount_bought)}</span>,
  },
];

export function StatsTab({ sheet, stats }: { sheet: ProductSheet; stats: ProductStats | null }) {
  const t = useT();
  const months = useMonths();
  if (!stats) return <p className="py-10 text-center text-sm text-muted-foreground">{t("common.loading")}</p>;

  const period = t("products.windowSub", { from: formatDate(stats.sales_from), to: formatDate(stats.sales_to) });
  const best = stats.best_month;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiTile
          label={t("products.units30d")}
          value={formatQty(stats.units_30d)}
          icon={<CalendarDays className="size-5" />}
        />
        <KpiTile
          label={t("products.units12m")}
          value={formatQty(stats.units_12m)}
          sub={period}
          icon={<TrendingUp className="size-5" />}
        />
        <KpiTile
          label={t("products.ca12m")}
          value={formatMAD(stats.ca_12m)}
          sub={period}
          icon={<Coins className="size-5" />}
        />
        <KpiTile
          label={t("products.margeMoy")}
          value={sheet.prices.marge_pct != null ? formatPct(sheet.prices.marge_pct) : "—"}
          icon={<Percent className="size-5" />}
        />
        <KpiTile
          label={t("products.stockCurrent")}
          value={sheet.stock.current_stock != null ? formatQty(sheet.stock.current_stock) : "—"}
          icon={<Boxes className="size-5" />}
        />
        <KpiTile
          label={t("products.coverage")}
          value={sheet.stock.coverage_days != null ? t("products.coverageDays", { n: sheet.stock.coverage_days }) : "—"}
          icon={<BarChart3 className="size-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SheetCard title={t("products.otherStats")}>
          <FieldList
            fields={[
              { label: t("products.avgPerMonth"), value: formatQtyDec(stats.avg_per_month) },
              { label: t("products.avgPerDay"), value: formatQtyDec(stats.avg_per_day) },
              { label: t("products.firstSale"), value: stats.first_sale ? formatDate(stats.first_sale) : dash },
              { label: t("products.lastSale"), value: stats.last_sale ? formatDate(stats.last_sale) : dash },
              {
                label: t("products.bestMonth"),
                value: best
                  ? t("products.bestMonthValue", {
                      month: `${months[Number(best.month.slice(5, 7)) - 1]} ${best.month.slice(0, 4)}`,
                      n: best.units,
                    })
                  : dash,
              },
              {
                label: t("products.monthsWithoutSale"),
                value: t("products.monthsWithoutSaleValue", { n: stats.months_without_sale }),
              },
            ]}
          />
        </SheetCard>

        <SheetCard title={t("products.byYear")} className="lg:col-span-2">
          <DataTable<YearSummary>
            rows={stats.yearly}
            columns={yearColumns(t)}
            emptyTitle={t("products.noMovement")}
            rowKey={(r) => r.year}
          />
        </SheetCard>
      </div>
    </div>
  );
}
