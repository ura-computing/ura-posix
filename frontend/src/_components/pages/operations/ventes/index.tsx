import { useMe } from "@/hooks/useMe";
import { useEffect } from "react";
import { Download, Upload } from "lucide-react";

import { FilterBar } from "@/_components/organisms/FilterBar";
import { SURVEILLANCE_TABS } from "@/types";
import { formatMAD, formatQty, formatPct } from "@/utils/format";

import { useVentesPage } from "./hooks";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { GaugeTiles } from "@/_components/organisms/GaugeTiles";
import type { VentesDiscountSummary, SurveillanceTab, VentesSurveillanceCounts, VenteRow } from "@/types";
import { SuffixBadge } from "@/_components/molecules/SuffixBadge";
import { DataTable, type ColumnDef, type DataTablePagination } from "@/_components/organisms/DataTable";
import { Page } from "@/_components/templates/Page";
import { ToggleChip } from "@/_components/molecules/ToggleChip";
import { LedgerFooter } from "../_components/LedgerFooter";
import { ledgerActiveFilters, ledgerProductColumns } from "../_components/ledgerColumns";

/** Remise gauge. Per the manager's framing on this pharmacy, granting a
 *  remise is treated as the *desirable* outcome — so "Avec remise" sits on
 *  the right (emerald) and the needle goes greener as the discounted share
 *  rises. "Sans remise" sits on the left (rose). Goodness = discounted %. */
function DiscountGauge({ data, isLoading }: { data: VentesDiscountSummary | undefined; isLoading?: boolean }) {
  const t = useT();
  const discounted = data?.discounted ?? { total_mad: 0, count: 0, unit_count: 0 };
  const fullPrice = data?.full_price ?? { total_mad: 0, count: 0, unit_count: 0 };

  const total = discounted.total_mad + fullPrice.total_mad;
  const discPct = total > 0 ? (discounted.total_mad / total) * 100 : 0;
  const side = (title: string, x: typeof discounted) => ({
    title,
    value: formatMAD(x.total_mad),
    sub: (
      <>
        {formatQty(x.count)} {t("common.wLignes")} · {formatQty(x.unit_count)} {t("common.wUnites")}
      </>
    ),
  });

  return (
    <GaugeTiles
      isLoading={isLoading && !data}
      left={side(t("ventes.sansRemise"), fullPrice)}
      right={side(t("ventes.avecRemise"), discounted)}
      goodness={discPct}
      caption={
        <>
          <span className="font-mono tabular-nums text-foreground">{formatPct(discPct)}</span>{" "}
          {t("ventes.avecRemiseInline")}
        </>
      }
      summary={[
        { label: t("ventes.caTotal"), value: formatMAD(total) },
        { label: t("kpi.transactions"), value: formatQty(discounted.count + fullPrice.count) },
        { label: t("col.unites"), value: formatQty(discounted.unit_count + fullPrice.unit_count) },
      ]}
    />
  );
}

interface TabDef {
  key: SurveillanceTab;
  label: string;
  field: keyof VentesSurveillanceCounts;
  /** Tailwind colour class for the indicator dot only. The chip itself stays neutral. */
  dot: string;
}

const TABS: TabDef[] = [
  { key: SURVEILLANCE_TABS.ALL_FLAGGED, label: "ventes.aSurveiller", field: "all_flagged", dot: "bg-rose-500" },
  { key: SURVEILLANCE_TABS.MARGE_NEGATIVE, label: "ventes.margeNegative", field: "marge_negative", dot: "bg-red-500" },
  { key: SURVEILLANCE_TABS.MARGE_LOW, label: "ventes.margeFaible", field: "marge_low", dot: "bg-orange-500" },
  { key: SURVEILLANCE_TABS.REMISES_HIGH, label: "ventes.remiseHaute", field: "remises_high", dot: "bg-pink-500" },
];

/** Quiet quick-filter chips. Neutral card bg + colored dot as semantic indicator.
 *  Click toggles the filter. Active = filled primary. Matches Rapport's calm density. */
function SurveillanceTabs({
  active,
  counts,
  onSelect,
}: {
  active: SurveillanceTab | null;
  counts: VentesSurveillanceCounts | undefined;
  onSelect: (tab: SurveillanceTab | null) => void;
}) {
  const tr = useT();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        const n = counts?.[tab.field] ?? 0;
        return (
          <ToggleChip key={tab.key} pressed={isActive} onToggle={() => onSelect(isActive ? null : tab.key)}>
            <span
              className={`size-2 rounded-full ${tab.dot} ${isActive ? "ring-2 ring-primary-foreground/40" : ""}`}
              aria-hidden
            />
            <span>{tr(tab.label)}</span>
            <span
              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1 font-mono text-xs tabular-nums ${
                isActive ? "bg-primary-foreground/15 text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {formatQty(n)}
            </span>
          </ToggleChip>
        );
      })}
    </div>
  );
}

interface VentesTableProps {
  rows: VenteRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  sortBy: string | null;
  sortOrder: "asc" | "desc";
  onSort: (key: string) => void;
  pagination: DataTablePagination;
}

/** PPV - avg_pu => marge en DH. Color-coded per the audit:
 *    < 0 = red, < 10 % = orange, ≥ 10 % = emerald. Same thresholds as apcm-pharma. */
function MargeCell({ row, mode }: { row: VenteRow; mode: "pct" | "dh" }) {
  const { ppv, avg_pu } = row;
  if (ppv == null || avg_pu == null || ppv === 0) return <span className="text-muted-foreground">—</span>;
  const pct = (1 - avg_pu / ppv) * 100;
  const dh = ppv - avg_pu;
  const cls = pct < 0 ? "text-error" : pct < 10 ? "text-warning" : "text-success";
  return <span className={cls}>{mode === "pct" ? formatPct(pct) : formatMAD(dh)}</span>;
}

const buildColumns = (t: TFn): ColumnDef<VenteRow>[] => [
  {
    key: "date",
    label: t("col.date"),
    width: 100,
    render: (r) => <span className="font-mono text-sm tabular-nums text-muted-foreground">{r.date ?? "—"}</span>,
  },
  {
    key: "transaction_ref",
    label: t("col.transaction"),
    width: 170,
    render: (r) =>
      r.transaction_ref ? (
        <span className="flex items-center">
          <span className="rounded border border-border bg-surface-subtle px-1.5 py-px font-mono text-xs">
            {r.transaction_ref}
          </span>
          {r.transaction_ref_final && r.transaction_ref_final !== r.transaction_ref && (
            <SuffixBadge
              text={r.transaction_ref_final.slice(r.transaction_ref.length)}
              color={r.transaction_ref_color}
            />
          )}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: "client",
    label: t("col.client"),
    width: 160,
    render: (r) => (r.client ? r.client : <span className="italic text-muted-foreground">{t("ventes.anonyme")}</span>),
  },
  ...ledgerProductColumns<VenteRow>(t, { productWidth: 240, typeKey: "type" }),
  {
    key: "discount",
    label: t("col.remise"),
    width: 80,
    align: "right",
    render: (r) =>
      r.discount && r.discount > 0 ? (
        <span className="text-warning">{formatPct(r.discount)}</span>
      ) : (
        <span className="text-muted-foreground">0</span>
      ),
  },
  {
    key: "ppv",
    label: t("col.ppv"),
    width: 100,
    align: "right",
    render: (r) => (r.ppv != null ? formatMAD(r.ppv) : "—"),
  },
  {
    key: "subtotal",
    label: t("col.sousTotal"),
    width: 110,
    align: "right",
    sortable: false,
    render: (r) => (r.subtotal != null ? formatMAD(r.subtotal) : "—"),
  },
  {
    key: "total",
    label: t("col.total"),
    width: 110,
    align: "right",
    render: (r) => <span className="font-semibold">{r.total != null ? formatMAD(r.total) : "—"}</span>,
  },
  {
    key: "marge_pct",
    label: t("col.margePct"),
    width: 90,
    align: "right",
    render: (r) => <MargeCell row={r} mode="pct" />,
  },
  {
    key: "marge_dh",
    label: t("col.margeDh"),
    width: 110,
    align: "right",
    render: (r) => <MargeCell row={r} mode="dh" />,
  },
];

function VentesTable({ rows, isLoading, isError, onRetry, sortBy, sortOrder, onSort, pagination }: VentesTableProps) {
  const t = useT();
  return (
    <DataTable<VenteRow>
      rows={rows}
      columns={buildColumns(t)}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      sortBy={sortBy ?? undefined}
      sortOrder={sortOrder}
      onSort={onSort}
      pagination={pagination}
      emptyTitle={t("ventes.empty")}
      emptyHint={t("ventes.emptyHint")}
      rowKey={(r) => r.id}
    />
  );
}

export default function VentesPage() {
  const t = useT();
  const { me } = useMe();
  const role = me?.role;
  const {
    categories,
    counts,
    discountLoading,
    discountSummary,
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
    setSurveillance,
    setTva,
    suggestions,
    suggestionsLoading,
    tvaRates,
  } = useVentesPage();

  // Wire search → suggestions debounce trigger. Keeps SearchField decoupled from the API layer.
  useEffect(() => {
    setSuggestQ(filters.search);
  }, [filters.search, setSuggestQ]);

  const summary = list?.summary;
  const totalRows = list?.pagination.total ?? 0;

  // Active filter pills (surveillance has its own dedicated tab row, so it stays out of this array).
  const activeFilters = ledgerActiveFilters(t, filters, {
    refLabel: t("ventes.ticketFilter"),
    clearRef,
    setSearch,
    setDateRange,
    setCategories,
    setTva,
  });

  return (
    <Page title={t("ventes.title")} subtitle={t("ventes.subtitle")}>
      <FilterBar
        search={{
          value: filters.search,
          onChange: setSearch,
          placeholder: t("ventes.searchPh"),
          suggestions: suggestions
            ? {
                [t("col.produit")]: suggestions.products,
                [t("col.client")]: suggestions.clients,
                [t("col.transaction")]: suggestions.refs,
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
            href: `/${role}/upload-file?type=vente`,
          },
        ]}
        activeFilters={activeFilters}
        onResetAll={reset}
      />

      <DiscountGauge data={discountSummary} isLoading={discountLoading} />

      {/* Surveillance tabs */}
      <SurveillanceTabs active={filters.surveillance} counts={counts} onSelect={setSurveillance} />

      {/* Table — pagination now lives inside the shared DataTable footer */}
      <VentesTable
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

      {/* SummaryFooter — TVA encaissée from backend aggregate (full filtered set, pagination-ignored) */}
      {(list?.data ?? []).length > 0 && summary && (
        <LedgerFooter
          t={t}
          tvaLabel={t("ventes.tvaEncFooter")}
          tva={summary.tva_collected}
          totalLabel={t("ventes.caFooter")}
          total={summary.grand_total}
        />
      )}
    </Page>
  );
}
