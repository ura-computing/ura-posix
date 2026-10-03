import { useEffect } from "react";
import { Download, Upload } from "lucide-react";

import { FilterBar, type ActiveFilter } from "@/_components/filterBar";
import { ROUTES, SURVEILLANCE_TABS } from "@/types";
import { formatMAD, formatQty, formatPct } from "@/utils/format";

import { useVentesPage } from "./hooks";
import { useT, type TFn } from "@/i18n/I18nProvider";
import type { ReactNode } from "react";
import { NeedleGauge } from "@/_components/NeedleGauge";
import { Skeleton } from "@/_components/Skeleton";
import type { VentesDiscountSummary, SurveillanceTab, VentesSurveillanceCounts, VenteRow } from "@/types";
import { SuffixBadge } from "@/_components/SuffixBadge";
import { DataTable, type ColumnDef, type DataTablePagination } from "@/_components/DataTable";
import { TypeBadge } from "@/_components/TypeBadge";

/** Remise gauge. Per the manager's framing on this pharmacy, granting a
 *  remise is treated as the *desirable* outcome — so "Avec remise" sits on
 *  the right (emerald) and the needle goes greener as the discounted share
 *  rises. "Sans remise" sits on the left (rose). Goodness = discounted %. */
function DiscountGauge({ data, isLoading }: { data: VentesDiscountSummary | undefined; isLoading?: boolean }) {
  const t = useT();
  if (isLoading && !data) return <GaugeSkeleton />;
  const discounted = data?.discounted ?? { total_mad: 0, count: 0, unit_count: 0 };
  const fullPrice = data?.full_price ?? { total_mad: 0, count: 0, unit_count: 0 };

  const total = discounted.total_mad + fullPrice.total_mad;
  const discPct = total > 0 ? (discounted.total_mad / total) * 100 : 0;
  const totalLines = discounted.count + fullPrice.count;
  const totalUnits = discounted.unit_count + fullPrice.unit_count;

  // NeedleGauge expects 0-100 "goodness": 0=left/red, 100=right/green.
  const goodness = discPct;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
        <SideTile
          title={t("ventes.sansRemise")}
          value={formatMAD(fullPrice.total_mad)}
          sub={
            <>
              {formatQty(fullPrice.count)} {t("common.wLignes")} · {formatQty(fullPrice.unit_count)}{" "}
              {t("common.wUnites")}
            </>
          }
          accent="border-l-rose-500/70"
        />
        <div className="flex flex-col items-center justify-end">
          <NeedleGauge value={goodness} />
          <p className="-mt-1 text-sm font-medium text-muted-foreground">
            <span className="font-mono tabular-nums text-foreground">{formatPct(discPct)}</span>{" "}
            {t("ventes.avecRemiseInline")}
          </p>
        </div>
        <SideTile
          title={t("ventes.avecRemise")}
          value={formatMAD(discounted.total_mad)}
          sub={
            <>
              {formatQty(discounted.count)} {t("common.wLignes")} · {formatQty(discounted.unit_count)}{" "}
              {t("common.wUnites")}
            </>
          }
          accent="border-l-emerald-500/70"
          alignRight
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
        <SummaryTile label={t("ventes.caTotal")} value={formatMAD(total)} />
        <SummaryTile label={t("kpi.transactions")} value={formatQty(totalLines)} />
        <SummaryTile label={t("col.unites")} value={formatQty(totalUnits)} />
      </div>
    </div>
  );
}

function GaugeSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-2 pl-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-20 w-40 rounded-t-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex flex-col items-end gap-2 pr-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SideTile({
  title,
  value,
  sub,
  accent,
  alignRight = false,
}: {
  title: string;
  value: ReactNode;
  sub: ReactNode;
  accent: string;
  alignRight?: boolean;
}) {
  return (
    <div
      className={`border-l-2 ${accent} pl-3 ${alignRight ? "md:text-right md:border-l-0 md:border-r-2 md:pl-0 md:pr-3" : ""}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{sub}</p>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">{value}</span>
    </div>
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
          <button
            key={tab.key}
            type="button"
            onClick={() => onSelect(isActive ? null : tab.key)}
            className={`inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors ${
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-surface-subtle"
            }`}
          >
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
          </button>
        );
      })}
    </div>
  );
}

interface VentesTableProps {
  rows: VenteRow[];
  isLoading: boolean;
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
  {
    key: "product",
    label: t("col.produit"),
    width: 240,
    render: (r) => (
      <div className="flex flex-col">
        <span className="truncate text-base" title={r.product ?? ""}>
          {r.product ?? "—"}
        </span>
        <span className="truncate font-mono text-[11px] text-muted-foreground">{r.pid ?? ""}</span>
      </div>
    ),
  },
  {
    key: "category",
    label: t("col.categorie"),
    width: 160,
    render: (r) => (
      <span className="block max-w-[150px] truncate text-sm text-muted-foreground">{r.category ?? "—"}</span>
    ),
  },
  {
    key: "type",
    label: t("col.type"),
    width: 110,
    sortable: false,
    render: (r) => <TypeBadge type={r.category_type} />,
  },
  {
    key: "tva",
    label: t("col.tva"),
    width: 80,
    sortable: false,
    render: (r) =>
      r.tva ? (
        <span className="font-mono text-xs text-muted-foreground">{r.tva}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: "quantity",
    label: t("col.qte"),
    width: 70,
    align: "right",
    render: (r) => (r.quantity != null ? formatQty(r.quantity) : "—"),
  },
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

function VentesTable({ rows, isLoading, sortBy, sortOrder, onSort, pagination }: VentesTableProps) {
  const t = useT();
  return (
    <DataTable<VenteRow>
      rows={rows}
      columns={buildColumns(t)}
      isLoading={isLoading}
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
  const {
    categories,
    counts,
    discountLoading,
    discountSummary,
    filters,
    handleExport,
    isLoading,
    list,
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

  // Wire search → suggestions debounce trigger. Keeps SearchAutocomplete decoupled from the API layer.
  useEffect(() => {
    setSuggestQ(filters.search);
  }, [filters.search, setSuggestQ]);

  const summary = list?.summary;
  const totalRows = list?.pagination.total ?? 0;

  // Active filter pills (surveillance has its own dedicated tab row, so it stays out of this array).
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
    filters.category.length > 0
      ? {
          key: "category",
          label: (
            <>
              {t("dashboard.categorieFilter")} {filters.category[0]}
              {filters.category.length > 1 ? `, +${filters.category.length - 1}` : ""}
            </>
          ),
          onClear: () => setCategories([]),
        }
      : null,
    filters.tva.length > 0
      ? {
          key: "tva",
          label: (
            <>
              {t("common.tvaFilter")} {filters.tva.length}
            </>
          ),
          onClear: () => setTva([]),
        }
      : null,
  ].filter(Boolean) as ActiveFilter[];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("ventes.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("ventes.subtitle")}</p>
      </header>

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
            href: `${ROUTES.UPLOAD_FILE}?type=vente`,
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
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 px-4 py-2 text-xs">
          <span className="text-muted-foreground">
            {t("ventes.tvaEncFooter")} <span className="text-foreground/60">{t("common.filtresActifs")}</span> :
            <span className="ml-1 font-mono tabular-nums font-semibold text-foreground">
              {formatMAD(summary.tva_collected)}
            </span>
            <span className="mx-2 text-foreground/40">·</span>
            {t("ventes.caFooter")}
            <span className="ml-1 font-mono tabular-nums font-semibold text-foreground">
              {formatMAD(summary.grand_total)}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
