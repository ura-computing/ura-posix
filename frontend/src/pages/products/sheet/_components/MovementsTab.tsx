/** « Mouvements »: every purchase (+) and sale (−) line of the product, newest first: type,
 *  period (shared with the other pages), search; 10 per page. « Voir détail » = the whole
 *  ticket (Ventes) or BL (Achats) of that line. */
import { ExternalLink } from "lucide-react";

import { Button } from "@/_components/button";
import { DataTable, type ColumnDef } from "@/_components/DataTable";
import { FilterBar, type ActiveFilter } from "@/_components/filterBar";
import type { ProductMovementLine, ProductSheet } from "@/types";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { formatDate, formatMAD, formatPct, formatQty } from "@/utils/format";

import { useMovements } from "../hooks";
import { tvaShort } from "../labels";
import { KindBadge } from "./KindBadge";

const ACTIVE = "bg-primary text-primary-foreground shadow-sm";
const dash = <span className="text-muted-foreground">—</span>;
const mad = (n: number | null) => (n != null ? <span className="whitespace-nowrap">{formatMAD(n)}</span> : dash);

// No fixed widths: the columns fit the page (no sideways scroll on a laptop screen).
const columns = (
  t: TFn,
  tva: string | null,
  canSeeDetail: (kind: ProductMovementLine["kind"]) => boolean,
  seeDetail: (m: ProductMovementLine) => void,
): ColumnDef<ProductMovementLine>[] => [
  { key: "date", label: t("col.date"), sortable: false, render: (m) => formatDate(m.date) },
  { key: "kind", label: t("col.type"), sortable: false, render: (m) => <KindBadge kind={m.kind} /> },
  { key: "document", label: t("col.reference"), sortable: false, render: (m) => m.document ?? dash },
  { key: "party", label: t("products.colParty"), sortable: false, render: (m) => m.party ?? dash },
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
  {
    key: "discount",
    label: t("col.remise"),
    align: "right",
    sortable: false,
    // A purchase has no remise; a sale without one = 0 %.
    render: (m) => (m.kind === "achat" ? dash : formatPct(m.discount ?? 0)),
  },
  { key: "tva", label: t("col.tva"), sortable: false, render: () => (tva ? tvaShort(tva) : dash) },
  { key: "total", label: t("col.total"), align: "right", sortable: false, render: (m) => mad(m.total) },
  {
    key: "action",
    label: t("products.colAction"),
    sortable: false,
    render: (m) => (
      <Button
        variant="outline"
        size="sm"
        onClick={() => seeDetail(m)}
        disabled={!m.document || !canSeeDetail(m.kind)}
        title={t(m.kind === "achat" ? "products.seeBl" : "products.seeTicket", { ref: m.document ?? "" })}
      >
        <ExternalLink className="size-3.5" />
        {t("products.seeDetail")}
      </Button>
    ),
  },
];

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
    setPage,
    setPageSize,
    setSearch,
    total,
  } = useMovements(sheet.id);

  const kinds = [
    { value: "all" as const, label: t("products.kindAll"), activeBg: ACTIVE },
    { value: "vente" as const, label: t("nav.ventes"), activeBg: ACTIVE },
    { value: "achat" as const, label: t("nav.achats"), activeBg: ACTIVE },
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

      <DataTable<ProductMovementLine>
        rows={rows}
        columns={columns(t, sheet.tva, canSeeDetail, seeDetail)}
        isLoading={isLoading}
        pagination={{
          page: filters.page,
          pageSize: filters.limit,
          total,
          onPage: setPage,
          onPageSize: setPageSize,
        }}
        emptyTitle={t("products.noMovement")}
        rowKey={(_, i) => i}
      />
    </div>
  );
}
