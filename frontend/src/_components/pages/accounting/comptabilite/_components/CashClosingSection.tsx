/** Comptabilité « Clôture de caisse (Sobrus) », read-only: one line per day of the page's month (what Sobrus' cash desk
 *  closing report says), a total line, « Exporter Excel »; a day clicked = its payment ways and credit customers.
 *  Empty because Sobrus is not connected, or its account may not read the report (only the owner's login can): said
 *  in plain words. The Sobrus robot fetches it at every run. */
import { useState } from "react";
import { Download, Link2 } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/_components/atoms/Button";
import { Dialog, DialogContent } from "@/_components/atoms/Dialog";
import { SectionTitle } from "@/_components/atoms/SectionTitle";
import { Callout } from "@/_components/molecules/Callout";
import { DialogBody, DialogFooter, DialogHeader } from "@/_components/molecules/DialogShell";
import { EmptyState } from "@/_components/molecules/EmptyState";
import { DataTable, type ColumnDef } from "@/_components/organisms/DataTable";
import { useMe } from "@/hooks/useMe";
import { type ClosingDay, type ClosingMethod } from "@/types";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { formatDate, formatDateTime, formatMAD, formatMADStr, formatQty } from "@/utils/format";

import { useCashClosings } from "../hooks";

const money = (n: number) => <span className="whitespace-nowrap font-mono">{formatMAD(n)}</span>;

const columns = (t: TFn): ColumnDef<ClosingDay>[] => [
  { key: "day", label: t("col.date"), sortable: false, render: (d) => formatDate(d.day) },
  {
    key: "invoices",
    label: t("closing.invoices"),
    align: "right",
    sortable: false,
    render: (d) => formatQty(d.invoices),
  },
  { key: "total", label: t("closing.total"), align: "right", sortable: false, render: (d) => money(d.total) },
  { key: "paid", label: t("closing.paid"), align: "right", sortable: false, render: (d) => money(d.paid) },
  {
    key: "credit_sales",
    label: t("closing.credit"),
    align: "right",
    sortable: false,
    render: (d) => money(d.credit_sales),
  },
  { key: "returns", label: t("closing.returns"), align: "right", sortable: false, render: (d) => money(d.returns) },
  {
    key: "net",
    label: t("closing.net"),
    align: "right",
    sortable: false,
    render: (d) => <span className="font-semibold">{money(d.net)}</span>,
  },
];

/** « Espèce », « Carte bancaire »…: our words for Sobrus' codes, its own label otherwise. */
function methodName(t: TFn, m: ClosingMethod): string {
  const key = `closing.method.${m.code}`;
  const text = t(key);
  return text === key ? m.label : text;
}

/** One day: its figures, each payment way (sales paid + settlements + advances; expenses apart), its credit customers. */
function DayDialog({ day, onClose }: { day: ClosingDay | null; onClose: () => void }) {
  const t = useT();
  const row = (label: string, value: number) => (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {money(value)}
    </div>
  );
  return (
    <Dialog open={day !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        {day && (
          <>
            <DialogHeader title={t("closing.dayTitle", { date: formatDate(day.day) })} onClose={onClose} />
            <DialogBody className="flex flex-col gap-4">
              <div className="flex flex-col divide-y divide-border">
                {row(t("closing.total"), day.total)}
                {row(t("closing.cashSales"), day.cash_sales)}
                {row(t("closing.credit"), day.credit_sales)}
                {row(t("closing.unpaidCredit"), day.unpaid_credit)}
                {row(t("closing.discount"), day.discount)}
                {row(t("closing.returns"), day.returns)}
                {row(t("closing.net"), day.net)}
              </div>
              <div className="flex flex-col gap-1">
                <SectionTitle as="h3" size="sm">
                  {t("closing.methods")}
                </SectionTitle>
                {day.methods.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("closing.noMethod")}</p>
                ) : (
                  <div className="flex flex-col divide-y divide-border">
                    {day.methods.map((m) => (
                      <div key={m.code} className="flex flex-wrap items-center justify-between gap-x-4 py-1.5 text-sm">
                        <span className="text-foreground">{methodName(t, m)}</span>
                        <span className="flex items-center gap-3">
                          {m.expenses > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {t("closing.expenses", { value: formatMADStr(m.expenses) })}
                            </span>
                          )}
                          {money(m.cash_sales + m.settlements + m.advances + m.other)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <SectionTitle as="h3" size="sm">
                  {t("closing.customers")}
                </SectionTitle>
                {day.customers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("closing.noCustomer")}</p>
                ) : (
                  <div className="flex flex-col divide-y divide-border">
                    {day.customers.map((c, i) => (
                      <div
                        key={`${c.name}-${i}`}
                        className="flex flex-wrap items-center justify-between gap-x-4 py-1.5"
                      >
                        <span className="text-sm text-foreground">{c.name}</span>
                        <span className="flex items-center gap-3 text-sm">
                          <span className="text-xs text-muted-foreground">
                            {t("closing.balance", { value: formatMADStr(c.balance) })}
                          </span>
                          {money(c.credit)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={onClose}>
                {t("common.close")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CashClosingSection({ month }: { month: string }) {
  const t = useT();
  const { me } = useMe();
  const role = me?.role;
  const { closings, isLoading, isError, reload, exportClosings } = useCashClosings(month);
  const [open, setOpen] = useState<ClosingDay | null>(null);
  const days = closings?.days ?? [];
  const totals = closings?.totals;
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle
          hint={
            closings?.last_fetched_at
              ? t("closing.fetchedAt", { date: formatDateTime(closings.last_fetched_at) })
              : undefined
          }
        >
          {t("closing.title")}
        </SectionTitle>
        <Button variant="outline" onClick={exportClosings} disabled={days.length === 0}>
          <Download className="size-4" />
          {t("closing.export")}
        </Button>
      </div>
      {closings && !closings.connected ? (
        <EmptyState
          icon={<Link2 className="size-6" />}
          title={t("closing.notConnected")}
          hint={t("closing.notConnectedHint")}
          action={
            me?.role === "owner" ? (
              <Link to={`/${role}/sobrus`} className="font-semibold text-primary hover:underline">
                {t("sobrus.title")}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {closings?.no_access && <Callout tone="warning">{t("closing.noAccess")}</Callout>}
          <DataTable<ClosingDay>
            rows={days}
            columns={columns(t)}
            isLoading={isLoading}
            isError={isError}
            onRetry={reload}
            emptyTitle={t("closing.empty")}
            emptyHint={t("closing.emptyHint")}
            rowKey={(d) => d.day}
            onRowClick={(d) => setOpen(d)}
          />
          {totals && days.length > 0 && (
            <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 rounded-lg border border-border bg-card px-4 py-3 text-sm">
              <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                {t("closing.monthTotal")}
              </span>
              <span>
                {t("closing.invoices")} : <span className="font-mono">{formatQty(totals.invoices)}</span>
              </span>
              <span>
                {t("closing.total")} : {money(totals.total)}
              </span>
              <span>
                {t("closing.paid")} : {money(totals.paid)}
              </span>
              <span>
                {t("closing.credit")} : {money(totals.credit_sales)}
              </span>
              <span>
                {t("closing.returns")} : {money(totals.returns)}
              </span>
              <span className="font-semibold">
                {t("closing.net")} : {money(totals.net)}
              </span>
            </div>
          )}
        </>
      )}
      <DayDialog day={open} onClose={() => setOpen(null)} />
    </section>
  );
}
