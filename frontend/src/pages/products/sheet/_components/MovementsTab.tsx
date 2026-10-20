/** « Traçabilité »: every purchase (+) and sale (−) line of the product, like a pharmacy's
 *  « Rastro »: the list on the left (type, date, hour, quantity), the clicked line's details on
 *  the right (the first line until one is clicked). Type, period (shared with the other pages),
 *  search, sort by date or by type; 20 per page. « Voir tout le ticket / BL » opens it in
 *  Ventes / Achats. */
import { useState } from "react";
import { ExternalLink, ListTree } from "lucide-react";

import { Button } from "@/_components/button";
import { CategorySegment } from "@/_components/CategorySegment";
import { DataTable, type ColumnDef } from "@/_components/DataTable";
import { FilterBar, type ActiveFilter } from "@/_components/filterBar";
import type { ProductMovementLine, ProductSheet } from "@/types";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { formatDate, formatDateTime, formatMAD, formatPct, formatQty } from "@/utils/format";

import { useMovements } from "../hooks";
import { tvaShort } from "../labels";
import { KindBadge } from "./KindBadge";
import { FieldList, SheetCard } from "./SheetCard";

const ACTIVE = "bg-primary text-primary-foreground shadow-sm";
const dash = <span className="text-muted-foreground">—</span>;
const mad = (n: number | null) => (n != null ? <span className="whitespace-nowrap">{formatMAD(n)}</span> : dash);
const keyOf = (m: ProductMovementLine) => `${m.kind}-${m.id}`;

function Quantity({ n }: { n: number | null }) {
  if (n == null) return dash;
  return (
    <span className={cn("font-semibold", n > 0 ? "text-success" : "text-error")}>
      {n > 0 ? "+" : ""}
      {formatQty(n)}
    </span>
  );
}

const columns = (t: TFn): ColumnDef<ProductMovementLine>[] => [
  { key: "kind", label: t("col.type"), sortable: false, render: (m) => <KindBadge kind={m.kind} /> },
  { key: "date", label: t("col.date"), sortable: false, render: (m) => formatDate(m.date) },
  { key: "time", label: t("products.colTime"), sortable: false, render: (m) => m.time ?? dash },
  {
    key: "quantity",
    label: t("products.colQty"),
    align: "right",
    sortable: false,
    render: (m) => <Quantity n={m.quantity} />,
  },
];

/** « Créée le » of a purchase: « 19/03/2026 17:12 ». */
const createdAt = (iso: string | null) => (iso ? `${formatDate(iso.slice(0, 10))} ${iso.slice(11, 16)}` : null);

/** The clicked line, field by field (as the file and its import give it). */
function LineDetail({
  line,
  tva,
  canSeeDetail,
  seeDetail,
}: {
  line: ProductMovementLine;
  tva: string | null;
  canSeeDetail: (kind: ProductMovementLine["kind"]) => boolean;
  seeDetail: (m: ProductMovementLine) => void;
}) {
  const t = useT();
  const text = (v: string | null) => v ?? dash;
  const imported = [
    { label: t("products.dImportedAt"), value: line.imported_at ? formatDateTime(line.imported_at) : dash },
    { label: t("products.dImportedBy"), value: text(line.imported_by) },
    { label: t("products.dFile"), value: text(line.filename) },
  ];
  const fields =
    line.kind === "achat"
      ? [
          { label: t("col.type"), value: <KindBadge kind={line.kind} /> },
          { label: t("products.dSupplier"), value: text(line.party) },
          { label: t("products.dBl"), value: text(line.document) },
          { label: t("products.dBlDate"), value: line.date ? formatDate(line.date) : dash },
          { label: t("products.dCreatedAt"), value: text(createdAt(line.created_at)) },
          { label: t("products.dQty"), value: <Quantity n={line.quantity} /> },
          { label: t("products.colPu"), value: mad(line.unit_price) },
          { label: t("products.dLineTotal"), value: mad(line.total) },
          { label: t("products.dLotExpiry"), value: line.expiry_date ? formatDate(line.expiry_date) : dash },
          { label: t("products.dStockMinFile"), value: line.stock_min != null ? formatQty(line.stock_min) : dash },
          { label: t("products.dStockMaxFile"), value: line.stock_max != null ? formatQty(line.stock_max) : dash },
          ...imported,
        ]
      : [
          { label: t("col.type"), value: <KindBadge kind={line.kind} /> },
          { label: t("products.dTicket"), value: text(line.document) },
          { label: t("col.date"), value: line.date ? formatDate(line.date) : dash },
          { label: t("products.dClient"), value: text(line.party) },
          { label: t("products.dQty"), value: <Quantity n={line.quantity} /> },
          { label: t("products.colPu"), value: mad(line.unit_price) },
          { label: t("col.remise"), value: formatPct(line.discount ?? 0) },
          { label: t("col.tva"), value: tva ? tvaShort(tva) : dash },
          { label: t("col.total"), value: mad(line.total) },
          ...imported,
        ];
  const allowed = canSeeDetail(line.kind);
  return (
    <div className="flex flex-col gap-3">
      <FieldList fields={fields} />
      <div className="flex flex-col items-start gap-1">
        <Button
          variant="outline"
          onClick={() => seeDetail(line)}
          disabled={!line.document || !allowed}
          title={t(line.kind === "achat" ? "products.seeBl" : "products.seeTicket", { ref: line.document ?? "" })}
        >
          <ExternalLink className="size-4" />
          {t(line.kind === "achat" ? "products.seeWholeBl" : "products.seeWholeTicket")}
        </Button>
        {!allowed && <span className="text-xs text-muted-foreground">{t("products.noDetailAccess")}</span>}
      </div>
    </div>
  );
}

export function MovementsTab({ sheet }: { sheet: ProductSheet }) {
  const t = useT();
  const {
    canSeeDetail,
    filters,
    isLoading,
    reset,
    rows,
    seeDetail,
    setDateRange,
    setKind,
    setOrder,
    setPage,
    setPageSize,
    setSearch,
    total,
  } = useMovements(sheet.id);
  // The clicked line, for this list only: another page / filter / sort → its first line.
  const listKey = JSON.stringify(filters);
  const [picked, setPicked] = useState<{ list: string; key: string } | null>(null);
  const clicked = picked?.list === listKey ? rows.find((m) => keyOf(m) === picked.key) : undefined;
  const selected = clicked ?? rows[0] ?? null;

  const kinds = [
    { value: "all" as const, label: t("products.kindAll"), activeBg: ACTIVE },
    { value: "vente" as const, label: t("nav.ventes"), activeBg: ACTIVE },
    { value: "achat" as const, label: t("nav.achats"), activeBg: ACTIVE },
  ];
  const orders = [
    { value: "date" as const, label: t("products.sortByDate"), activeBg: ACTIVE },
    { value: "kind" as const, label: t("products.sortByKind"), activeBg: ACTIVE },
  ];
  const activeFilters: ActiveFilter[] = [
    filters.search
      ? {
          key: "search",
          label: (
            <>
              {t("common.recherche")} {filters.search}
            </>
          ),
          onClear: () => setSearch(""),
        }
      : null,
    filters.date_from || filters.date_to
      ? {
          key: "dates",
          label: (
            <>
              {filters.date_from ?? "…"} → {filters.date_to ?? "…"}
            </>
          ),
          onClear: () => setDateRange(null, null),
        }
      : null,
  ].filter(Boolean) as ActiveFilter[];

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        search={{ value: filters.search, onChange: setSearch, placeholder: t("products.movementsSearchPh") }}
        dateRange={{ from: filters.date_from, to: filters.date_to, onChange: setDateRange }}
        segment={{ value: filters.kind, onChange: setKind, options: kinds }}
        activeFilters={activeFilters}
        onResetAll={reset}
      />
      <div className="flex items-center gap-3" role="group" aria-label={t("products.sortLabel")}>
        <span className="text-sm font-medium text-muted-foreground">{t("products.sortLabel")}</span>
        <CategorySegment value={filters.order} options={orders} onChange={setOrder} />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <DataTable<ProductMovementLine>
          rows={rows}
          columns={columns(t)}
          isLoading={isLoading}
          pagination={{
            page: filters.page,
            pageSize: filters.limit,
            total,
            onPage: setPage,
            onPageSize: setPageSize,
            pageSizes: [20, 50, 100],
          }}
          emptyTitle={t("products.noMovement")}
          rowKey={keyOf}
          onRowClick={(m) => setPicked({ list: listKey, key: keyOf(m) })}
          isRowSelected={(m) => selected != null && keyOf(m) === keyOf(selected)}
        />
        <SheetCard title={t("products.lineDetail")} icon={<ListTree className="size-5" />}>
          {selected ? (
            <LineDetail line={selected} tva={sheet.tva} canSeeDetail={canSeeDetail} seeDetail={seeDetail} />
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("products.pickLine")}</p>
          )}
        </SheetCard>
      </div>
    </div>
  );
}
