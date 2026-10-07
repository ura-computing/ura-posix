/** « Ventes et achats par mois »: units sold and bought each month, two rows per year
 *  (« Ventes 2026 », « Achats 2026 »), shown as a table or as a chart (switch, table first). */
import { useState } from "react";

import { CategorySegment } from "@/_components/CategorySegment";
import { DataTable, type ColumnDef } from "@/_components/DataTable";
import type { ProductStats } from "@/types";
import { useMonthsShort } from "@/i18n/dates";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { formatQty } from "@/utils/format";

import { MonthlySalesChart } from "./MonthlySalesChart";
import { SheetCard } from "./SheetCard";

type View = "table" | "chart";

interface SeriesRow {
  year: number;
  kind: "sold" | "bought";
  months: number[];
  total: number;
}

const ACTIVE = "bg-primary text-primary-foreground shadow-sm";
const units = (n: number) => (n === 0 ? <span className="text-muted-foreground">—</span> : formatQty(n));

const columns = (t: TFn, monthsShort: string[]): ColumnDef<SeriesRow>[] => [
  {
    key: "series",
    label: t("products.series"),
    width: 130,
    sortable: false,
    render: (r) => (
      <span className={r.kind === "sold" ? "whitespace-nowrap font-medium" : "whitespace-nowrap text-muted-foreground"}>
        {t(r.kind === "sold" ? "products.salesOfYear" : "products.purchasesOfYear", { year: r.year })}
      </span>
    ),
  },
  ...monthsShort.map((label, m): ColumnDef<SeriesRow> => ({
    key: `m${m + 1}`,
    label,
    width: 56,
    align: "right",
    sortable: false,
    render: (r) => units(r.months[m]),
  })),
  {
    key: "total",
    label: t("products.total"),
    width: 72,
    align: "right",
    sortable: false,
    render: (r) => <span className="font-semibold">{units(r.total)}</span>,
  },
];

export function MonthlySalesCard({ stats }: { stats: ProductStats | null }) {
  const t = useT();
  const monthsShort = useMonthsShort();
  const [view, setView] = useState<View>("table");
  const options = [
    { value: "table" as const, label: t("products.viewTable"), activeBg: ACTIVE },
    { value: "chart" as const, label: t("products.viewChart"), activeBg: ACTIVE },
  ];
  const years = stats?.monthly ?? [];
  const rows: SeriesRow[] = years.flatMap((y) => [
    { year: y.year, kind: "sold", months: y.sold, total: y.sold_total },
    { year: y.year, kind: "bought", months: y.bought, total: y.bought_total },
  ]);
  return (
    <SheetCard
      title={t("products.salesByMonth")}
      actions={<CategorySegment value={view} options={options} onChange={setView} />}
    >
      <p className="text-xs text-muted-foreground">{t("products.salesByMonthHint")}</p>
      {!stats ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : years.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("products.noSales")}</p>
      ) : view === "table" ? (
        <DataTable<SeriesRow> rows={rows} columns={columns(t, monthsShort)} rowKey={(r) => `${r.year}-${r.kind}`} />
      ) : (
        <MonthlySalesChart years={years} />
      )}
    </SheetCard>
  );
}
