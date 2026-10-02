import { useEffect } from "react";
import { Download, Upload } from "lucide-react";

import { FilterBar, type ActiveFilter } from "@/_components/filterBar";
import { ROUTES } from "@/types";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { formatMAD, formatQty, formatPct } from "@/utils/format";

import { useAchatsPage }   from "./hooks";
import { SuffixBadge } from "@/_components/SuffixBadge";
import { DataTable, type ColumnDef, type DataTablePagination } from "@/_components/DataTable";
import type { AchatRow, AchatsSupplierSummary } from "@/types";
import type { ReactNode } from "react";
import { NeedleGauge } from "@/_components/NeedleGauge";
import { Skeleton } from "@/_components/Skeleton";
import { TypeBadge } from "@/_components/TypeBadge";

interface AchatsTableProps {
  rows: AchatRow[];
  isLoading: boolean;
  sortBy: string | null;
  sortOrder: "asc" | "desc";
  onSort: (key: string) => void;
  pagination: DataTablePagination;
}

const buildColumns = (t: TFn): ColumnDef<AchatRow>[] => [
  {
    key: "delivery_date", label: t("col.dateBL"), width: 110,
    render: (r) => <span className="font-mono text-sm tabular-nums text-muted-foreground">{r.delivery_date ?? "—"}</span>
  },
  {
    key: "delivery_ref", label: t("col.reference"), width: 170,
    render: (r) => r.delivery_ref ? (
      <span className="flex items-center">
        <span className="rounded border border-border bg-surface-subtle px-1.5 py-px font-mono text-xs">{r.delivery_ref}</span>
        {r.delivery_ref_final && r.delivery_ref_final !== r.delivery_ref && (
          <SuffixBadge text={r.delivery_ref_final.slice(r.delivery_ref.length)} color={r.delivery_ref_color} />
        )}
      </span>
    ) : <span className="text-muted-foreground">—</span>
  },
  {
    key: "supplier", label: t("col.fournisseur"), width: 200,
    render: (r) => r.supplier ? <span className="truncate text-base" title={r.supplier}>{r.supplier}</span> : <span className="text-muted-foreground">—</span>
  },
  {
    key: "product", label: t("col.produit"), width: 260,
    render: (r) => (
      <div className="flex flex-col">
        <span className="truncate text-base" title={r.product ?? ""}>{r.product ?? "—"}</span>
        <span className="truncate font-mono text-[11px] text-muted-foreground">{r.pid ?? ""}</span>
      </div>
    )
  },
  {
    key: "category", label: t("col.categorie"), width: 160,
    render: (r) => <span className="block max-w-[150px] truncate text-sm text-muted-foreground">{r.category ?? "—"}</span>
  },
  {
    key: "category_type", label: t("col.type"), width: 110, sortable: false,
    render: (r) => <TypeBadge type={r.category_type} />
  },
  {
    key: "tva", label: t("col.tva"), width: 80, sortable: false,
    render: (r) => r.tva ? <span className="font-mono text-xs text-muted-foreground">{r.tva}</span> : <span className="text-muted-foreground">—</span>
  },
  {
    key: "quantity", label: t("col.qte"), width: 70, align: "right",
    render: (r) => r.quantity != null ? formatQty(r.quantity) : "—"
  },
  {
    key: "pph", label: t("col.pph"), width: 100, align: "right",
    render: (r) => <span className="text-muted-foreground">{r.pph != null ? formatMAD(r.pph) : "—"}</span>
  },
  {
    key: "unit_price", label: t("col.puAchat"), width: 110, align: "right",
    render: (r) => r.unit_price != null ? formatMAD(r.unit_price) : "—"
  },
  {
    key: "expiry_date", label: t("col.peremption"), width: 110, align: "right",
    render: (r) => <span className="font-mono text-sm tabular-nums text-muted-foreground">{r.expiry_date ?? "—"}</span>
  },
  {
    key: "total", label: t("col.total"), width: 110, align: "right",
    render: (r) => <span className="font-semibold">{r.total != null ? formatMAD(r.total) : "—"}</span>
  },
];

function AchatsTable({ rows, isLoading, sortBy, sortOrder, onSort, pagination }: AchatsTableProps) {
  const t = useT();
  return (
    <DataTable<AchatRow>
      rows={rows}
      columns={buildColumns(t)}
      isLoading={isLoading}
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
  if (isLoading && !data) return <GaugeSkeleton />;
  const grossiste = data?.grossiste ?? { total_mad: 0, bl_count: 0, unit_count: 0 };
  const directLabo = data?.direct_labo ?? { total_mad: 0, bl_count: 0, unit_count: 0 };

  const total = grossiste.total_mad + directLabo.total_mad;
  const grossPct = total > 0 ? (grossiste.total_mad / total) * 100 : 0;
  const totalBl = grossiste.bl_count + directLabo.bl_count;
  const totalUnits = grossiste.unit_count + directLabo.unit_count;

  // NeedleGauge expects 0-100 "goodness": 0=left/red, 100=right/green.
  // For Achats, more direct laboratoire = more healthy supplier mix.
  const goodness = 100 - grossPct;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {/* Top row: grossistes tile · gauge · direct labo tile */}
      <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
        <SideTile
          title={t("achats.grossistes")}
          value={formatMAD(grossiste.total_mad)}
          sub={<>{formatQty(grossiste.bl_count)} BL · {formatQty(grossiste.unit_count)} {t("kpi.unites")}</>}
          accent="border-l-rose-500/70"
        />
        <div className="flex flex-col items-center justify-end">
          <NeedleGauge value={goodness} />
          <p className="-mt-1 text-sm font-medium text-muted-foreground">
            <span className="font-mono tabular-nums text-foreground">{formatPct(grossPct)}</span> {t("achats.grossistesInline")}
          </p>
        </div>
        <SideTile
          title={t("achats.directLabo")}
          value={formatMAD(directLabo.total_mad)}
          sub={<>{formatQty(directLabo.bl_count)} BL · {formatQty(directLabo.unit_count)} {t("kpi.unites")}</>}
          accent="border-l-emerald-500/70"
          alignRight
        />
      </div>

      {/* 3 summary tiles under the gauge */}
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
        <SummaryTile label={t("achats.sommeCommandee")} value={formatMAD(total)} />
        <SummaryTile label={t("achats.bl")} value={formatQty(totalBl)} />
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
          <Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-32" /><Skeleton className="h-3 w-24" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-20 w-40 rounded-t-full" /><Skeleton className="h-3 w-24" />
        </div>
        <div className="flex flex-col items-end gap-2 pr-3">
          <Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-32" /><Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="h-3 w-16" /><Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SideTile({ title, value, sub, accent, alignRight = false }: {
  title: string; value: ReactNode; sub: ReactNode; accent: string; alignRight?: boolean;
}) {
  return (
    <div className={`border-l-2 ${accent} pl-3 ${alignRight ? "md:text-right md:border-l-0 md:border-r-2 md:pl-0 md:pr-3" : ""}`}>
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

export default function AchatsPage() {
  const t = useT();
  const p = useAchatsPage();

  // Wire search → suggestions debounce trigger. Same pattern as Ventes.
  useEffect(() => { p.setSuggestQ(p.filters.search); }, [p.filters.search, p]);

  const summary    = p.list?.summary;
  const totalRows  = p.list?.pagination.total ?? 0;

  // Build active filter pills array — empty when no filter set, FilterBar hides the row.
  const activeFilters: ActiveFilter[] = [
    p.filters.search ? {
      key: "search",
      label: <>{t("common.recherche")} {p.filters.search}</>,
      onClear: () => p.setSearch(""),
    } : null,
    (p.filters.date_from || p.filters.date_to) ? {
      key: "dates",
      label: <>{p.filters.date_from ?? "…"} → {p.filters.date_to ?? "…"}</>,
      onClear: () => p.setDateRange(null, null),
    } : null,
    p.filters.category.length > 0 ? {
      key: "category",
      label: <>{t("dashboard.categorieFilter")} {p.filters.category[0]}{p.filters.category.length > 1 ? `, +${p.filters.category.length - 1}` : ""}</>,
      onClear: () => p.setCategories([]),
    } : null,
    p.filters.tva.length > 0 ? {
      key: "tva",
      label: <>{t("common.tvaFilter")} {p.filters.tva.length}</>,
      onClear: () => p.setTva([]),
    } : null,
  ].filter(Boolean) as ActiveFilter[];

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("achats.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("achats.subtitle")}</p>
      </header>

      <FilterBar
        search={{
          value:       p.filters.search,
          onChange:    p.setSearch,
          placeholder: t("achats.searchPh"),
          suggestions: p.suggestions ? { [t("col.produit")]: p.suggestions.products, [t("col.fournisseur")]: p.suggestions.suppliers, [t("col.reference")]: p.suggestions.refs } : null,
          onPick:      (label) => { p.setSearch(label); p.setSuggestQ(""); },
          isLoading:   p.suggestionsLoading,
        }}
        dateRange={{
          from:     p.filters.date_from,
          to:       p.filters.date_to,
          onChange: p.setDateRange,
        }}
        multiSelects={[
          { label: t("col.categorie"), options: p.categories, selected: p.filters.category, onChange: p.setCategories },
          { label: t("col.tva"),       options: p.tvaRates,   selected: p.filters.tva,      onChange: p.setTva },
        ]}
        rightActions={[
          { label: t("common.export"), icon: <Download className="size-4" />, variant: "outline", onClick: p.handleExport },
          { label: t("common.import"),       icon: <Upload   className="size-4" />, variant: "primary", href: `${ROUTES.UPLOAD_FILE}?type=achat` },
        ]}
        activeFilters={activeFilters}
        onResetAll={p.reset}
      />

      <SupplierGauge data={p.supplierSummary} isLoading={p.supplierLoading} />

      <AchatsTable
        rows={p.list?.data ?? []}
        isLoading={p.isLoading}
        sortBy={p.filters.sort_by}
        sortOrder={p.filters.sort_order}
        onSort={p.setSort}
        pagination={{
          page:       p.filters.page,
          pageSize:   p.filters.limit,
          total:      totalRows,
          onPage:     p.setPage,
          onPageSize: p.setPageSize,
        }}
      />

      {/* Summary footer — TVA payé + CA total over the FULL filtered set */}
      {(p.list?.data ?? []).length > 0 && summary && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 px-4 py-2 text-xs">
          <span className="text-muted-foreground">
            {t("achats.tvaPaye")} <span className="text-foreground/60">{t("common.filtresActifs")}</span> :
            <span className="ml-1 font-mono tabular-nums font-semibold text-foreground">{formatMAD(summary.tva_payee)}</span>
            <span className="mx-2 text-foreground/40">·</span>
            {t("achats.totalFooter")}
            <span className="ml-1 font-mono tabular-nums font-semibold text-foreground">{formatMAD(summary.grand_total)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
