import { useState, useMemo } from "react";
import { Link } from "react-router";
import { Download, Package, UploadCloud } from "lucide-react";
import { downloadCSV, exportFilename } from "@/utils/table";

import { ListView } from "@/components/shared/listView";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { PageFilter } from "@/components/pageFilter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ColumnDef, getCoreRowModel, useReactTable, type SortingState } from "@tanstack/react-table";
import { DataTable } from "@/components/DataTable/dataTable";
import { cn } from "@/utils/cn";
import { fmt, fmtInt } from "@/utils/format";
import { stockAbcdWindow } from "@/utils/dateRange";
import { useStockAbcd, usePeremptions } from "@/hooks/usePharmacyRapports";
import type { StockAbcdProduct, PeremptionBracket, StockStatus } from "@/api/stats";
import { GAUGE_COLORS, CLASS_COLORS } from "@/constants/theme";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CLASS_ORDER = ["A", "A-", "B+", "B", "C", "C-", "C-N", "D"];

const STATUS_OPTIONS: { value: StockStatus | "all"; label: string }[] = [
  { value: "all", label: "Tous statuts" },
  { value: "sous-stock", label: "Sous-stock (≤45 j)" },
  { value: "ideal", label: "Idéal (46-60 j)" },
  { value: "a-surveiller", label: "À surveiller (61-99 j)" },
  { value: "sur-stock", label: "Sur-stock (≥100 j)" },
  { value: "inconnu", label: "Inconnu" },
  { value: "negatif", label: "Stock négatif" },
];

/* ── ABCD circle badge ─────────────────────────────────────────────────────── */

function AbcdCircle({ cat, count, pct, active, onClick }: { cat: string; count: number; pct: string; active?: boolean; onClick?: () => void }) {
  const bg = CLASS_COLORS[cat] ?? "#6b7280";
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1 cursor-pointer">
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full text-white font-bold text-lg shadow-lg transition-all",
          active && "ring-3 ring-offset-2 ring-offset-background scale-110",
        )}
        style={{ backgroundColor: bg, ...(active ? { boxShadow: `0 0 0 3px ${bg}40` } : {}) }}
      >
        {cat}
      </div>
      <p className="text-sm font-bold tabular-nums">{count}</p>
      <p className="text-[10px] text-muted-foreground tabular-nums">{pct}</p>
    </button>
  );
}

/* ── Health gauge (0-10 scale) ─────────────────────────────────────────────── */

function HealthGauge({ score }: { score: number }) {
  const clamped = Math.min(10, Math.max(0, score));
  const angle = -90 + (clamped / 10) * 180;
  const color = clamped >= 7 ? GAUGE_COLORS.goodHex : clamped >= 4 ? GAUGE_COLORS.warnHex : GAUGE_COLORS.badHex;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-28 h-[70px]">
        <path d="M 20 100 A 80 80 0 0 1 56 28" fill="none" stroke={GAUGE_COLORS.badHex} strokeWidth="14" strokeLinecap="round" />
        <path d="M 56 28 A 80 80 0 0 1 126 20" fill="none" stroke={GAUGE_COLORS.warnHex} strokeWidth="14" />
        <path d="M 126 20 A 80 80 0 0 1 180 100" fill="none" stroke={GAUGE_COLORS.goodHex} strokeWidth="14" strokeLinecap="round" />
        <g transform={`rotate(${angle}, 100, 100)`}>
          <line x1="100" y1="100" x2="100" y2="28" stroke={GAUGE_COLORS.needleHex} strokeWidth="3" strokeLinecap="round" />
          <circle cx="100" cy="100" r="5" fill={GAUGE_COLORS.needleHex} />
          <circle cx="100" cy="100" r="2" fill="white" />
        </g>
      </svg>
      <p className="text-3xl font-black tabular-nums mt-1" style={{ color }}>{clamped.toFixed(1)}</p>
    </div>
  );
}

/* ── Metrics grid (4 values in 2x2) ────────────────────────────────────────── */

function MetricsGrid({
  refs,
  units,
  valAchat,
  ppvPot,
  labelColor = "text-muted-foreground",
  valueColor = "text-foreground",
}: {
  refs: number;
  units: number;
  valAchat: number;
  ppvPot: number;
  labelColor?: string;
  valueColor?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      <div>
        <p className={cn("text-[10px] font-medium uppercase", labelColor)}>Références</p>
        <p className={cn("text-sm font-bold tabular-nums", valueColor)}>{refs}</p>
      </div>
      <div>
        <p className={cn("text-[10px] font-medium uppercase", labelColor)}>Unités totales</p>
        <p className={cn("text-sm font-bold tabular-nums", valueColor)}>{fmtInt(units)}</p>
      </div>
      <div>
        <p className={cn("text-[10px] font-medium uppercase", labelColor)}>Valeur achats</p>
        <p className={cn("text-sm font-bold tabular-nums", valueColor)}>{fmt(valAchat)} <span className="text-[10px] font-normal">MAD</span></p>
      </div>
      <div>
        <p className={cn("text-[10px] font-medium uppercase", labelColor)}>PPV potentiel</p>
        <p className={cn("text-sm font-bold tabular-nums", valueColor)}>{fmt(ppvPot)} <span className="text-[10px] font-normal">MAD</span></p>
      </div>
    </div>
  );
}

/* ── Compute card metrics from product list ────────────────────────────────── */

function useCardMetrics(products: StockAbcdProduct[]) {
  const refs = products.length;
  const units = products.reduce((s, p) => s + Math.abs(p.current_stock ?? 0), 0);
  const valAchat = products.reduce((s, p) => {
    if (p.avg_pu == null || p.current_stock == null) return s;
    return s + p.avg_pu * Math.abs(p.current_stock);
  }, 0);
  const ppvPot = products.reduce((s, p) => {
    if (p.ppv == null || p.current_stock == null) return s;
    return s + p.ppv * Math.abs(p.current_stock);
  }, 0);
  return { refs, units, valAchat, ppvPot };
}

/* ── Main page component ───────────────────────────────────────────────────── */

const StockList = () => {
  const _initial = stockAbcdWindow();
  const [dateFrom, setDateFrom] = useState(_initial.from);
  const [dateTo, setDateTo] = useState(_initial.to);
  const [classFilter, setClassFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StockStatus | "all">("all");
  const [sorting, setSorting] = useState<SortingState>([]);
  const sortBy = sorting[0]?.id;
  const sortOrder: "asc" | "desc" | undefined = sorting[0]
    ? (sorting[0].desc ? "desc" : "asc")
    : undefined;

  const tableActive = classFilter !== null || statusFilter !== "all";

  // Full dataset — feeds the distribution chart and the alert card metrics.
  const { stockAbcd, stockAbcdLoading } = useStockAbcd(
    dateFrom || undefined,
    dateTo || undefined,
  );

  // Filtered/sorted dataset — feeds the products table when a class or status
  // filter is active.  Backend handles class+status+sort so pagination is
  // accurate across the whole dataset, not just a 20-row slice.
  const { stockAbcd: tableStock, stockAbcdLoading: tableLoading } = useStockAbcd(
    dateFrom || undefined,
    dateTo || undefined,
    {
      classFilter: classFilter ?? undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
      sortBy,
      sortOrder,
    },
  );

  const { peremptions, peremptionsLoading } = usePeremptions(
    dateFrom || undefined,
    dateTo || undefined,
  );

  const distData = useMemo(() => {
    if (!stockAbcd?.distribution) return [];
    const total = stockAbcd.total_references || 1;
    return CLASS_ORDER
      .map((c) => ({
        cat: c,
        count: stockAbcd.distribution[c] ?? 0,
        pct: `${(((stockAbcd.distribution[c] ?? 0) / total) * 100).toFixed(1)}%`,
      }));
  }, [stockAbcd]);

  const healthScore = useMemo(() => {
    if (!stockAbcd?.products || stockAbcd.products.length === 0) return 0;
    const withStock = stockAbcd.products.filter((p) => p.status !== "inconnu");
    if (withStock.length === 0) return 0;
    const healthy = withStock.filter((p) => p.status === "ideal").length;
    return (healthy / withStock.length) * 10;
  }, [stockAbcd]);

  const stockNegatif = useMemo(
    () => stockAbcd?.products?.filter((p) => p.status === "negatif") ?? [],
    [stockAbcd],
  );

  const sousStockAA = useMemo(
    () => stockAbcd?.products?.filter(
      (p) => (p.category === "A" || p.category === "A-") && p.status === "sous-stock",
    ) ?? [],
    [stockAbcd],
  );

  const surStock100 = useMemo(
    () => stockAbcd?.products?.filter((p) => p.status === "sur-stock") ?? [],
    [stockAbcd],
  );

  const negMetrics = useCardMetrics(stockNegatif);
  const sousMetrics = useCardMetrics(sousStockAA);
  const surMetrics = useCardMetrics(surStock100);

  /* ── Render ── */

  if (stockAbcdLoading) {
    return (
      <ListView>
        <Breadcrumb />
        <h1 className="page-title">Stock</h1>
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 w-full rounded-xl" />)}
        </div>
      </ListView>
    );
  }

  if (!stockAbcd || stockAbcd.total_references === 0) {
    return (
      <ListView>
        <Breadcrumb />
        <h1 className="page-title">Stock</h1>
        <div className="flex flex-1 items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-6 text-center max-w-sm pointer-events-none select-none">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-teal-500/10 border-2 border-teal-500/20">
              <Package className="h-12 w-12 text-teal-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Aucune donnée de stock</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Importez des achats et des ventes pour générer l'analyse ABCD de vos stocks.
              </p>
            </div>
          </div>
        </div>
      </ListView>
    );
  }

  return (
    <ListView>
      <Breadcrumb />
      <h1 className="page-title">Stock</h1>

      <PageFilter
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        extraFilters={
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Statut</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StockStatus | "all")}
            >
              <SelectTrigger className="h-9 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        rightSlot={
          <>
            <button
              type="button"
              onClick={() => {
                const rows = (stockAbcd?.products ?? []) as unknown as Record<string, unknown>[];
                if (!rows.length) return;
                downloadCSV(
                  rows,
                  (r) => [
                    String(r.product ?? ""),
                    String(r.category ?? ""),
                    String(r.units_sold_12m ?? 0),
                    String(r.current_stock ?? ""),
                    String(r.stock_min ?? ""),
                    String(r.stock_max ?? ""),
                    r.ppv != null ? fmt(r.ppv as number) : "",
                    r.avg_pu != null ? fmt(r.avg_pu as number) : "",
                  ],
                  ["Produit", "Classe", "Ventes 12m", "Stock actuel", "Stock min", "Stock max", "PPV", "PU moyen"],
                  exportFilename("STOCK", "csv", dateFrom || undefined, dateTo || undefined),
                );
              }}
              disabled={!stockAbcd?.products?.length}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Download className="h-3.5 w-3.5" />
              Exporter
            </button>
            <Link
              to="/dashboard/upload-file?type=stock"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <UploadCloud className="h-3.5 w-3.5" />
              Importer stock
            </Link>
          </>
        }
      />

      {/* ── ANALYSE ROTATION STOCK — ABCD (dark card) ── */}
      <div className="rounded-xl bg-card border border-border p-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-foreground mb-1">Analyse Rotation Stock — ABCD</h2>
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <p className="text-[11px] text-muted-foreground mb-4">Distribution ABCD des références</p>
            <div className="flex flex-wrap gap-5">
              {distData.map((d) => (
                <AbcdCircle
                  key={d.cat}
                  cat={d.cat}
                  count={d.count}
                  pct={d.pct}
                  active={classFilter === d.cat}
                  onClick={() => setClassFilter(classFilter === d.cat ? null : d.cat)}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 shrink-0">
            <p className="text-[11px] text-muted-foreground">Mixte : {fmtInt(stockAbcd.total_references)} références</p>
            <HealthGauge score={healthScore} />
          </div>
        </div>
      </div>

      {/* ── Product table when a class or status filter is active ── */}
      {tableActive && (
        <StockProductTable
          classFilter={classFilter}
          statusFilter={statusFilter}
          products={tableStock?.products ?? []}
          loading={tableLoading}
          sorting={sorting}
          onSortingChange={setSorting}
          onClose={() => { setClassFilter(null); setStatusFilter("all"); }}
        />
      )}

      {/* ── Stock alert cards (click → /alertes) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/alertes" className="block">
          <div className="rounded-xl bg-card border border-border p-5 space-y-3 cursor-pointer transition-shadow hover:shadow-md">
            <p className="text-sm font-semibold">Stock négatif</p>
            <p className="text-[10px] opacity-50 -mt-2 font-mono">stock actuel &lt; 0</p>
            <MetricsGrid refs={negMetrics.refs} units={negMetrics.units} valAchat={negMetrics.valAchat} ppvPot={negMetrics.ppvPot} />
          </div>
        </Link>

        <Link to="/alertes" className="block">
          <div className="rounded-xl bg-card border border-border p-5 space-y-3 cursor-pointer transition-shadow hover:shadow-md">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Sous stock Top références</p>
              <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-foreground">A & A-</span>
            </div>
            <p className="text-[10px] opacity-50 -mt-2 font-mono">classe A/A- · stock &lt; min</p>
            <MetricsGrid refs={sousMetrics.refs} units={sousMetrics.units} valAchat={sousMetrics.valAchat} ppvPot={sousMetrics.ppvPot} />
          </div>
        </Link>

        <Link to="/alertes" className="block">
          <div className="rounded-xl bg-card border border-border p-5 space-y-3 cursor-pointer transition-shadow hover:shadow-md">
            <p className="text-sm font-semibold">Sur stock &gt; 100 jours</p>
            <p className="text-[10px] opacity-50 -mt-2 font-mono">stock ÷ (ventes ÷ 365) &gt; 100j</p>
            <MetricsGrid refs={surMetrics.refs} units={surMetrics.units} valAchat={surMetrics.valAchat} ppvPot={surMetrics.ppvPot} />
          </div>
        </Link>
      </div>

      {/* ── SURVEILLANCE PÉREMPTIONS ── */}
      {peremptionsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-44 w-full rounded-xl" />)}
        </div>
      ) : peremptions ? (
        <>
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-4">Surveillance Péremptions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/alertes" className="block">
              <PeremptionCard
                title="Périmés en stock"
                subtitle="Produits périmés encore présents dans le stock actuel"
                urgent
                bracket={peremptions.expired}
                dotColor="#ef4444"
                bgClass="bg-red-100 dark:bg-red-950/50"
                borderClass="border-red-300 dark:border-red-800"
              />
            </Link>
            <Link to="/alertes" className="block">
              <PeremptionCard
                title="Très proches périmés"
                subtitle="Péremption dans moins de 6 mois"
                bracket={peremptions.very_close}
                dotColor="#f97316"
                bgClass="bg-orange-50 dark:bg-orange-950/40"
                borderClass="border-orange-300 dark:border-orange-800"
              />
            </Link>
            <Link to="/alertes" className="block">
              <PeremptionCard
                title="Proches périmés"
                subtitle="Péremption dans 6 à 12 mois"
                bracket={peremptions.close}
                dotColor="#f59e0b"
                bgClass="bg-amber-50 dark:bg-amber-950/40"
                borderClass="border-amber-300 dark:border-amber-800"
              />
            </Link>
          </div>
        </>
      ) : null}
    </ListView>
  );
};

/* ── Peremption card ─────────────────────────────────────────────────────── */

function PeremptionCard({
  title,
  subtitle,
  bracket,
  dotColor,
  bgClass,
  borderClass,
  urgent,
}: {
  title: string;
  subtitle?: string;
  bracket: PeremptionBracket;
  dotColor: string;
  bgClass: string;
  borderClass: string;
  urgent?: boolean;
}) {
  const fmtN = (n: number) => fmtInt(n);

  return (
    <div className={cn("rounded-xl border-2 p-5 space-y-3 cursor-pointer transition-shadow hover:shadow-md", bgClass, borderClass)}>
      <div className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
        <p className="text-sm font-semibold">{title}</p>
        {urgent && (
          <span className="inline-flex items-center rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase">Urgent</span>
        )}
      </div>
      {subtitle && <p className="text-[10px] text-muted-foreground -mt-1">{subtitle}</p>}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div>
          <p className="text-[10px] text-muted-foreground font-medium uppercase">Références</p>
          <p className="text-sm font-bold tabular-nums">{bracket.count}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground font-medium uppercase">Unités totales</p>
          <p className="text-sm font-bold tabular-nums">{fmtN(bracket.total_units)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground font-medium uppercase">Valeur achats</p>
          <p className="text-sm font-bold tabular-nums">{fmt(bracket.purchase_value)} <span className="text-[10px] font-normal">MAD</span></p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground font-medium uppercase">PPV potentiel</p>
          <p className="text-sm font-bold tabular-nums">{fmt(bracket.sale_value)} <span className="text-[10px] font-normal">MAD</span></p>
        </div>
      </div>
    </div>
  );
}

/* ── Stock product table with pagination ─────────────────────────────────── */

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  "sous-stock":   { label: "Sous-stock",    cls: "bg-red-100 text-red-700 border-red-200" },
  ideal:          { label: "Idéal",         cls: "bg-green-100 text-green-700 border-green-200" },
  "a-surveiller": { label: "À surveiller",  cls: "bg-amber-100 text-amber-700 border-amber-200" },
  "sur-stock":    { label: "Sur-stock",     cls: "bg-blue-100 text-blue-700 border-blue-200" },
  inconnu:        { label: "Inconnu",       cls: "bg-muted text-muted-foreground border-border" },
  negatif:        { label: "Négatif",       cls: "bg-red-200 text-red-800 border-red-300" },
};

const stockColumns: ColumnDef<StockAbcdProduct>[] = [
  {
    id: "product",
    accessorKey: "product",
    size: 280,
    header: () => <p className="column-title">Produit</p>,
    cell: ({ getValue }) => <span className="text-sm font-medium truncate max-w-[280px] block">{getValue<string>()}</span>,
  },
  {
    id: "category",
    accessorKey: "category",
    size: 80,
    header: () => <p className="column-title">Classe</p>,
    cell: ({ getValue }) => {
      const cat = getValue<string>();
      return (
        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: CLASS_COLORS[cat] ?? "#6b7280" }}>
          {cat}
        </span>
      );
    },
  },
  {
    id: "units_sold_12m",
    accessorKey: "units_sold_12m",
    size: 100,
    header: () => <p className="column-title">Ventes 12m</p>,
    cell: ({ getValue }) => <span className="tabular-nums text-sm">{getValue<number>()}</span>,
  },
  {
    id: "stock_min",
    accessorKey: "stock_min",
    size: 90,
    header: () => <p className="column-title">Stock Min</p>,
    cell: ({ getValue }) => <span className="tabular-nums text-sm">{getValue<number>()}</span>,
  },
  {
    id: "stock_max",
    accessorKey: "stock_max",
    size: 90,
    header: () => <p className="column-title">Stock Max</p>,
    cell: ({ getValue }) => <span className="tabular-nums text-sm">{getValue<number>()}</span>,
  },
  {
    id: "current_stock",
    accessorKey: "current_stock",
    size: 100,
    header: () => <p className="column-title">Stock actuel</p>,
    cell: ({ getValue }) => {
      const v = getValue<number | null>();
      return <span className="tabular-nums text-sm">{v != null ? v : "—"}</span>;
    },
  },
  {
    id: "status",
    accessorKey: "status",
    size: 110,
    header: () => <p className="column-title">Statut</p>,
    cell: ({ row }) => {
      const s = STATUS_CFG[row.original.status] ?? STATUS_CFG.inconnu;
      return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", s.cls)}>{s.label}</span>;
    },
  },
];

function StockProductTable({
  classFilter,
  statusFilter,
  products,
  loading,
  sorting,
  onSortingChange,
  onClose,
}: {
  classFilter: string | null;
  statusFilter: StockStatus | "all";
  products: StockAbcdProduct[];
  loading: boolean;
  sorting: SortingState;
  onSortingChange: React.Dispatch<React.SetStateAction<SortingState>>;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const total = products.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const paginatedData = useMemo(
    () => products.slice((page - 1) * pageSize, page * pageSize),
    [products, page, pageSize],
  );

  const table = useReactTable({
    data: paginatedData,
    columns: stockColumns,
    getCoreRowModel: getCoreRowModel(),
    state: { sorting },
    onSortingChange,
    manualPagination: true,
    manualSorting: true,
    pageCount,
  });

  // Reset page when filters change.
  useMemo(() => { setPage(1); }, [classFilter, statusFilter, sorting]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold">Produits filtrés</p>
          {classFilter && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: CLASS_COLORS[classFilter] }}>
              Classe {classFilter}
            </span>
          )}
          {statusFilter !== "all" && (
            <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", STATUS_CFG[statusFilter]?.cls ?? STATUS_CFG.inconnu.cls)}>
              {STATUS_CFG[statusFilter]?.label ?? statusFilter}
            </span>
          )}
          <span className="text-muted-foreground font-normal text-xs tabular-nums">({total} produit{total > 1 ? "s" : ""})</span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClose}>Fermer</Button>
      </div>
      <DataTable
        table={table}
        isLoading={loading}
        pagination={{
          currentPage: page,
          setCurrentPage: setPage,
          pageCount,
          pageSize,
          setPageSize: (size: number) => { setPageSize(size); setPage(1); },
          total,
        }}
        emptyState={<p className="text-sm text-muted-foreground text-center py-8">Aucun produit ne correspond aux filtres.</p>}
      />
    </div>
  );
}

export default StockList;
