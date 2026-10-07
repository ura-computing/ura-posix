/** « Mouvements »: every purchase (+) and sale (−) line of the product, newest first, with the
 *  file it came from. Period (shared with the other pages), type, search, Excel. */
import { Download } from "lucide-react";

import { DataTable, type ColumnDef } from "@/_components/DataTable";
import { FilterBar, type ActiveFilter } from "@/_components/filterBar";
import type { ProductMovementLine, ProductSheet } from "@/types";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";
import { formatDate, formatMAD, formatNumStr, formatQty } from "@/utils/format";

import { useMovements } from "../hooks";

const ACTIVE = "bg-primary text-primary-foreground shadow-sm";
const dash = <span className="text-muted-foreground">—</span>;
const mad = (n: number | null) => (n != null ? <span className="whitespace-nowrap">{formatMAD(n)}</span> : dash);

const columns = (t: TFn): ColumnDef<ProductMovementLine>[] => [
  { key: "date", label: t("col.date"), width: 110, sortable: false, render: (m) => formatDate(m.date) },
  {
    key: "kind",
    label: t("col.type"),
    width: 80,
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
  { key: "total", label: t("col.total"), width: 110, align: "right", sortable: false, render: (m) => mad(m.total) },
  { key: "document", label: t("products.colDocument"), width: 130, sortable: false, render: (m) => m.document ?? dash },
  { key: "party", label: t("products.colParty"), width: 180, sortable: false, render: (m) => m.party ?? dash },
  {
    key: "filename",
    label: t("products.colFile"),
    width: 220,
    sortable: false,
    render: (m) => (
      <span className="line-clamp-1 break-all text-sm text-muted-foreground" title={m.filename ?? ""}>
        {m.filename ?? "—"}
      </span>
    ),
  },
];

export function MovementsTab({ sheet }: { sheet: ProductSheet }) {
  const t = useT();
  const {
    filters,
    handleExport,
    isLoading,
    reset,
    rows,
    setDateRange,
    setKind,
    setPage,
    setPageSize,
    setSearch,
    total,
    unitsBought,
    unitsSold,
  } = useMovements(sheet.id, sheet.pid);

  const kinds = [
    { value: "all" as const, label: t("products.kindAll"), activeBg: ACTIVE },
    { value: "achat" as const, label: t("nav.achats"), activeBg: ACTIVE },
    { value: "vente" as const, label: t("nav.ventes"), activeBg: ACTIVE },
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
        rightActions={[
          {
            label: t("common.export"),
            icon: <Download className="size-4" />,
            variant: "outline",
            onClick: handleExport,
          },
        ]}
        activeFilters={activeFilters}
        onResetAll={reset}
      />

      <p className="text-sm text-muted-foreground">
        {t("products.movementsSummary", { bought: formatNumStr(unitsBought), sold: formatNumStr(unitsSold) })}
      </p>

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
        }}
        emptyTitle={t("products.noMovement")}
        rowKey={(_, i) => i}
      />
    </div>
  );
}
