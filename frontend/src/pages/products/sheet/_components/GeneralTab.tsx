/** « Général »: prices + marge tiles; « Informations générales » like a pharmacy software form
 *  (« Données générales » · « Prix » · « Stock » boxes: Stock page rules, emplacement, date de
 *  péremption with « Périmé » / « Moins de 30 / 90 jours », the Alertes thresholds); the sales of
 *  every year (« Historique des ventes (par année) »); the 5 latest purchases / sales;
 *  « Performance » = ventes / achats over the page dates (toolbar under the tabs, the current year
 *  first) + % vs the period just before. */
import type { ReactNode } from "react";
import { ArrowRight, ShoppingCart, Truck } from "lucide-react";

import { Button } from "@/_components/button";
import { DataTable, type ColumnDef } from "@/_components/DataTable";
import { KpiTile } from "@/_components/KpiTile";
import type { ProductMovement, ProductSheet, ProductStats } from "@/types";
import { useMonthsShort } from "@/i18n/dates";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { todayIso } from "@/utils/dateRange";
import { formatDate, formatMAD, formatMoney, formatQty, pctChange } from "@/utils/format";

import type { FormField, StatsRange } from "../hooks";
import { tvaShort, withoutRate } from "../labels";
import { EditHint, Editable, SectionEditActions, type EditKind } from "./Editable";
import { KindBadge } from "./KindBadge";
import { FieldList, SheetCard, TileNumber, type Field } from "./SheetCard";
import { historyLines, LINE_TONE, yearColumns, type HistoryLine } from "./yearHistory";

const dash = <span className="text-muted-foreground">—</span>;
const mad = (n: number | null) => (n != null ? <span className="whitespace-nowrap">{formatMAD(n)}</span> : dash);
const madTile = (n: number | null) => (n != null ? <TileNumber value={formatMoney(n)} unit="MAD" /> : "—");

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

/** « Éditer » of a block: the same edit mode as « Modifier » (owner only, shown disabled otherwise). */
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

/** One part of « Informations générales » (« Données générales », « Prix », « Stock »): its title,
 *  then label / value rows. */
function InfoGroup({ title, fields }: { title: string; fields: Field[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <FieldList fields={fields} />
    </div>
  );
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
  const { prices, stock } = sheet;
  const units = (n: number) => <TileNumber value={formatQty(n)} unit={t("common.wUnites")} />;
  const missing = <span className="font-normal text-muted-foreground">{t("products.notAvailable")}</span>;
  const editable = (field: FormField, label: string, value: ReactNode, kind: EditKind = "text"): Field => ({
    label,
    value: (
      <Editable field={field} kind={kind} label={label} section="infos">
        {value ?? missing}
      </Editable>
    ),
  });
  const marge = prices.ppv != null && prices.avg_pu != null ? prices.ppv - prices.avg_pu : null;
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiTile label={t("products.ppv")} value={madTile(prices.ppv)} />
        <KpiTile label={t("products.avgPu")} value={madTile(prices.avg_pu)} />
        <KpiTile
          label={t("products.lastPu")}
          value={madTile(prices.last_pu)}
          sub={prices.last_pu_date ? `(${formatDate(prices.last_pu_date)})` : undefined}
        />
        <KpiTile label={t("products.margeBrute")} value={madTile(marge)} />
        <KpiTile
          label={t("col.margePct")}
          value={prices.marge_pct != null ? <TileNumber value={formatMoney(prices.marge_pct)} unit="%" /> : "—"}
        />
      </div>

      {/* 3 parts side by side, like a pharmacy software sheet. Catégorie and TVA without their rate
          (« Médicament », « Exonéré »); edit mode keeps the text. PID: header and Codes tab. */}
      <SheetCard title={t("products.infos")} actions={<SectionEditActions section="infos" />}>
        <EditHint section="infos" />
        <div className="grid gap-6 lg:grid-cols-3">
          <InfoGroup
            title={t("products.generalData")}
            fields={[
              editable("product", t("col.produit"), sheet.product),
              editable("category", t("col.categorie"), sheet.category && withoutRate(sheet.category)),
              editable("laboratoire", t("col.laboratoire"), sheet.laboratoire),
              editable("tva", t("col.tva"), sheet.tva && tvaShort(sheet.tva)),
              editable(
                "barcode1",
                t("products.barcode"),
                sheet.barcode1 ? <span className="font-mono">{sheet.barcode1}</span> : null,
              ),
              editable("zone", t("products.location"), stock.zone),
              editable(
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
            ]}
          />
          <InfoGroup
            title={t("products.pricesBox")}
            fields={[
              editable("ppv", t("col.ppv"), prices.ppv != null ? mad(prices.ppv) : null, "price"),
              { label: t("col.pph"), value: mad(prices.pph) },
              { label: t("products.avgPu"), value: mad(prices.avg_pu) },
              { label: t("products.lastPu"), value: mad(prices.last_pu) },
            ]}
          />
          {/* Stock page rules; an input in edit mode (named in full: « Stock actuel »). */}
          <InfoGroup
            title={t("products.stock")}
            fields={[
              editable(
                "current_stock",
                t("products.stockCurrent"),
                stock.current_stock != null ? (
                  formatQty(stock.current_stock)
                ) : (
                  <span className="font-normal text-muted-foreground">{t("products.outOfFile")}</span>
                ),
                "int",
              ),
              editable("stock_min", t("products.stockMin"), formatQty(stock.stock_min), "int"),
              editable("stock_max", t("products.stockMax"), formatQty(stock.stock_max), "int"),
            ]}
          />
        </div>
      </SheetCard>

      {/* Ventes only (Statistiques has Tous · Ventes · Achats). */}
      <SheetCard title={t("products.salesYearHistory")}>
        {!range.from || !range.to ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("products.pickDates")}</p>
        ) : !stats ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : (
          <DataTable<HistoryLine>
            rows={salesYears}
            columns={yearColumns(t, monthsShort, false)}
            emptyTitle={t("products.noSale")}
            rowKey={(r) => `${r.year}-${r.kind}`}
            rowClassName={(r) => LINE_TONE[r.kind]}
          />
        )}
      </SheetCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SheetCard
          title={t("products.recent")}
          actions={
            <Button variant="outline" size="sm" onClick={onShowMovements}>
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
        </SheetCard>

        <SheetCard
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
            <p className="py-4 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
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
        </SheetCard>
      </div>
    </div>
  );
}
