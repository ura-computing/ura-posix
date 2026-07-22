// src/pages/alertes/index.tsx
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { useCategoryTypeOptions } from "@/components/shared/CategorySegment";
import { FilterBar, type ActiveFilter } from "@/components/shared/filterBar";

import { AlertDetailDialog } from "./_components/AlertDetailDialog";
import { GlobalSummaryStrip } from "./_components/GlobalSummaryStrip";
import { MarginAlertsSection } from "./_components/MarginAlertsSection";
import { PeremptionsSection } from "./_components/PeremptionsSection";
import { StockAlertsSection } from "./_components/StockAlertsSection";
import { VentesSansAchatSection } from "./_components/VentesSansAchatSection";
import { useAlertesPage, type CategoryType } from "./_hooks/useAlertesPage";
import { useT } from "@/i18n/I18nProvider";


const CATEGORY_KEY: Record<CategoryType, string> = {
  all: "category.mixte", pharmacie: "category.pharmacie", parapharmacie: "category.parapharmacie",
};


export default function AlertesPage() {
  const t = useT();
  const a = useAlertesPage();
  const categoryTypeOptions = useCategoryTypeOptions();

  const activeFilters: ActiveFilter[] = [
    (a.dateFrom || a.dateTo) ? {
      key:    "dates",
      label:  <>{t("dashboard.periode")} {a.dateFrom || "…"} → {a.dateTo || "…"}</>,
      onClear: () => { a.setDateFrom(""); a.setDateTo(""); },
    } : null,
    a.category !== "all" ? {
      key:    "cat",
      label:  <>{t("dashboard.categorieFilter")} {t(CATEGORY_KEY[a.category])}</>,
      onClear: () => a.setCategory("all"),
    } : null,
  ].filter(Boolean) as ActiveFilter[];

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("nav.alertes")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("alertes.subtitle")}
        </p>
      </header>

      <FilterBar<CategoryType>
        dateRange={{
          from:     a.dateFrom || null,
          to:       a.dateTo || null,
          onChange: (from, to) => { a.setDateFrom(from ?? ""); a.setDateTo(to ?? ""); },
        }}
        segment={{
          value:    a.category,
          onChange: a.setCategory,
          options:  categoryTypeOptions,
        }}
        activeFilters={activeFilters}
        onResetAll={a.resetAll}
      />

      {a.isError ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-error/40 bg-error-subtle px-4 py-3 text-error">
          <span className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="size-4" />
            {t("alertes.loadError")}
          </span>
          <button
            type="button"
            onClick={a.refetchAll}
            className="rounded-md border border-error/40 bg-card px-3 py-1.5 text-[13px] font-semibold text-error"
          >
            {t("common.retry")}
          </button>
        </div>
      ) : a.isLoading ? (
        <AlertesSkeleton />
      ) : a.isEmpty ? (
        <div className="flex flex-col items-center justify-center gap-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 px-6 py-[72px] text-center dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <span className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
            <CheckCircle2 className="size-7" />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-[17px] font-semibold text-foreground">{t("alertes.empty")}</h2>
            <p className="text-sm text-muted-foreground">{t("alertes.emptySub")}</p>
          </div>
        </div>
      ) : (
        <>
          <GlobalSummaryStrip
            totalAlerts={a.totalAlerts}
            marginNegative={a.counts.marginNeg}
            marginLow={a.counts.marginLow}
            peremptionCritical={a.peremptionCritical}
            toRestock={a.counts.sousStock}
            excessStock={a.counts.surStock}
          />
          <VentesSansAchatSection data={a.vsa} onOpen={a.openDialog} />
          <MarginAlertsSection data={a.margin} onOpen={a.openDialog} />
          <PeremptionsSection data={a.perem} onOpen={a.openDialog} />
          <StockAlertsSection
            negatif={a.negatif}
            sousStock={a.sousStock}
            surStock={a.surStock}
            negUnits={a.negUnits}
            sousPpv={a.sousPpv}
            surPpv={a.surPpv}
            onOpen={a.openDialog}
          />
        </>
      )}

      {/* shared detail dialog (portal) */}
      <AlertDetailDialog
        open={!!a.dialog}
        onClose={a.closeDialog}
        title={a.dialog?.title ?? ""}
        subtitle={a.dialog?.subtitle}
        products={a.dialog?.products ?? []}
        columns={a.dialog?.columns ?? []}
        defaultSortKey={a.dialog?.defaultSortKey ?? ""}
        dateFrom={a.dateFrom}
        dateTo={a.dateTo}
      />
    </div>
  );
}

/* ---- loading skeleton: 6 chips + 2/4/3 cards ---- */
function AlertesSkeleton() {
  const Card = () => <div className="h-32 animate-pulse rounded-xl border border-border bg-card" />;
  return (
    <>
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[54px] w-44 animate-pulse rounded-md border border-border bg-card" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{Array.from({ length: 2 }).map((_, i) => <Card key={i} />)}</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Card key={i} />)}</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Card key={i} />)}</div>
    </>
  );
}
