/** /produits — every product of the pharmacy: in its last stock import, sold or bought.
 *  « Vendus 12 mois », stock and marge follow the Stock page's rules (same numbers). */
import { Download } from "lucide-react";
import { Link } from "react-router-dom";

import { useCategoryTypeOptions } from "@/_components/CategorySegment";
import { DataTable, type ColumnDef } from "@/_components/DataTable";
import { FilterBar, type ActiveFilter } from "@/_components/filterBar";
import { Page } from "@/_components/Page";
import { TypeBadge } from "@/_components/TypeBadge";
import { ROUTES, type ProductRow } from "@/types";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { formatDate, formatMAD, formatPct, formatQty } from "@/utils/format";

import { ProductPhoto } from "../_components/ProductPhoto";
import { useProduitsPage } from "./hooks";

const buildColumns = (t: TFn): ColumnDef<ProductRow>[] => [
  {
    key: "product",
    label: t("col.produit"),
    width: 370,
    render: (r) => (
      // The whole block (photo + name) opens the product sheet.
      <Link to={`${ROUTES.PRODUITS}/${r.id}`} className="group flex items-center gap-3">
        <ProductPhoto key={r.photo} src={r.photo} name={r.product} className="size-10" />
        <div className="flex min-w-0 flex-col">
          <span
            className="line-clamp-1 break-all text-base group-hover:text-primary group-hover:underline"
            title={r.product}
          >
            {r.product}
          </span>
          <span className="truncate font-mono text-[11px] text-muted-foreground">{r.pid}</span>
        </div>
      </Link>
    ),
  },
  {
    key: "laboratoire",
    label: t("col.laboratoire"),
    width: 140,
    render: (r) => (
      <span className="line-clamp-1 break-all text-sm text-muted-foreground" title={r.laboratoire ?? ""}>
        {r.laboratoire ?? "—"}
      </span>
    ),
  },
  {
    key: "category",
    label: t("col.categorie"),
    width: 182,
    render: (r) => (
      <span className="line-clamp-1 break-all text-sm text-muted-foreground" title={r.category ?? ""}>
        {r.category ?? "—"}
      </span>
    ),
  },
  {
    key: "category_type",
    label: t("col.type"),
    width: 88,
    sortable: false,
    render: (r) => <TypeBadge type={r.category_type} />,
  },
  {
    key: "current_stock",
    label: t("col.stock"),
    width: 56,
    align: "right",
    render: (r) => (r.current_stock != null ? formatQty(r.current_stock) : "—"),
  },
  {
    key: "units_sold_12m",
    label: t("products.vendus12m"),
    width: 84,
    align: "right",
    render: (r) => formatQty(r.units_sold_12m),
  },
  {
    key: "ppv",
    label: t("col.ppv"),
    width: 88,
    align: "right",
    render: (r) => <span className="whitespace-nowrap">{r.ppv != null ? formatMAD(r.ppv) : "—"}</span>,
  },
  {
    key: "marge_pct",
    label: t("col.margePct"),
    width: 72,
    align: "right",
    render: (r) => <span className="whitespace-nowrap">{r.marge_pct != null ? formatPct(r.marge_pct) : "—"}</span>,
  },
];

export default function ProduitsPage() {
  const t = useT();
  const categoryTypeOptions = useCategoryTypeOptions();
  const {
    filters,
    handleExport,
    isLoading,
    reset,
    rows,
    salesFrom,
    salesTo,
    setCategoryType,
    setPage,
    setPageSize,
    setSearch,
    setSort,
    total,
  } = useProduitsPage();

  const activeFilters: ActiveFilter[] = filters.search
    ? [
        {
          key: "search",
          label: (
            <>
              {t("common.recherche")} {filters.search}
            </>
          ),
          onClear: () => setSearch(""),
        },
      ]
    : [];

  return (
    <Page title={t("products.title")} subtitle={t("products.subtitle")}>
      <FilterBar
        search={{ value: filters.search, onChange: setSearch, placeholder: t("products.searchPh") }}
        segment={{ value: filters.category_type, onChange: setCategoryType, options: categoryTypeOptions }}
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

      {salesFrom && salesTo && (
        <p className="text-xs text-muted-foreground">
          {t("products.salesWindow", { from: formatDate(salesFrom), to: formatDate(salesTo) })}
        </p>
      )}

      <DataTable<ProductRow>
        rows={rows}
        columns={buildColumns(t)}
        isLoading={isLoading}
        sortBy={filters.sort_by ?? undefined}
        sortOrder={filters.sort_order}
        onSort={setSort}
        pagination={{
          page: filters.page,
          pageSize: filters.limit,
          total,
          onPage: setPage,
          onPageSize: setPageSize,
        }}
        emptyTitle={t("products.empty")}
        emptyHint={t("products.emptyHint")}
        rowKey={(r) => r.id}
      />
    </Page>
  );
}
