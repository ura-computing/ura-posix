// src/pages/stock/index.tsx
import { AlertCircle, Download, Package, Upload } from "lucide-react";
import { Link } from "react-router-dom";

import { FilterBar, type ActiveFilter } from "@/components/shared/filterBar";
import { AlertDetailDialog } from "@/pages/alertes/_components/AlertDetailDialog";
import { ROUTES } from "@/types";

import { AbcdAnalysisCard } from "./_components/AbcdAnalysisCard";
import { AlertCardsGrid } from "./_components/AlertCardsGrid";
import { PeremptionsSection } from "./_components/PeremptionsSection";
import { StockTable } from "./_components/StockTable";
import { useStockPage } from "./_hooks/useStockPage";
import { useT } from "@/i18n/I18nProvider";

export default function StockPage() {
  const t = useT();
  const s = useStockPage();
  const full = s.fullQuery;

  const activeFilters: ActiveFilter[] = [
    // Only a pill for an EXPLICIT range — not the local 2-month default (whose
    // "clear" would just revert to the same default and feel broken).
    !s.isDateDefault && (s.dateFrom || s.dateTo) ? {
      key:    "dates",
      label:  <>{t("dashboard.periode")} {s.dateFrom || "…"} → {s.dateTo || "…"}</>,
      onClear: () => { s.setDateFrom(""); s.setDateTo(""); },
    } : null,
    s.classFilter !== null ? {
      key:    "class",
      label:  <>{t("stock.classe")} : {s.classFilter}</>,
      onClear: s.closeTable,
    } : null,
  ].filter(Boolean) as ActiveFilter[];

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("nav.stock")}</h1>
      </header>

      <FilterBar
        dateRange={{
          from:     s.dateFrom || null,
          to:       s.dateTo || null,
          onChange: (from, to) => { s.setDateFrom(from ?? ""); s.setDateTo(to ?? ""); },
        }}
        rightActions={[
          {
            label: t("common.export"),
            icon: <Download className="size-4" />,
            variant: "outline",
            onClick: s.handleExport,
            disabled: s.isExportLoading,
          },
          { label: t("stock.importStock"),  icon: <Upload   className="size-4" />, variant: "primary", href: `${ROUTES.UPLOAD_FILE}?type=stock` },
        ]}
        activeFilters={activeFilters}
        onResetAll={s.clearAll}
      />

      {/* ERROR */}
      {full.isError && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-error/40 bg-error-subtle px-4 py-3 text-error">
          <span className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="size-4" />
            {t("stock.loadError")}
          </span>
          <button
            type="button"
            onClick={() => full.refetch()}
            className="rounded-md border border-error/40 bg-card px-3 py-1.5 text-[13px] font-semibold text-error"
          >
            {t("common.retry")}
          </button>
        </div>
      )}

      {/* LOADING */}
      {full.isLoading && <StockSkeleton />}

      {/* EMPTY — no stock data imported yet */}
      {!full.isLoading && !full.isError && s.isEmpty && (
        <div className="flex flex-col items-center justify-center gap-3.5 rounded-xl border border-border bg-card px-6 py-[72px] text-center">
          <span className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Package className="size-7" />
          </span>
          <div className="flex max-w-md flex-col gap-1.5">
            <h2 className="text-[17px] font-semibold text-foreground">{t("stock.empty")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("stock.emptyDesc")}
            </p>
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
      {!full.isLoading && !full.isError && !s.isEmpty && full.data && (
        <>
          <AbcdAnalysisCard
            distribution={full.data.distribution}
            totalReferences={full.data.total_references}
            health={s.healthScore}
            activeClass={s.classFilter}
            onSelectClass={s.selectClass}
          />

          {s.hasTableFilter && (
            <StockTable
              rows={s.filteredQuery.data?.products ?? []}
              isLoading={s.filteredQuery.isLoading}
              classFilter={s.classFilter}
              status={s.status}
              onStatusChange={s.setStatus}
              search={s.search}
              sortBy={s.sortBy}
              sortOrder={s.sortOrder}
              onSort={s.toggleSort}
              page={s.page}
              pageSize={s.pageSize}
              onPage={s.setPage}
              onPageSize={(n) => {
                s.setPageSize(n);
                s.setPage(1);
              }}
              onClose={s.closeTable}
            />
          )}

          <AlertCardsGrid products={s.fullProducts} />

          {s.peremptionsQuery.data && (
            <PeremptionsSection data={s.peremptionsQuery.data} onOpen={s.openDialog} />
          )}
        </>
      )}

      {/* shared detail dialog (portal) — same pattern as /alertes */}
      <AlertDetailDialog
        open={!!s.dialog}
        onClose={s.closeDialog}
        title={s.dialog?.title ?? ""}
        subtitle={s.dialog?.subtitle}
        products={s.dialog?.products ?? []}
        columns={s.dialog?.columns ?? []}
        defaultSortKey={s.dialog?.defaultSortKey ?? ""}
        dateFrom={s.dateFrom}
        dateTo={s.dateTo}
      />
    </div>
  );
}

/* ---- loading skeleton ---- */
function StockSkeleton() {
  const Pulse = ({ className }: { className?: string }) => (
    <div className={`animate-pulse rounded-full bg-muted ${className ?? ""}`} />
  );
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
