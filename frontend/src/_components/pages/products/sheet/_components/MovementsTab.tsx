/** « Traçabilité »: every purchase (+) and sale (−) line of the product, like a pharmacy's
 *  « Rastro »: the list on the left (type, date with the hour when known, quantity), the clicked
 *  line's details on the right (the first line until one is clicked). One toolbar: the page dates,
 *  search, type, sort by date or by type; 20 per page. « Voir tout le ticket / BL » opens it in
 *  Ventes / Achats. */
import { useState } from "react";
import { ExternalLink } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { Segmented } from "@/_components/molecules/Segmented";
import { DataTable, type ColumnDef } from "@/_components/organisms/DataTable";
import { FilterBar, type ActiveFilter } from "@/_components/organisms/FilterBar";
import type { ProductMovementLine, ProductSheet } from "@/types/products";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { formatDate, formatDateTime, formatMAD, formatPct, formatQty } from "@/utils/format";

import { useMovements, type StatsRange } from "../hooks";
import { tvaShort } from "../labels";
import { KindBadge } from "./KindBadge";
import { FieldList } from "@/_components/molecules/FieldList";
import { SectionCard } from "@/_components/molecules/SectionCard";

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
  // The hour only when the file gives it (a purchase's « Créée le » that day): « 19/03/2026 17:12 ».
  {
    key: "date",
    label: t("col.date"),
    sortable: false,
    render: (m) => (
      <span className="whitespace-nowrap">
        {formatDate(m.date)}
        {m.time && <span className="text-muted-foreground"> {m.time}</span>}
      </span>
    ),
  },
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
          variant="secondary"
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

export function MovementsTab({
  sheet,
  range,
  onRange,
}: {
  sheet: ProductSheet;
  /** The page dates (Général, Statistiques): changed here too. */
  range: StatsRange;
  onRange: (from: string | null, to: string | null) => void;
}) {
  const t = useT();
  const {
    canSeeDetail,
    filters,
    isLoading,
    reset,
    rows,
    seeDetail,
    setKind,
    setOrder,
    setPage,
    setPageSize,
    setSearch,
    total,
  } = useMovements(sheet.id, range);
  // The clicked line, for this list only: another page / filter / sort → its first line.
  const listKey = JSON.stringify(filters);
  const [picked, setPicked] = useState<{ list: string; key: string } | null>(null);
  const clicked = picked?.list === listKey ? rows.find((m) => keyOf(m) === picked.key) : undefined;
  const selected = clicked ?? rows[0] ?? null;
  const hasLines = isLoading || rows.length > 0;

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
  ].filter(Boolean) as ActiveFilter[];
  // Nothing in the dates (the current year first): say so, and where to change them.
  const empty =
    range.from && range.to && !filters.search
      ? t("products.noLineInDates", { from: formatDate(range.from), to: formatDate(range.to) })
      : t("products.noMovement");

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        search={{ value: filters.search, onChange: setSearch, placeholder: t("products.movementsSearchPh") }}
        dateRange={{
          from: range.from,
          to: range.to,
          // Other dates: back to page 1 (page 3 of a shorter period would look empty).
          onChange: (from, to) => {
            onRange(from, to);
            setPage(1);
          },
        }}
        segment={{ value: filters.kind, onChange: setKind, options: kinds }}
        extra={
          <div className="flex items-center gap-2" role="group" aria-label={t("products.sortLabel")}>
            <span className="text-sm font-medium text-muted-foreground">{t("products.sortLabel")}</span>
            <Segmented value={filters.order} options={orders} onChange={setOrder} />
          </div>
        }
        activeFilters={activeFilters}
        onResetAll={reset}
      />

      {/* No line: the list alone (its message says to change the dates), no « Détails de la ligne ». */}
      <div className={cn("grid items-start gap-4", hasLines && "lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]")}>
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
          emptyTitle={empty}
          rowKey={keyOf}
          onRowClick={(m) => setPicked({ list: listKey, key: keyOf(m) })}
          isRowSelected={(m) => selected != null && keyOf(m) === keyOf(selected)}
        />
        {hasLines && (
          <SectionCard title={t("products.lineDetail")}>
            {selected ? (
              <LineDetail line={selected} tva={sheet.tva} canSeeDetail={canSeeDetail} seeDetail={seeDetail} />
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("products.pickLine")}</p>
            )}
          </SectionCard>
        )}
      </div>
    </div>
  );
}
