// src/pages/stock/index.tsx
import {
  RefreshCw,
  Download,
  Package,
  Upload,
  AlertTriangle,
  TrendingDown,
  PackageOpen,
  CalendarX,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

import { FilterBar, type ActiveFilter } from "@/_components/organisms/FilterBar";
import { AlertDetailDialog } from "@/pages/analytics/_components/AlertDetailDialog";
import { PEREMPTION_COLUMNS } from "@/pages/analytics/_components/alertColumns";
import { ROUTES } from "@/types";

import { useStockPage } from "./hooks";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { KpiTile, type IconTone } from "@/_components/organisms/KpiTile";
import { NeedleGauge } from "@/_components/atoms/NeedleGauge";
import { cn } from "@/utils/cn";
import { formatQty, formatPct, formatMAD, formatNumStr } from "@/utils/format";
import type { AbcdClass, StockRow, PeremptionBracket, PeremptionsResponse } from "@/types";
import { ABCD_COLORS, ABCD_ORDER, abcdFontSize, STATUS_OPTIONS } from "../constants";
import { useMemo, type ReactNode } from "react";
import type { DialogDescriptor } from "@/pages/analytics/hooks";
import { DataTable, type ColumnDef } from "@/_components/organisms/DataTable";
import { SingleSelect } from "@/_components/molecules/SingleSelect";
import { StockStatusPill } from "@/_components/molecules/StockStatusPill";
import type { StockSortKey } from "./hooks";
import { Page } from "@/_components/templates/Page";
import { Button } from "@/_components/atoms/Button";
import { SectionTitle } from "@/_components/atoms/SectionTitle";
import { Callout } from "@/_components/molecules/Callout";

// src/pages/stock/_components/AbcdAnalysisCard.tsx

interface AbcdAnalysisCardProps {
  /** Full distribution from the FULL fetch (only non-zero classes present). */
  distribution: Record<string, number>;
  totalReferences: number;
  /** 0-10 health score (computed in useStockPage as ideal / non-inconnu × 10). */
  health: number;
  activeClass: AbcdClass | null;
  onSelectClass: (c: AbcdClass) => void;
}

function AbcdAnalysisCard({
  distribution,
  totalReferences,
  health,
  activeClass,
  onSelectClass,
}: AbcdAnalysisCardProps) {
  const t = useT();
  const scoreLabel = formatNumStr(health, 1);

  return (
    <KpiTile label={t("stock.abcdTitle")}>
      <div className="grid items-center gap-6 md:grid-cols-[1.5fr_1fr]">
        {/* LEFT — 8 class circles */}
        <div className="grid grid-cols-4 gap-x-2 gap-y-3.5">
          {ABCD_ORDER.map((k) => {
            const count = distribution[k] ?? 0;
            const pct = totalReferences > 0 ? (count / totalReferences) * 100 : 0;
            const active = activeClass === k;
            return (
              <Button
                key={k}
                variant="ghost"
                onClick={() => onSelectClass(k)}
                aria-pressed={active}
                aria-label={t("stock.classAria", { k, n: count })}
                className="group h-auto flex-col gap-1.5 p-0 hover:bg-transparent"
              >
                <span
                  className={cn(
                    "flex size-16 items-center justify-center rounded-full font-bold leading-none text-white transition-transform duration-150",
                    "group-hover:scale-105 cursor-pointer",
                    active && "scale-105 ring-2 ring-primary",
                  )}
                  style={{
                    background: ABCD_COLORS[k],
                    fontSize: abcdFontSize(k),
                    boxShadow: active ? "0 0 0 2px var(--color-card), 0 0 0 4px var(--color-primary)" : undefined,
                  }}
                >
                  {k}
                </span>
                <span className="font-mono text-xl font-bold tabular-nums text-foreground">{formatQty(count)}</span>
                <span className="-mt-0.5 whitespace-nowrap font-mono text-xs text-muted-foreground">
                  {formatPct(pct)}
                </span>
              </Button>
            );
          })}
        </div>

        {/* RIGHT — Indice de santé du stock (uses the shared NeedleGauge — same gauge style as Achats supplier-mix) */}
        <div className="flex flex-col items-center justify-center gap-1 md:border-l md:border-border md:pl-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("stock.healthIndex")}
          </span>
          <NeedleGauge value={health * 10} />
          <div className="-mt-2 flex items-baseline gap-1 whitespace-nowrap">
            <span className="font-mono text-3xl font-bold tabular-nums text-foreground">{scoreLabel}</span>
            <span className="font-mono text-base font-semibold text-muted-foreground">/ 10</span>
          </div>
          {/* Explanation: pharmacists need to know what the needle measures */}
          <p className="mt-0.5 max-w-[220px] text-center text-xs leading-snug text-muted-foreground">
            Part des produits en couverture idéale <span className="whitespace-nowrap">(46-60 j)</span> sur ceux qui ont
            des ventes.
          </p>
          <span className="mt-0.5 text-sm text-muted-foreground">
            <span className="font-mono tabular-nums text-foreground">{formatQty(totalReferences)}</span> références
          </span>
        </div>
      </div>
    </KpiTile>
  );
}

// src/pages/stock/_components/AlertCardsGrid.tsx

interface AlertCardsGridProps {
  /** FULL products[] — alert cards always aggregate over the whole dataset. */
  products: StockRow[];
}

const absStock = (n: number | null) => (n == null ? 0 : Math.abs(n));

function aggregate(rows: StockRow[]) {
  return {
    refs: rows.length,
    units: rows.reduce((s, r) => s + absStock(r.current_stock), 0),
    purchase: rows.reduce(
      (s, r) => (r.avg_pu != null && r.current_stock != null ? s + r.avg_pu * Math.abs(r.current_stock) : s),
      0,
    ),
    ppv: rows.reduce(
      (s, r) => (r.ppv != null && r.current_stock != null ? s + r.ppv * Math.abs(r.current_stock) : s),
      0,
    ),
  };
}

function AlertCard({
  title,
  tone,
  Icon,
  rows,
}: {
  title: string;
  tone: IconTone;
  Icon: typeof AlertTriangle;
  rows: StockRow[];
}) {
  const t = useT();
  const a = aggregate(rows);
  const metrics: { label: string; value: ReactNode }[] = [
    { label: t("stock.references"), value: formatQty(a.refs) },
    { label: t("stock.unitesTotales"), value: formatQty(a.units) },
    { label: t("stock.valeurAchats"), value: formatMAD(a.purchase) },
    { label: t("kpi.ppvPotentiel"), value: formatMAD(a.ppv) },
  ];
  return (
    <KpiTile
      label={title}
      icon={<Icon className="size-5" />}
      iconTone={tone}
      footerLink={{ label: t("stock.voirAlertes"), href: ROUTES.ALERTES }}
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        {metrics.map((m) => (
          <div key={m.label} className="flex flex-col gap-0.5">
            <SectionTitle as="span" size="sm">
              {m.label}
            </SectionTitle>
            <span className="font-mono text-lg font-bold tabular-nums text-foreground">{m.value}</span>
          </div>
        ))}
      </div>
    </KpiTile>
  );
}

function AlertCardsGrid({ products }: AlertCardsGridProps) {
  const t = useT();
  // Every stock product (thousands): filtered once per new list, not per render.
  const { negatif, sousTop, surstock } = useMemo(
    () => ({
      negatif: products.filter((p) => p.status === "negatif"),
      sousTop: products.filter((p) => (p.category === "A" || p.category === "A-") && p.status === "sous-stock"),
      surstock: products.filter((p) => p.status === "sur-stock"),
    }),
    [products],
  );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <AlertCard title={t("stock.stockNegatif")} tone="error" Icon={AlertTriangle} rows={negatif} />
      <AlertCard title={t("stock.sousStockTop")} tone="warning" Icon={TrendingDown} rows={sousTop} />
      <AlertCard title={t("stock.surStock100")} tone="info" Icon={PackageOpen} rows={surstock} />
    </div>
  );
}

// src/pages/stock/_components/PeremptionsSection.tsx

interface PeremptionsSectionProps {
  data: PeremptionsResponse;
  onOpen: (d: DialogDescriptor) => void;
}

function PeremptionCard({
  title,
  sub,
  tone,
  bracket,
  onClick,
}: {
  title: string;
  sub: string;
  tone: IconTone;
  bracket: PeremptionBracket;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <KpiTile
      label={title}
      sub={sub}
      subTone={tone}
      icon={<CalendarX className="size-5" />}
      iconTone={tone}
      badge={{ label: formatQty(bracket.count), tone }}
      disabled={bracket.count === 0}
      onClick={bracket.count === 0 ? undefined : onClick}
    >
      <div className="flex items-center gap-5 pt-0.5">
        <div className="flex flex-col gap-px">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("peremptions.unites")}</span>
          <span className="font-mono text-base font-semibold tabular-nums text-foreground">
            {formatQty(bracket.total_units)}
          </span>
        </div>
        <div className="flex flex-col gap-px">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("peremptions.valeurVente")}</span>
          <span className="font-mono text-base font-semibold tabular-nums text-foreground">
            {formatMAD(bracket.sale_value)}
          </span>
        </div>
      </div>
    </KpiTile>
  );
}

function PeremptionsSection({ data, onOpen }: PeremptionsSectionProps) {
  const t = useT();
  // Same 4-bucket scheme as /alertes — clicking opens the shared
  // AlertDetailDialog with the per-bucket product list (sortable + Excel
  // export). The fourth bucket (`no_date`) is data-quality: products
  // whose Sobrus export had no expiry date.
  const cards: {
    key: keyof PeremptionsResponse;
    tone: IconTone;
    title: string;
    sub: string;
    dlgTitle: string;
    dlgSubtitle: string;
  }[] = [
    {
      key: "expired",
      tone: "error",
      title: t("peremptions.expiresStock"),
      sub: t("peremptions.actionUrgente"),
      dlgTitle: t("peremptions.dlgExpires"),
      dlgSubtitle: t("peremptions.dlgExpiresSub"),
    },
    {
      key: "very_close",
      tone: "warning",
      title: t("peremptions.tresProche"),
      sub: t("peremptions.tresUrgent"),
      dlgTitle: t("peremptions.dlgTresProche"),
      dlgSubtitle: t("peremptions.dlgTresProcheSub"),
    },
    {
      key: "close",
      tone: "warning",
      title: t("peremptions.proche"),
      sub: t("peremptions.aSurveiller"),
      dlgTitle: t("peremptions.dlgProche"),
      dlgSubtitle: t("peremptions.dlgProcheSub"),
    },
    {
      key: "no_date",
      tone: "muted",
      title: t("peremptions.sansDate"),
      sub: t("peremptions.aRenseigner"),
      dlgTitle: t("peremptions.dlgSansDate"),
      dlgSubtitle: t("peremptions.dlgSansDateSub"),
    },
  ];

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {t("peremptions.surveillance")}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const bracket = data[c.key];
          return (
            <PeremptionCard
              key={c.key}
              title={c.title}
              sub={c.sub}
              tone={c.tone}
              bracket={bracket}
              onClick={() =>
                onOpen({
                  title: c.dlgTitle,
                  subtitle: c.dlgSubtitle,
                  products: bracket.products,
                  columns: PEREMPTION_COLUMNS,
                  defaultSortKey: "expiry_date",
                })
              }
            />
          );
        })}
      </div>
    </section>
  );
}

interface StockTableProps {
  rows: StockRow[];
  isLoading: boolean;
  classFilter: AbcdClass | null;
  status: string;
  onStatusChange: (v: string) => void;
  sortBy: StockSortKey;
  sortOrder: "asc" | "desc";
  onSort: (key: StockSortKey) => void;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
  onClose: () => void;
}

/** Low-opacity rgba from an ABCD hex (used for the class pill bg). */
function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function ClassPill({ klass }: { klass: AbcdClass }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-bold"
      style={{ background: hexA(ABCD_COLORS[klass], 0.16), color: ABCD_COLORS[klass] }}
    >
      {klass}
    </span>
  );
}

const buildColumns = (t: TFn): ColumnDef<StockRow, StockSortKey>[] => [
  {
    key: "product",
    label: t("col.produit"),
    width: 280,
    render: (r) => (
      <span className="block max-w-[260px] truncate text-base" title={r.product}>
        {r.product}
      </span>
    ),
  },
  {
    key: "category",
    label: t("stock.classe"),
    width: 80,
    render: (r) => <ClassPill klass={r.category} />,
  },
  {
    key: "units_sold_12m",
    label: t("stock.ventes12m"),
    width: 110,
    align: "right",
    render: (r) => formatQty(r.units_sold_12m),
  },
  {
    key: "stock_min",
    label: t("stock.stockMin"),
    width: 100,
    align: "right",
    render: (r) => <span className="text-muted-foreground">{formatQty(r.stock_min)}</span>,
  },
  {
    key: "stock_max",
    label: t("stock.stockMax"),
    width: 100,
    align: "right",
    render: (r) => <span className="text-muted-foreground">{formatQty(r.stock_max)}</span>,
  },
  {
    key: "current_stock",
    label: t("stock.stockActuel"),
    width: 120,
    align: "right",
    render: (r) =>
      r.current_stock == null ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span
          className={cn(
            "inline-block rounded px-1.5 py-0.5 font-semibold",
            r.status === "negatif" && "bg-error/10 text-error",
          )}
        >
          {formatQty(r.current_stock)}
        </span>
      ),
  },
  {
    key: "status",
    label: t("col.statut"),
    width: 140,
    render: (r) => <StockStatusPill status={r.status} />,
  },
];

function StockTable({
  rows,
  isLoading,
  classFilter,
  status,
  onStatusChange,
  sortBy,
  sortOrder,
  onSort,
  page,
  pageSize,
  onPage,
  onPageSize,
  onClose,
}: StockTableProps) {
  const t = useT();
  // Active-filter banner above the table (Stock-specific UX).
  const topBanner = (
    <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-surface-subtle px-3.5 py-2.5">
      <span className="text-xs font-semibold text-muted-foreground">{t("stock.filtreSur")}</span>
      {classFilter !== null && (
        <span
          className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold"
          style={{ background: hexA(ABCD_COLORS[classFilter], 0.16), color: ABCD_COLORS[classFilter] }}
        >
          {t("stock.classe")} {classFilter}
        </span>
      )}
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        · {formatQty(rows.length)} {t("stock.produitsWord")}
      </span>
      {/* Status filter lives on top of the table (a selector), not in the page FilterBar. */}
      <div className="ml-auto flex items-center gap-2">
        <SingleSelect
          label={t("col.statut")}
          options={STATUS_OPTIONS.map((o) => ({
            value: o.value,
            label: o.days
              ? `${t(`stockStatus.${o.value}`)} (${o.days} ${t("stockStatus.days")})`
              : t(`stockStatus.${o.value || "all"}`),
          }))}
          value={status}
          onChange={onStatusChange}
          align="end"
        />
        <Button variant="outline" size="sm" onClick={onClose}>
          <X className="size-3" /> {t("common.close")}
        </Button>
      </div>
    </div>
  );

  // Client-side page slice — Stock fetches the whole filtered set at once.
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <DataTable<StockRow, StockSortKey>
      rows={pageRows}
      columns={buildColumns(t)}
      isLoading={isLoading}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSort={onSort}
      pagination={{
        page,
        pageSize,
        total: rows.length,
        onPage,
        onPageSize,
      }}
      topBanner={topBanner}
      emptyTitle={t("stock.emptyProduct")}
      emptyHint={t("stock.emptyHint")}
      rowKey={(r, i) => `${r.product}-${i}`}
    />
  );
}

export default function StockPage() {
  const t = useT();
  const {
    abcd,
    classFilter,
    clearAll,
    closeDialog,
    closeTable,
    dateFrom,
    dateTo,
    dialog,
    fullProducts,
    handleExport,
    hasTableFilter,
    healthScore,
    isDateDefault,
    isEmpty,
    isError,
    isExportLoading,
    isLoading,
    isTableLoading,
    openDialog,
    page,
    pageSize,
    peremptions,
    reload,
    selectClass,
    setDateFrom,
    setDateTo,
    setPage,
    setPageSize,
    setStatus,
    sortBy,
    sortOrder,
    status,
    tableRows,
    toggleSort,
  } = useStockPage();

  const activeFilters: ActiveFilter[] = [
    // Only a pill for an EXPLICIT range — not the local 12-month default (whose
    // "clear" would just revert to the same default and feel broken).
    !isDateDefault && (dateFrom || dateTo)
      ? {
          key: "dates",
          label: (
            <>
              {t("dashboard.periode")} {dateFrom || "…"} → {dateTo || "…"}
            </>
          ),
          onClear: () => {
            setDateFrom("");
            setDateTo("");
          },
        }
      : null,
    classFilter !== null
      ? {
          key: "class",
          label: (
            <>
              {t("stock.classe")} : {classFilter}
            </>
          ),
          onClear: closeTable,
        }
      : null,
  ].filter(Boolean) as ActiveFilter[];

  return (
    <Page title={t("nav.stock")}>
      <FilterBar
        dateRange={{
          from: dateFrom || null,
          to: dateTo || null,
          onChange: (from, to) => {
            setDateFrom(from ?? "");
            setDateTo(to ?? "");
          },
        }}
        rightActions={[
          {
            label: t("common.export"),
            icon: <Download className="size-4" />,
            variant: "outline",
            onClick: handleExport,
            disabled: isExportLoading,
          },
          {
            label: t("stock.importStock"),
            icon: <Upload className="size-4" />,
            variant: "primary",
            href: `${ROUTES.UPLOAD_FILE}?type=stock`,
          },
        ]}
        activeFilters={activeFilters}
        onResetAll={clearAll}
      />

      {/* ERROR */}
      {isError && (
        <Callout
          tone="error"
          action={
            <Button variant="secondary" onClick={reload}>
              <RefreshCw className="size-3.5" />
              {t("common.retry")}
            </Button>
          }
        >
          {t("stock.loadError")}
        </Callout>
      )}

      {/* LOADING */}
      {isLoading && <StockSkeleton />}

      {/* EMPTY — no stock data imported yet */}
      {!isLoading && !isError && isEmpty && (
        <div className="flex flex-col items-center justify-center gap-3.5 rounded-xl border border-border bg-card px-6 py-[72px] text-center">
          <span className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Package className="size-7" />
          </span>
          <div className="flex max-w-md flex-col gap-1.5">
            <h2 className="text-[17px] font-semibold text-foreground">{t("stock.empty")}</h2>
            <p className="text-sm text-muted-foreground">{t("stock.emptyDesc")}</p>
          </div>
          <Link
            to={`${ROUTES.UPLOAD_FILE}?type=stock`}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4.5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            <Upload className="size-4" /> {t("stock.importDuStock")}
          </Link>
        </div>
      )}

      {/* DATA */}
      {!isLoading && !isError && !isEmpty && abcd && (
        <>
          <AbcdAnalysisCard
            distribution={abcd.distribution}
            totalReferences={abcd.total_references}
            health={healthScore}
            activeClass={classFilter}
            onSelectClass={selectClass}
          />

          {hasTableFilter && (
            <StockTable
              rows={tableRows}
              isLoading={isTableLoading}
              classFilter={classFilter}
              status={status}
              onStatusChange={setStatus}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={toggleSort}
              page={page}
              pageSize={pageSize}
              onPage={setPage}
              onPageSize={(n) => {
                setPageSize(n);
                setPage(1);
              }}
              onClose={closeTable}
            />
          )}

          <AlertCardsGrid products={fullProducts} />

          {peremptions && <PeremptionsSection data={peremptions} onOpen={openDialog} />}
        </>
      )}

      {/* shared detail dialog (portal) — same pattern as /alertes */}
      <AlertDetailDialog
        open={!!dialog}
        onClose={closeDialog}
        title={dialog?.title ?? ""}
        subtitle={dialog?.subtitle}
        products={dialog?.products ?? []}
        columns={dialog?.columns ?? []}
        defaultSortKey={dialog?.defaultSortKey ?? ""}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />
    </Page>
  );
}

/* ---- loading skeleton ---- */
function Pulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-muted ${className ?? ""}`} />;
}

function StockSkeleton() {
  return (
    <>
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <Pulse className="mb-5 h-3 w-60" />
        <div className="grid items-center gap-6 md:grid-cols-[1.5fr_1fr]">
          <div className="grid grid-cols-4 gap-x-2 gap-y-3.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Pulse className="size-16" />
                <Pulse className="h-3.5 w-10" />
                <Pulse className="h-2 w-7" />
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center gap-3">
            <Pulse className="h-[108px] w-[200px] rounded-xl" />
            <Pulse className="h-3 w-28" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <Pulse className="mb-4 h-3 w-3/5" />
            <div className="grid grid-cols-2 gap-2.5">
              {Array.from({ length: 4 }).map((__, j) => (
                <Pulse key={j} className="h-7 rounded-md" />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
            <Pulse className="h-3 w-1/2" />
            <Pulse className="h-6 w-2/5 rounded-md" />
            <Pulse className="h-2.5 w-3/4" />
          </div>
        ))}
      </div>
    </>
  );
}
