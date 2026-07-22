import { Download } from "lucide-react";

import { useCategoryTypeOptions } from "@/components/shared/CategorySegment";
import { FilterBar, type ActiveFilter } from "@/components/shared/filterBar";
import { MonthPopover } from "@/components/shared/MonthPopover";
import type { StatsFilters } from "@/types";

import { KpiCards }            from "./_components/KpiCards";
import { PaymentEditDialog }   from "./_components/PaymentEditDialog";
import { PaymentMethodGrid }   from "./_components/PaymentMethodGrid";
import { VentesLedger }        from "./_components/VentesLedger";
import { useComptabilitePage } from "./_hooks/useComptabilitePage";
import { useT } from "@/i18n/I18nProvider";


const CATEGORY_KEY: Record<StatsFilters["category_type"], string> = {
  all: "category.mixte", pharmacie: "category.pharmacie", parapharmacie: "category.parapharmacie",
};


export default function ComptabilitePage() {
  const t = useT();
  const p = useComptabilitePage();
  const categoryTypeOptions = useCategoryTypeOptions();

  const activeFilters: ActiveFilter[] = [
    (p.filters.date_from || p.filters.date_to) ? {
      key:   "dates",
      label: <>{t("dashboard.periode")} {p.filters.date_from ?? "…"} → {p.filters.date_to ?? "…"}</>,
      onClear: () => p.setFilters({ ...p.filters, date_from: null, date_to: null }),
    } : null,
    p.filters.category_type !== "all" ? {
      key:   "cat",
      label: <>{t("dashboard.categorieFilter")} {t(CATEGORY_KEY[p.filters.category_type])}</>,
      onClear: () => p.setFilters({ ...p.filters, category_type: "all" }),
    } : null,
    p.filters.include_non_declared ? {
      key:   "nd",
      label: <>{t("comptabilite.avecSpeciaux")}</>,
      onClear: () => p.setFilters({ ...p.filters, include_non_declared: false }),
    } : null,
  ].filter(Boolean) as ActiveFilter[];

  // Active entry for the open method (drives the dialog's initial values).
  const activeEntry = p.openMethod
    ? (p.payments.find((e) => e.method === p.openMethod) ?? null)
    : null;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t("nav.comptabilite")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("comptabilite.pageSubtitle")}
        </p>
      </header>

      <FilterBar<StatsFilters["category_type"]>
        dateRange={{
          from:     p.filters.date_from,
          to:       p.filters.date_to,
          onChange: (from, to) => p.setFilters({ ...p.filters, date_from: from, date_to: to }),
        }}
        segment={{
          value:    p.filters.category_type,
          onChange: (v) => p.setFilters({ ...p.filters, category_type: v }),
          options:  categoryTypeOptions,
        }}
        rightActions={[
          {
            label:    t("common.export"),
            icon:     <Download className="size-4" />,
            variant:  "outline",
            onClick:  p.handleExport,
            disabled: !p.stats,
          },
        ]}
        activeFilters={activeFilters}
        onResetAll={() => p.setFilters({
          date_from: null, date_to: null, category_type: "all", include_non_declared: false,
        })}
      />

      {/* Non-declared toggle — secondary control, lives outside the FilterBar */}
      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={p.filters.include_non_declared}
          onChange={(e) => p.setFilters({ ...p.filters, include_non_declared: e.target.checked })}
          className="cursor-pointer accent-primary"
        />
        {t("comptabilite.includeSpecial")}
      </label>

      {/* KPI cards (3) */}
      {p.statsLoading || !p.stats
        ? <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {[0,1,2].map((i) => <div key={i} className="h-44 animate-pulse rounded-xl border border-border bg-card" />)}
          </div>
        : <KpiCards stats={p.stats} />}

      {/* Payment method cards (4) for the active month */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {t("comptabilite.paymentMethods")}
          </h2>
          <MonthPopover
            label=""
            value={p.activeMonth}
            onChange={p.setActiveMonth}
            align="end"
          />
        </div>
        <PaymentMethodGrid payments={p.payments} onOpenMethod={p.setOpenMethod} />
      </section>

      {/* Ventes ledger */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("comptabilite.salesJournal")}
        </h2>
        <VentesLedger
          rows={p.ventes}
          isLoading={p.ventesLoading}
          sortBy={p.ventesSortBy}
          sortOrder={p.ventesSortOrder}
          onSort={p.setVentesSort}
          pagination={{
            page:       p.ventesPage,
            pageSize:   p.ventesPageSize,
            total:      p.ventesTotal,
            onPage:     p.setVentesPage,
            onPageSize: p.setVentesPageSize,
          }}
        />
      </section>

      <PaymentEditDialog
        open={p.openMethod !== null}
        onClose={() => p.setOpenMethod(null)}
        method={p.openMethod}
        month={p.activeMonth}
        entry={activeEntry}
      />
    </div>
  );
}
