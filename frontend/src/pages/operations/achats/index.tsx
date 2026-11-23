import { useEffect } from "react";
import { Download, Upload } from "lucide-react";

import { FilterBar } from "@/_components/organisms/FilterBar";
import { ROUTES } from "@/types";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { formatMAD, formatQty, formatPct } from "@/utils/format";

import { useAchatsPage } from "./hooks";
import { SuffixBadge } from "@/_components/molecules/SuffixBadge";
import { DataTable, type ColumnDef, type DataTablePagination } from "@/_components/organisms/DataTable";
import type { AchatRow, AchatsSupplierSummary } from "@/types";
import { GaugeTiles } from "@/_components/organisms/GaugeTiles";
import { Page } from "@/_components/templates/Page";
import { LedgerFooter } from "../_components/LedgerFooter";
import { ledgerActiveFilters, ledgerProductColumns } from "../_components/ledgerColumns";

interface AchatsTableProps {
  rows: AchatRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  sortBy: string | null;
  sortOrder: "asc" | "desc";
  onSort: (key: string) => void;
  pagination: DataTablePagination;
}

const buildColumns = (t: TFn): ColumnDef<AchatRow>[] => [
  {
    key: "delivery_date",
    label: t("col.dateBL"),
    width: 110,
    render: (r) => (
      <span className="font-mono text-sm tabular-nums text-muted-foreground">{r.delivery_date ?? "—"}</span>
    ),
  },
  {
    key: "delivery_ref",
    label: t("col.reference"),
    width: 170,
    render: (r) =>
      r.delivery_ref ? (
        <span className="flex items-center">
          <span className="rounded border border-border bg-surface-subtle px-1.5 py-px font-mono text-xs">
            {r.delivery_ref}
          </span>
          {r.delivery_ref_final && r.delivery_ref_final !== r.delivery_ref && (
            <SuffixBadge text={r.delivery_ref_final.slice(r.delivery_ref.length)} color={r.delivery_ref_color} />
          )}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: "supplier",
    label: t("col.fournisseur"),
    width: 200,
    render: (r) =>
      r.supplier ? (
        <span className="truncate text-base" title={r.supplier}>
          {r.supplier}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  ...ledgerProductColumns<AchatRow>(t, { productWidth: 260, typeKey: "category_type" }),
  {
    key: "pph",
    label: t("col.pph"),
    width: 100,
    align: "right",
    render: (r) => <span className="text-muted-foreground">{r.pph != null ? formatMAD(r.pph) : "—"}</span>,
  },
  {
    key: "unit_price",
    label: t("col.puAchat"),
    width: 110,
    align: "right",
    render: (r) => (r.unit_price != null ? formatMAD(r.unit_price) : "—"),
  },
  {
    key: "expiry_date",
    label: t("col.peremption"),
    width: 110,
    align: "right",
    render: (r) => <span className="font-mono text-sm tabular-nums text-muted-foreground">{r.expiry_date ?? "—"}</span>,
  },
  {
    key: "total",
    label: t("col.total"),
    width: 110,
    align: "right",
    render: (r) => <span className="font-semibold">{r.total != null ? formatMAD(r.total) : "—"}</span>,
  },
];

function AchatsTable({ rows, isLoading, isError, onRetry, sortBy, sortOrder, onSort, pagination }: AchatsTableProps) {
  const t = useT();
  return (
    <DataTable<AchatRow>
      rows={rows}
      columns={buildColumns(t)}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      sortBy={sortBy ?? undefined}
      sortOrder={sortOrder}
      onSort={onSort}
      pagination={pagination}
      emptyTitle={t("achats.empty")}
      emptyHint={t("achats.emptyHint")}
      rowKey={(r) => r.id}
    />
  );
}

function SupplierGauge({ data, isLoading }: { data: AchatsSupplierSummary | undefined; isLoading?: boolean }) {
  const t = useT();
  const grossiste = data?.grossiste ?? { total_mad: 0, bl_count: 0, unit_count: 0 };
  const directLabo = data?.direct_labo ?? { total_mad: 0, bl_count: 0, unit_count: 0 };

  const total = grossiste.total_mad + directLabo.total_mad;
  const grossPct = total > 0 ? (grossiste.total_mad / total) * 100 : 0;
  const side = (title: string, x: typeof grossiste) => ({
    title,
    value: formatMAD(x.total_mad),
    sub: (
      <>
        {formatQty(x.bl_count)} BL · {formatQty(x.unit_count)} {t("kpi.unites")}
      </>
    ),
  });

  // More direct laboratoire = healthier supplier mix (green end of the needle).
  return (
    <GaugeTiles
      isLoading={isLoading && !data}
      left={side(t("achats.grossistes"), grossiste)}
      right={side(t("achats.directLabo"), directLabo)}
      goodness={100 - grossPct}
      caption={
        <>
          <span className="font-mono tabular-nums text-foreground">{formatPct(grossPct)}</span>{" "}
          {t("achats.grossistesInline")}
        </>
      }
      summary={[
        { label: t("achats.sommeCommandee"), value: formatMAD(total) },
        { label: t("achats.bl"), value: formatQty(grossiste.bl_count + directLabo.bl_count) },
        { label: t("col.unites"), value: formatQty(grossiste.unit_count + directLabo.unit_count) },
      ]}
    />
  );
}

export default function AchatsPage() {
  const t = useT();
  const {
    categories,
    clearRef,
    filters,
    handleExport,
    isError,
    isLoading,
    list,
    reload,
    reset,
    setCategories,
    setDateRange,
    setPage,
    setPageSize,
    setSearch,
    setSort,
    setSuggestQ,
    setTva,
    suggestions,
    suggestionsLoading,
    supplierLoading,
    supplierSummary,
    tvaRates,
  } = useAchatsPage();

  // Wire search → suggestions debounce trigger. Same pattern as Ventes.
  useEffect(() => {
    setSuggestQ(filters.search);
  }, [filters.search, setSuggestQ]);

  const summary = list?.summary;
  const totalRows = list?.pagination.total ?? 0;

  // Build active filter pills array — empty when no filter set, FilterBar hides the row.
  const activeFilters = ledgerActiveFilters(t, filters, {
    refLabel: t("achats.blFilter"),
    clearRef,
    setSearch,
    setDateRange,
    setCategories,
    setTva,
  });

  return (
    <Page title={t("achats.title")} subtitle={t("achats.subtitle")}>
      <FilterBar
        search={{
          value: filters.search,
          onChange: setSearch,
          placeholder: t("achats.searchPh"),
          suggestions: suggestions
            ? {
                [t("col.produit")]: suggestions.products,
                [t("col.fournisseur")]: suggestions.suppliers,
                [t("col.reference")]: suggestions.refs,
              }
            : null,
          onPick: (label) => {
            setSearch(label);
            setSuggestQ("");
          },
          isLoading: suggestionsLoading,
        }}
        dateRange={{
          from: filters.date_from,
          to: filters.date_to,
          onChange: setDateRange,
        }}
        multiSelects={[
          { label: t("col.categorie"), options: categories, selected: filters.category, onChange: setCategories },
          { label: t("col.tva"), options: tvaRates, selected: filters.tva, onChange: setTva },
        ]}
        rightActions={[
          {
            label: t("common.export"),
            icon: <Download className="size-4" />,
            variant: "outline",
            onClick: handleExport,
          },
          {
            label: t("common.import"),
            icon: <Upload className="size-4" />,
            variant: "primary",
            href: `${ROUTES.UPLOAD_FILE}?type=achat`,
          },
        ]}
        activeFilters={activeFilters}
        onResetAll={reset}
      />

      <SupplierGauge data={supplierSummary} isLoading={supplierLoading} />

      <AchatsTable
        rows={list?.data ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={reload}
        sortBy={filters.sort_by}
        sortOrder={filters.sort_order}
        onSort={setSort}
        pagination={{
          page: filters.page,
          pageSize: filters.limit,
          total: totalRows,
          onPage: setPage,
          onPageSize: setPageSize,
        }}
      />

      {/* Summary footer — TVA payé + CA total over the FULL filtered set */}
      {(list?.data ?? []).length > 0 && summary && (
        <LedgerFooter
          t={t}
          tvaLabel={t("achats.tvaPaye")}
          tva={summary.tva_payee}
          totalLabel={t("achats.totalFooter")}
          total={summary.grand_total}
        />
      )}
    </Page>
  );
}
