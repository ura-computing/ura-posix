/** Comptabilité « Retours clients (avoirs) (Sobrus) », read-only: every return of the page's month (newest first), its
 *  products, the month's count and total, « Exporter Excel ». Empty because Sobrus is not connected, or its account
 *  may not read the returns: said in plain words. The Sobrus robot fetches them at every run. */
import { Download } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { SectionTitle } from "@/_components/atoms/SectionTitle";
import { Callout } from "@/_components/molecules/Callout";
import { DataTable, type ColumnDef } from "@/_components/organisms/DataTable";
import { type SalesReturn } from "@/types/accounting";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { formatDate, formatDateTime, formatMAD, formatNumStr, formatQty } from "@/utils/format";

import { useSalesReturns } from "../hooks";

const money = (n: number) => <span className="whitespace-nowrap font-mono">{formatMAD(n)}</span>;
const dash = (v: string | null) => v || <span className="text-muted-foreground">—</span>;

const columns = (t: TFn): ColumnDef<SalesReturn>[] => [
  { key: "day", label: t("col.date"), sortable: false, render: (r) => formatDate(r.day) },
  { key: "number", label: t("returns.number"), sortable: false, render: (r) => r.number },
  { key: "customer", label: t("returns.customer"), sortable: false, render: (r) => dash(r.customer) },
  {
    key: "products",
    label: t("returns.products"),
    sortable: false,
    render: (r) => (
      <span className="text-sm">
        {r.products.length ? r.products.map((p) => `${p.name} × ${formatQty(p.quantity)}`).join(", ") : dash(null)}
      </span>
    ),
  },
  { key: "refund", label: t("returns.refund"), sortable: false, render: (r) => dash(r.refund) },
  { key: "status", label: t("returns.status"), sortable: false, render: (r) => dash(r.status) },
  { key: "amount", label: t("returns.amount"), align: "right", sortable: false, render: (r) => money(r.amount) },
];

export function SalesReturnsSection({ month }: { month: string }) {
  const t = useT();
  const { salesReturns, isLoading, isError, reload, exportReturns } = useSalesReturns(month);
  const rows = salesReturns?.returns ?? [];
  // Not connected: the « Clôture de caisse » block above already says it.
  if (salesReturns && !salesReturns.connected) return null;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle
          hint={
            salesReturns?.last_fetched_at
              ? t("closing.fetchedAt", { date: formatDateTime(salesReturns.last_fetched_at) })
              : undefined
          }
        >
          {t("returns.title")}
        </SectionTitle>
        <Button variant="outline" onClick={exportReturns} disabled={rows.length === 0}>
          <Download className="size-4" />
          {t("returns.export")}
        </Button>
      </div>
      {salesReturns?.no_access && <Callout tone="warning">{t("returns.noAccess")}</Callout>}
      <DataTable<SalesReturn>
        rows={rows}
        columns={columns(t)}
        isLoading={isLoading}
        isError={isError}
        onRetry={reload}
        emptyTitle={t("returns.empty")}
        emptyHint={t("returns.emptyHint")}
        rowKey={(r) => r.id}
      />
      {salesReturns && rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">{t("closing.monthTotal")}</span>
          <span>{t("returns.count", { n: formatNumStr(salesReturns.count) })}</span>
          <span className="font-semibold">
            {t("returns.amount")} : {money(salesReturns.total)}
          </span>
        </div>
      )}
    </section>
  );
}
