/** « Général »: photos, données générales, prix, stock (Stock page rules), description,
 *  the 10 latest purchases / sales, « Ventes par mois » (table or chart). */
import { ArrowRight } from "lucide-react";

import { Button } from "@/_components/button";
import { DataTable, type ColumnDef } from "@/_components/DataTable";
import { StockStatusPill } from "@/_components/StockStatusPill";
import { TypeBadge } from "@/_components/TypeBadge";
import type { ProductMovement, ProductSheet, ProductStats } from "@/types";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { formatDate, formatMAD, formatPct, formatQty } from "@/utils/format";

import { Editable } from "./Editable";
import { MonthlySalesCard } from "./MonthlySalesCard";
import { PhotoGallery } from "./PhotoGallery";
import { FieldList, SheetCard } from "./SheetCard";

const dash = <span className="text-muted-foreground">—</span>;
const mad = (n: number | null) => (n != null ? <span className="whitespace-nowrap">{formatMAD(n)}</span> : dash);

const movementColumns = (t: TFn): ColumnDef<ProductMovement>[] => [
  { key: "date", label: t("col.date"), width: 110, sortable: false, render: (m) => formatDate(m.date) },
  {
    key: "kind",
    label: t("col.type"),
    width: 90,
    sortable: false,
    render: (m) => t(m.kind === "achat" ? "products.kindAchat" : "products.kindVente"),
  },
  {
    key: "quantity",
    label: t("products.colQty"),
    width: 90,
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
    width: 110,
    align: "right",
    sortable: false,
    render: (m) => mad(m.unit_price),
  },
  { key: "document", label: t("products.colDocument"), width: 130, sortable: false, render: (m) => m.document ?? dash },
  { key: "party", label: t("products.colParty"), width: 200, sortable: false, render: (m) => m.party ?? dash },
];

export function GeneralTab({
  sheet,
  stats,
  onShowMovements,
}: {
  sheet: ProductSheet;
  stats: ProductStats | null;
  /** « Voir tout »: the Mouvements tab. */
  onShowMovements: () => void;
}) {
  const t = useT();
  const { info, prices, stock } = sheet;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <SheetCard title={t("products.photos")}>
          <PhotoGallery images={info?.images ?? []} name={sheet.product} />
        </SheetCard>

        <SheetCard title={t("products.general")}>
          <FieldList
            fields={[
              {
                label: t("products.nameLabel"),
                value: (
                  <Editable field="product" label={t("products.nameLabel")}>
                    {sheet.product}
                  </Editable>
                ),
              },
              {
                label: t("col.categorie"),
                value: (
                  <Editable field="category" label={t("col.categorie")}>
                    {sheet.category ?? dash}
                  </Editable>
                ),
              },
              // The type is not editable (stays the catalogue's).
              { label: t("col.type"), value: <TypeBadge type={sheet.category_type} /> },
              {
                label: t("col.laboratoire"),
                value: (
                  <Editable field="laboratoire" label={t("col.laboratoire")}>
                    {sheet.laboratoire ?? dash}
                  </Editable>
                ),
              },
              { label: t("products.brand"), value: info?.brand ?? dash },
              { label: t("products.shopCategory"), value: info?.category ?? dash },
              {
                label: t("col.tva"),
                value: (
                  <Editable field="tva" label={t("col.tva")}>
                    {sheet.tva ?? dash}
                  </Editable>
                ),
              },
            ]}
          />
        </SheetCard>

        <SheetCard title={t("products.prices")}>
          <FieldList
            fields={[
              {
                label: t("products.ppv"),
                value: (
                  <Editable field="ppv" kind="price" label={t("products.ppv")}>
                    {mad(prices.ppv)}
                  </Editable>
                ),
              },
              {
                label: t("products.pph"),
                value: (
                  <Editable field="pph" kind="price" label={t("products.pph")}>
                    {mad(prices.pph)}
                  </Editable>
                ),
              },
              { label: t("products.avgPu"), value: mad(prices.avg_pu) },
              {
                label: t("products.lastPu"),
                value: (
                  <span className="flex flex-col items-end">
                    {mad(prices.last_pu)}
                    {prices.last_pu_date && (
                      <span className="text-xs font-normal text-muted-foreground">
                        {formatDate(prices.last_pu_date)}
                      </span>
                    )}
                  </span>
                ),
              },
              { label: t("col.margePct"), value: prices.marge_pct != null ? formatPct(prices.marge_pct) : dash },
            ]}
          />
        </SheetCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SheetCard title={t("products.stock")}>
          <FieldList
            fields={[
              {
                label: t("products.stockCurrent"),
                value: (
                  <Editable field="current_stock" kind="int" label={t("products.stockCurrent")}>
                    {stock.current_stock != null ? formatQty(stock.current_stock) : t("products.notInStock")}
                  </Editable>
                ),
              },
              {
                label: t("products.stockMin"),
                value: (
                  <Editable field="stock_min" kind="int" label={t("products.stockMin")}>
                    {formatQty(stock.stock_min)}
                  </Editable>
                ),
              },
              {
                label: t("products.stockMax"),
                value: (
                  <Editable field="stock_max" kind="int" label={t("products.stockMax")}>
                    {formatQty(stock.stock_max)}
                  </Editable>
                ),
              },
              {
                label: t("products.coverage"),
                value: stock.coverage_days != null ? t("products.coverageDays", { n: stock.coverage_days }) : dash,
              },
              { label: t("products.status"), value: <StockStatusPill status={stock.status} /> },
              {
                label: t("col.peremption"),
                value: (
                  <Editable field="expiry_date" kind="date" label={t("col.peremption")}>
                    {stock.expiry_date ? formatDate(stock.expiry_date) : dash}
                  </Editable>
                ),
              },
              {
                label: t("products.zone"),
                value: (
                  <Editable field="zone" label={t("products.zone")}>
                    {stock.zone ?? dash}
                  </Editable>
                ),
              },
            ]}
          />
          <p className="text-xs text-muted-foreground">
            {t("products.stockRule", {
              n: stock.units_sold_12m,
              from: formatDate(stock.sales_from),
              to: formatDate(stock.sales_to),
            })}
          </p>
        </SheetCard>

        <SheetCard title={t("products.description")} className="lg:col-span-2">
          <Editable field="description" kind="textarea" label={t("products.description")}>
            {info?.description ? (
              <span className="block whitespace-pre-line text-base leading-relaxed text-foreground">
                {info.description}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">{t("products.noDescription")}</span>
            )}
          </Editable>
          {info && info.details.length > 0 && (
            <FieldList fields={info.details.map((d) => ({ label: d.label, value: d.value }))} />
          )}
        </SheetCard>
      </div>

      <SheetCard
        title={t("products.recent")}
        actions={
          <Button variant="outline" onClick={onShowMovements}>
            {t("products.seeAll")}
            <ArrowRight className="size-4" />
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

      <MonthlySalesCard stats={stats} />
    </div>
  );
}
