/** « Général »: 6 tiles (prix de vente, prix d'achat moyen, marge unitaire, stock actuel, ventes 12 mois, rythme de
 *  vente), icons like Analyses; 3 cards side by side, each with its own « Modifier » (« Identité », « Prix et
 *  marge », « Stock et réappro »; rows with no source yet: « À renseigner », grey like « Non disponible »); the
 *  sales of every year (« Historique des ventes (par année) »); the 5
 *  latest purchases / sales; « Performance » = ventes / achats over the page dates (toolbar under the tabs, the
 *  current year first) + % vs the period just before. */
import type { ReactNode } from "react";
import { Activity, ArrowRight, BarChart3, Boxes, Coins, ShoppingCart, TrendingUp, Truck } from "lucide-react";

import { Badge } from "@/_components/atoms/Badge";
import { Button } from "@/_components/atoms/Button";
import { DataTable, type ColumnDef } from "@/_components/organisms/DataTable";
import { KpiTile } from "@/_components/organisms/KpiTile";
import { SkeletonRows, SkeletonTile } from "@/_components/molecules/Skeletons";
import { StockStatusPill } from "@/_components/molecules/StockStatusPill";
import type { ProductMovement, ProductSheet, ProductStats } from "@/types/products";
import { useMonthsShort } from "@/i18n/dates";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { todayIso } from "@/utils/dateRange";
import {
  formatDate,
  formatMAD,
  formatMADStr,
  formatMoney,
  formatNumStr,
  formatPctStr,
  formatQty,
  pctChange,
} from "@/utils/format";

import type { EditSection, FormField, StatsRange } from "../hooks";
import { tvaShort, withoutRate } from "../labels";
import { EditHint, Editable, SectionEditActions, type EditKind } from "./Editable";
import { KindBadge } from "./KindBadge";
import { FieldList, type Field } from "@/_components/molecules/FieldList";
import { SectionCard } from "@/_components/molecules/SectionCard";

import { TileNumber } from "./TileNumber";
import { historyLines, LINE_TONE, yearColumns, type HistoryLine } from "./yearHistory";

const dash = <span className="text-muted-foreground">—</span>;
const mad = (n: number | null) => (n != null ? <span className="whitespace-nowrap">{formatMAD(n)}</span> : dash);
const madTile = (n: number | null) => (n != null ? <TileNumber value={formatMoney(n)} unit="MAD" /> : "—");
const join = (parts: (string | null | false | undefined)[]) => parts.filter(Boolean).join(" · ");

// No fixed widths: the 5 columns fit the card (no sideways scroll on a laptop screen).
const movementColumns = (t: TFn): ColumnDef<ProductMovement>[] => [
  { key: "date", label: t("col.date"), sortable: false, render: (m) => formatDate(m.date) },
  { key: "kind", label: t("col.type"), sortable: false, render: (m) => <KindBadge kind={m.kind} /> },
  { key: "document", label: t("col.reference"), sortable: false, render: (m) => m.document ?? dash },
  {
    key: "quantity",
    label: t("products.colQty"),
    align: "right",
    sortable: false,
    render: (m) =>
      m.quantity == null ? (
        dash
      ) : (
        <span className={cn("font-semibold", m.quantity > 0 ? "text-success" : "text-error")}>
          {m.quantity > 0 ? "+" : ""}
          {formatQty(m.quantity)}
        </span>
      ),
  },
  {
    key: "unit_price",
    label: t("products.colPu"),
    align: "right",
    sortable: false,
    render: (m) => mad(m.unit_price),
  },
];

/** Next to the expiry date: « Périmé » (past), « Moins de 30 jours » (red), « Moins de 90 jours »
 *  (orange); nothing further away. */
function ExpiryHint({ iso }: { iso: string }) {
  const t = useT();
  const days = Math.round((Date.parse(`${iso}T00:00:00`) - Date.parse(`${todayIso()}T00:00:00`)) / 86_400_000);
  if (days >= 90) return null;
  const [label, tone] =
    days < 0
      ? [t("products.expired"), "border-error/30 bg-error-subtle text-error-subtle-foreground"]
      : days < 30
        ? [t("products.expiresIn30"), "border-error/30 bg-error-subtle text-error-subtle-foreground"]
        : [t("products.expiresIn90"), "border-warning-border bg-warning-subtle text-warning-subtle-foreground"];
  return <span className={cn("rounded-md border px-2 py-0.5 text-xs font-semibold", tone)}>{label}</span>;
}

/** The 12 last months' sales as small bars (one color, chart rule), the month in each bar's tooltip. */
function MonthBars({ months, label }: { months: { name: string; sold: number }[]; label: string }) {
  const top = Math.max(1, ...months.map((m) => m.sold));
  return (
    <div className="flex h-10 items-end gap-1" role="img" aria-label={label}>
      {months.map((m) => (
        <span
          key={m.name}
          title={`${m.name} : ${formatNumStr(m.sold)}`}
          className="flex-1 rounded-sm bg-primary/70"
          style={{ height: `${Math.max(6, (m.sold / top) * 100)}%` }}
        />
      ))}
    </div>
  );
}

/** Stock now against its maximum: a bar (orange under the minimum), a tick at the minimum. */
function StockBar({ current, min, max, under }: { current: number; min: number; max: number; under: boolean }) {
  const percent = (n: number) => (max > 0 ? Math.min(100, Math.max(0, (n / max) * 100)) : 0);
  return (
    <div className="relative h-2 w-full" aria-hidden>
      <div className="h-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", under ? "bg-warning" : "bg-success")}
          style={{ width: `${percent(current)}%` }}
        />
      </div>
      {min > 0 && (
        <span className="absolute -top-0.5 h-3 w-0.5 rounded-full bg-foreground" style={{ left: `${percent(min)}%` }} />
      )}
    </div>
  );
}

/** Default minimum / maximum when none is set (0): 3 weeks of sales, 40 days, rounded up to 5 units. */
const roundUp5 = (n: number) => Math.ceil(n / 5) * 5;
function suggested(perDay: number): { min: number; max: number } | null {
  if (perDay <= 0) return null;
  return { min: roundUp5(perDay * 21), max: roundUp5(perDay * 40) };
}

export function GeneralTab({
  sheet,
  stats,
  range,
  onShowMovements,
}: {
  sheet: ProductSheet;
  /** « Performance »: the Statistiques figures of `range` (null while they load). */
  stats: ProductStats | null;
  range: StatsRange;
  /** « Voir tout »: the Traçabilité tab. */
  onShowMovements: () => void;
}) {
  const t = useT();
  const monthsShort = useMonthsShort();
  const { prices, stock, last_purchase: lastIn, last_sale: lastOut } = sheet;
  const units = (n: number) => <TileNumber value={formatQty(n)} unit={t("common.wUnites")} />;
  const missing = <span className="font-normal text-muted-foreground">{t("products.notAvailable")}</span>;
  const toFill = (label: string): Field => ({
    label,
    value: <span className="font-normal text-muted-foreground">{t("products.toFill")}</span>,
  });
  const editable =
    (section: EditSection) =>
    (field: FormField, label: string, value: ReactNode, kind: EditKind = "text"): Field => ({
      label,
      value: (
        <Editable field={field} kind={kind} label={label} section={section}>
          {value ?? missing}
        </Editable>
      ),
    });
  const [identity, priced, stocked] = [editable("identity"), editable("prices"), editable("stock")];
  const marge = prices.ppv != null && prices.avg_pu != null ? prices.ppv - prices.avg_pu : null;
  // Rhythm: the Stock page's 12 months of sales.
  const perDay = stock.units_sold_12m / 365;
  const current = stock.current_stock;
  const under = current != null && current < stock.stock_min;
  const suggestion = suggested(perDay);
  // Under the bar of « Stock actuel »: « ≈ 3 jours de couverture · manque 49 u. ».
  const stockNote = join([
    stock.coverage_days != null && t("products.coverageDays", { n: stock.coverage_days }),
    under && t("products.missingUnits", { n: formatNumStr(stock.stock_min - (current ?? 0)) }),
  ]);
  // Nothing set (0): the default from the sales, marked « par défaut »; a value set always wins.
  const withDefault = (value: number, fallback: number | undefined) =>
    value > 0 || !fallback ? (
      formatQty(value)
    ) : (
      <span className="flex flex-wrap items-baseline gap-2">
        {formatQty(fallback)}
        <span className="text-sm font-normal text-muted-foreground">{t("products.byDefault")}</span>
      </span>
    );
  // The 12 months of « Statistiques » (oldest first) and the busiest one.
  const months = (stats?.monthly ?? []).map((m) => ({ name: monthsShort[Number(m.month.slice(5)) - 1], sold: m.sold }));
  const peak = months.reduce<{ name: string; sold: number } | null>((p, m) => (m.sold > (p?.sold ?? 0) ? m : p), null);
  // Best price: the lowest of each supplier's latest purchase in the page dates.
  const best = (stats?.last_prices ?? []).reduce<ProductStats["last_prices"][number] | null>(
    (b, p) => (b == null || p.unit_price < b.unit_price ? p : b),
    null,
  );
  // « Performance »: the period vs the one just before (no % when nothing then).
  const now = stats?.period;
  const before = stats?.previous;
  const salesChange = now && before ? pctChange(now.sold, before.sold) : null;
  const purchasesChange = now && before ? pctChange(now.bought, before.bought) : null;
  const vsBefore = stats
    ? t("products.vsPeriod", { from: formatDate(stats.previous_from), to: formatDate(stats.previous_to) })
    : undefined;
  // « Historique des ventes (par année) »: every year, not tied to the page dates.
  const salesYears = stats ? historyLines(stats.history, "sales") : [];
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiTile
          label={t("products.ppv")}
          icon={<BarChart3 className="size-5" />}
          iconTone="info"
          value={madTile(prices.ppv)}
          sub={prices.pph != null ? t("products.pphSub", { value: formatMADStr(prices.pph) }) : undefined}
        />
        <KpiTile
          label={t("products.avgPu")}
          icon={<Coins className="size-5" />}
          iconTone="warning"
          value={madTile(prices.avg_pu)}
          sub={
            join([
              prices.last_pu != null && t("products.lastSub", { value: formatMADStr(prices.last_pu) }),
              best?.supplier &&
                t("products.bestSub", { value: formatMADStr(best.unit_price), supplier: best.supplier }),
            ]) || undefined
          }
        />
        <KpiTile
          label={t("products.unitMargin")}
          icon={<TrendingUp className="size-5" />}
          iconTone="success"
          value={madTile(marge)}
          sub={prices.marge_pct != null ? formatPctStr(prices.marge_pct) : undefined}
        />
        <KpiTile
          label={t("products.stockCurrent")}
          icon={<Boxes className="size-5" />}
          iconTone={under ? "warning" : "success"}
          className={cn(under && "border-warning-border bg-warning-subtle")}
          value={
            current != null ? (
              <TileNumber
                value={<span className={cn(under && "text-warning")}>{formatQty(current)}</span>}
                unit={t("products.stockOf", { min: formatNumStr(stock.stock_min), max: formatNumStr(stock.stock_max) })}
              />
            ) : (
              "—"
            )
          }
        >
          {current != null && <StockBar current={current} min={stock.stock_min} max={stock.stock_max} under={under} />}
          {stockNote && <p className={cn("text-sm", under ? "text-warning" : "text-muted-foreground")}>{stockNote}</p>}
        </KpiTile>
        <KpiTile
          label={t("products.sales12m")}
          icon={<ShoppingCart className="size-5" />}
          iconTone="primary"
          value={units(stock.units_sold_12m)}
        >
          {months.length > 0 && <MonthBars months={months} label={t("products.sales12m")} />}
        </KpiTile>
        <KpiTile
          label={t("products.rhythm")}
          icon={<Activity className="size-5" />}
          iconTone="primary"
          value={<TileNumber value={formatNumStr(stock.units_sold_12m / 12, 1)} unit={t("products.perMonth")} />}
          sub={
            join([
              t("products.perDay", { rate: formatNumStr(perDay, 1) }),
              lastOut?.date && t("products.lastSale", { date: formatDate(lastOut.date) }),
              peak && t("products.peak", { months: peak.name }),
            ]) || undefined
          }
        />
      </div>

      {/* 3 cards, each its own « Modifier ». Catégorie and TVA without their rate (« Médicament », « Exonéré »);
          edit mode keeps the text. PID: header and Codes tab. */}
      <EditHint sections={["identity", "prices", "stock"]} />
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title={t("products.identity")} actions={<SectionEditActions section="identity" />}>
          <FieldList
            fields={[
              identity("product", t("col.produit"), sheet.product),
              sheet.dci ? { label: t("products.dci"), value: sheet.dci } : toFill(t("products.dci")),
              identity("laboratoire", t("col.laboratoire"), sheet.laboratoire),
              sheet.galenic_form
                ? { label: t("products.galenicForm"), value: sheet.galenic_form }
                : toFill(t("products.galenicForm")),
              identity("category", t("col.categorie"), sheet.category && withoutRate(sheet.category)),
              toFill(t("products.rxStatus")),
              identity("zone", t("products.location"), stock.zone),
              identity(
                "barcode1",
                t("products.barcode"),
                sheet.barcode1 ? <span className="font-mono">{sheet.barcode1}</span> : null,
              ),
            ]}
          />
        </SectionCard>

        <SectionCard
          title={t("products.pricesCard")}
          actions={
            <span className="flex flex-wrap items-center gap-2">
              {sheet.category_type === "pharmacie" && (
                <Badge tone="success" size="md">
                  {t("products.regulatedPpv")}
                </Badge>
              )}
              <SectionEditActions section="prices" />
            </span>
          }
        >
          <FieldList
            fields={[
              priced("ppv", t("col.ppv"), prices.ppv != null ? mad(prices.ppv) : null, "price"),
              priced(
                "counter_discount",
                t("products.counterDiscount"),
                prices.counter_discount
                  ? join([
                      formatPctStr(prices.counter_discount),
                      prices.counter_price != null && formatMADStr(prices.counter_price),
                    ])
                  : t("products.counterDiscountNone"),
                "pct",
              ),
              { label: t("col.pph"), value: mad(prices.pph) },
              { label: t("products.avgPu"), value: mad(prices.avg_pu) },
              {
                label: t("products.lastPurchase"),
                value: lastIn
                  ? join([
                      lastIn.unit_price != null && formatMADStr(lastIn.unit_price),
                      lastIn.date && formatDate(lastIn.date),
                      lastIn.supplier,
                    ])
                  : dash,
              },
              {
                label: t("products.bestPrice"),
                value: best ? join([formatMADStr(best.unit_price), best.supplier]) : dash,
              },
              {
                label: t("products.margeBrute"),
                value:
                  marge != null
                    ? join([formatMADStr(marge), prices.marge_pct != null && formatPctStr(prices.marge_pct)])
                    : dash,
              },
              priced("tva", t("col.tva"), sheet.tva && tvaShort(sheet.tva)),
            ]}
          />
        </SectionCard>

        <SectionCard
          title={t("products.stockCard")}
          actions={
            <span className="flex flex-wrap items-center gap-2">
              <StockStatusPill status={stock.status} />
              <SectionEditActions section="stock" />
            </span>
          }
        >
          {/* Stock page rules; an input in edit mode (named in full: « Stock actuel »). */}
          <FieldList
            fields={[
              stocked(
                "current_stock",
                t("products.stockCurrent"),
                current != null ? (
                  <span className={cn(under && "text-warning-subtle-foreground")}>{formatQty(current)}</span>
                ) : (
                  <span className="font-normal text-muted-foreground">{t("products.outOfFile")}</span>
                ),
                "int",
              ),
              stocked("stock_min", t("products.stockMin"), withDefault(stock.stock_min, suggestion?.min), "int"),
              stocked("stock_max", t("products.stockMax"), withDefault(stock.stock_max, suggestion?.max), "int"),
              {
                label: t("products.coverage"),
                value:
                  stock.coverage_days != null
                    ? t("products.coverageValue", { days: stock.coverage_days, rate: formatNumStr(perDay, 1) })
                    : dash,
              },
              stocked(
                "expiry_date",
                t("products.expiryDate"),
                stock.expiry_date ? (
                  <span className="flex flex-wrap items-center gap-2">
                    {formatDate(stock.expiry_date)}
                    <ExpiryHint iso={stock.expiry_date} />
                  </span>
                ) : null,
                "date",
              ),
              toFill(t("products.leadTime")),
              toFill(t("products.lots")),
              {
                label: t("products.lastEntry"),
                value: lastIn
                  ? t("products.lastEntryValue", { date: formatDate(lastIn.date), qty: formatNumStr(lastIn.quantity) })
                  : dash,
              },
            ]}
          />
        </SectionCard>
      </div>

      {/* Ventes only (Statistiques has Tous · Ventes · Achats). */}
      <SectionCard title={t("products.salesYearHistory")}>
        {!range.from || !range.to ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("products.pickDates")}</p>
        ) : !stats ? (
          <SkeletonRows rows={3} columns={6} />
        ) : (
          <DataTable<HistoryLine>
            rows={salesYears}
            columns={yearColumns(t, monthsShort, false)}
            emptyTitle={t("products.noSale")}
            rowKey={(r) => `${r.year}-${r.kind}`}
            rowClassName={(r) => LINE_TONE[r.kind]}
          />
        )}
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title={t("products.recent")}
          actions={
            <Button variant="secondary" size="sm" onClick={onShowMovements}>
              {t("products.seeAll")}
              <ArrowRight className="size-3.5" />
            </Button>
          }
        >
          <DataTable<ProductMovement>
            rows={sheet.recent_movements}
            columns={movementColumns(t)}
            emptyTitle={t("products.noMovement")}
            rowKey={(_, i) => i}
          />
        </SectionCard>

        <SectionCard
          title={t("products.performance")}
          hint={
            range.from && range.to
              ? t("products.periodFromTo", { from: formatDate(range.from), to: formatDate(range.to) })
              : undefined
          }
        >
          {!range.from || !range.to ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("products.pickDates")}</p>
          ) : !now ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <SkeletonTile />
              <SkeletonTile />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <KpiTile
                label={t("nav.ventes")}
                value={units(now.sold)}
                icon={<ShoppingCart className="size-5" />}
                iconTone="success"
                delta={salesChange == null ? null : { value: salesChange }}
                sub={salesChange == null ? undefined : vsBefore}
              />
              <KpiTile
                label={t("nav.achats")}
                value={units(now.bought)}
                icon={<Truck className="size-5" />}
                iconTone="info"
                delta={purchasesChange == null ? null : { value: purchasesChange }}
                sub={purchasesChange == null ? undefined : vsBefore}
              />
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
