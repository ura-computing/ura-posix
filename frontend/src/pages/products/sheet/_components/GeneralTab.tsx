/** « Général »: prices + marge, stock (Stock page rules), ventes / achats 30 jours,
 *  informations générales, the 5 latest purchases / sales, performance vs the 30 days before. */
import { useContext, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpToLine,
  BarChart3,
  Boxes,
  Clock,
  FileText,
  Package,
  Pencil,
  ShoppingCart,
} from "lucide-react";

import { Button } from "@/_components/button";
import { DataTable, type ColumnDef } from "@/_components/DataTable";
import { KpiTile } from "@/_components/KpiTile";
import type { ProductMovement, ProductSheet } from "@/types";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { formatDate, formatMAD, formatPct, formatQty, pctChange } from "@/utils/format";

import type { FormField } from "../hooks";
import { Editable, type EditKind } from "./Editable";
import { SheetEditContext } from "./editContext";
import { KindBadge } from "./KindBadge";
import { FieldList, SheetCard } from "./SheetCard";

const dash = <span className="text-muted-foreground">—</span>;
const mad = (n: number | null) => (n != null ? <span className="whitespace-nowrap">{formatMAD(n)}</span> : dash);

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
function EditBlockButton() {
  const t = useT();
  const ctx = useContext(SheetEditContext);
  if (!ctx) return null;
  const { editor } = ctx;
  return (
    <Button variant="outline" size="sm" onClick={editor.start} disabled={!editor.canEdit || editor.editing}>
      <Pencil className="size-3.5" />
      {t("products.editBlock")}
    </Button>
  );
}

/** One of the 3 stock figures: icon, label, value (an input in edit mode). */
function StockFigure({
  field,
  label,
  icon,
  value,
}: {
  field: FormField;
  label: string;
  icon: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-4 first:pl-0">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd className="font-mono text-2xl font-bold text-foreground">
          <Editable field={field} kind="int" label={label}>
            {value}
          </Editable>
        </dd>
      </div>
    </div>
  );
}

export function GeneralTab({
  sheet,
  onShowMovements,
}: {
  sheet: ProductSheet;
  /** « Voir tout »: the Mouvements tab. */
  onShowMovements: () => void;
}) {
  const t = useT();
  const { prices, stock, last_30d: last } = sheet;
  const units = (n: number) => (
    <>
      {formatQty(n)} {t("common.wUnites")}
    </>
  );
  const missing = <span className="font-normal text-muted-foreground">{t("products.notAvailable")}</span>;
  const editable = (field: FormField, label: string, value: ReactNode, kind: EditKind = "text") => ({
    label,
    value: (
      <Editable field={field} kind={kind} label={label}>
        {value ?? missing}
      </Editable>
    ),
  });
  const marge = prices.ppv != null && prices.avg_pu != null ? prices.ppv - prices.avg_pu : null;
  // « Performance »: % vs the 30 days before (none when nothing was sold / bought then).
  const salesChange = pctChange(last.sold, last.sold_before);
  const purchasesChange = pctChange(last.bought, last.bought_before);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiTile label={t("products.ppv")} value={prices.ppv != null ? formatMAD(prices.ppv) : "—"} />
        <KpiTile label={t("products.avgPu")} value={prices.avg_pu != null ? formatMAD(prices.avg_pu) : "—"} />
        <KpiTile
          label={t("products.lastPu")}
          value={prices.last_pu != null ? formatMAD(prices.last_pu) : "—"}
          sub={prices.last_pu_date ? `(${formatDate(prices.last_pu_date)})` : undefined}
        />
        <KpiTile label={t("products.margeBrute")} value={marge != null ? formatMAD(marge) : "—"} />
        <KpiTile label={t("col.margePct")} value={prices.marge_pct != null ? formatPct(prices.marge_pct) : "—"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="flex flex-col gap-4">
          <SheetCard title={t("products.stock")} icon={<Boxes className="size-5" />} actions={<EditBlockButton />}>
            <dl className="grid gap-4 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-border">
              <StockFigure
                field="current_stock"
                label={t("products.stockCurrent")}
                icon={<Package className="size-5" />}
                value={
                  stock.current_stock != null ? (
                    formatQty(stock.current_stock)
                  ) : (
                    <span className="font-sans text-base font-medium text-muted-foreground">
                      {t("products.outOfFile")}
                    </span>
                  )
                }
              />
              <StockFigure
                field="stock_min"
                label={t("products.stockMin")}
                icon={<ArrowDownToLine className="size-5" />}
                value={formatQty(stock.stock_min)}
              />
              <StockFigure
                field="stock_max"
                label={t("products.stockMax")}
                icon={<ArrowUpToLine className="size-5" />}
                value={formatQty(stock.stock_max)}
              />
            </dl>
          </SheetCard>

          <SheetCard title={t("products.infos")} icon={<FileText className="size-5" />} actions={<EditBlockButton />}>
            <FieldList
              fields={[
                editable("product", t("col.produit"), sheet.product),
                { label: t("col.pid"), value: <span className="font-mono">{sheet.pid}</span> },
                editable("category", t("col.categorie"), sheet.category),
                editable("tva", t("col.tva"), sheet.tva),
                editable("ppv", t("col.ppv"), prices.ppv != null ? mad(prices.ppv) : null, "price"),
                { label: t("products.avgPu"), value: prices.avg_pu != null ? mad(prices.avg_pu) : missing },
                {
                  label: t("products.lastPu"),
                  value:
                    prices.last_pu != null ? (
                      <>
                        {mad(prices.last_pu)} {prices.last_pu_date && `(${formatDate(prices.last_pu_date)})`}
                      </>
                    ) : (
                      missing
                    ),
                },
                editable(
                  "barcode1",
                  t("products.barcode"),
                  sheet.barcode1 ? <span className="font-mono">{sheet.barcode1}</span> : null,
                ),
                editable("laboratoire", t("col.laboratoire"), sheet.laboratoire),
              ]}
            />
          </SheetCard>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <KpiTile
              label={t("products.sales30d")}
              value={units(last.sold)}
              icon={<ShoppingCart className="size-5" />}
            />
            <KpiTile
              label={t("products.purchases30d")}
              value={units(last.bought)}
              icon={<ShoppingCart className="size-5" />}
              iconTone="info"
            />
          </div>

          <SheetCard
            title={t("products.recent")}
            icon={<Clock className="size-5" />}
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
            hint={t("products.last30Days")}
            icon={<BarChart3 className="size-5" />}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <KpiTile
                label={t("nav.ventes")}
                value={units(last.sold)}
                icon={<ShoppingCart className="size-5" />}
                iconTone="success"
                delta={salesChange == null ? null : { value: salesChange }}
                sub={salesChange == null ? undefined : t("products.vs30Before")}
              />
              <KpiTile
                label={t("nav.achats")}
                value={units(last.bought)}
                icon={<ShoppingCart className="size-5" />}
                iconTone="success"
                delta={purchasesChange == null ? null : { value: purchasesChange }}
                sub={purchasesChange == null ? undefined : t("products.vs30Before")}
              />
            </div>
          </SheetCard>
        </div>
      </div>
    </div>
  );
}
