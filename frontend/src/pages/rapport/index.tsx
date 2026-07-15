import { useState } from "react";
import { Building2 } from "lucide-react";

import { CATEGORY_TYPE_OPTIONS } from "@/components/shared/CategorySegment";
import { FilterBar, type ActiveFilter } from "@/components/shared/filterBar";
import { SingleSelectPopover } from "@/components/shared/SingleSelectPopover";
import { useMe } from "@/hooks/useMe";
import { useGlobalDateRange } from "@/hooks/useGlobalDateRange";
import { ROLES } from "@/types";
import type { CategoryType, Feature, MargeMode, StatsFilters } from "@/types";

import {
  useAdminPharmacies,
  useAdminPharmacyStats,
  useAdminStats,
  useMarginAlerts,
  useStats,
  useStockSummary,
} from "./_hooks/useRapportData";
import { useAdminPharmacyAnalyseMarge } from "./_hooks/useAdminAnalyseMarge";

import { AdminPharmacyBody }    from "./_components/AdminPharmacyBody";
import { AdminSystemTiles }     from "./_components/AdminSystemTiles";
import { AnalyseMargePreview }  from "./_components/AnalyseMargePreview";
import { CategoriesDonut }      from "./_components/CategoriesDonut";
import { IndicateursAvances }   from "./_components/IndicateursAvances";
import { IndicateursCles }      from "./_components/IndicateursCles";
import { MarginAlertCards }     from "./_components/MarginAlertCards";
import { RapportSkeleton }      from "./_components/RapportSkeleton";
import { SanteFinanciereCard }  from "./_components/SanteFinanciereCard";
import { StockSummaryTiles }    from "./_components/StockSummaryTiles";
import { TrendChart }           from "./_components/TrendChart";
import { TvaTiles }             from "./_components/TvaTiles";


const CATEGORY_LABEL = { all: "Mixte", pharmacie: "Pharmacie", parapharmacie: "Parapharmacie" } as const;


/** Build the activeFilters[] array from StatsFilters — shared by both owner + admin views. */
function buildActiveFilters(
  filters: StatsFilters,
  setFilters: (f: StatsFilters) => void,
): ActiveFilter[] {
  return [
    (filters.date_from || filters.date_to) ? {
      key:    "dates",
      label:  <>Période : {filters.date_from ?? "…"} → {filters.date_to ?? "…"}</>,
      onClear: () => setFilters({ ...filters, date_from: null, date_to: null }),
    } : null,
    filters.category_type !== "all" ? {
      key:    "category",
      label:  <>Catégorie : {CATEGORY_LABEL[filters.category_type]}</>,
      onClear: () => setFilters({ ...filters, category_type: "all" }),
    } : null,
  ].filter(Boolean) as ActiveFilter[];
}


// Local-only filter slice — date fields come from the cross-route
// GlobalDateRangeProvider so picking dates on /rapport carries over to
// /achats, /ventes, /admin/stats, etc. The composed `StatsFilters` is built
// per-view by merging this local slice with the global range.
type LocalStatsFilters = Omit<StatsFilters, "date_from" | "date_to">;
const INITIAL_LOCAL: LocalStatsFilters = {
  category_type:        "all",
  include_non_declared: false,
};


export default function RapportPage() {
  const { me } = useMe();
  if (!me) return null;
  return me.role === ROLES.ADMIN ? <AdminView /> : <OwnerView />;
}


// ────────────────────────────────────────────────────────────────────────────
// OWNER
// ────────────────────────────────────────────────────────────────────────────

function OwnerView() {
  const { from: dateFrom, to: dateTo, setRange } = useGlobalDateRange();
  const [local, setLocal] = useState<LocalStatsFilters>(INITIAL_LOCAL);
  const filters: StatsFilters = { ...local, date_from: dateFrom, date_to: dateTo };
  // Backwards-compat wrapper so the existing buildActiveFilters/FilterBar
  // call sites can keep doing `setFilters({ ...filters, date_from, date_to })`.
  const setFilters = (next: StatsFilters) => {
    const { date_from, date_to, ...rest } = next;
    setLocal(rest);
    setRange(date_from, date_to);
  };

  const { stats,  isLoading: l1, isError: e1 } = useStats(filters);
  const { alerts, isLoading: l2 }              = useMarginAlerts(filters);
  const { stock,  isLoading: l3 }              = useStockSummary();

  const loading = l1 || l2 || l3;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Vue d'ensemble de votre activité.</p>
      </header>

      <FilterBar<StatsFilters["category_type"]>
        dateRange={{
          from:     filters.date_from,
          to:       filters.date_to,
          onChange: (from, to) => setFilters({ ...filters, date_from: from, date_to: to }),
        }}
        segment={{
          value:    filters.category_type,
          onChange: (v) => setFilters({ ...filters, category_type: v }),
          options:  CATEGORY_TYPE_OPTIONS,
        }}
        activeFilters={buildActiveFilters(filters, setFilters)}
        onResetAll={() => { setLocal(INITIAL_LOCAL); setRange(null, null); }}
      />

      {loading && <RapportSkeleton />}

      {e1 && (
        <div className="rounded-md border border-error-border bg-error-subtle px-4 py-3 text-sm text-error-subtle-foreground">
          Impossible de charger le rapport. Réessayez plus tard.
        </div>
      )}

      {stats && !loading && <RapportSections stats={stats} alerts={alerts} stock={stock} category={filters.category_type} />}
    </div>
  );
}


// ────────────────────────────────────────────────────────────────────────────
// ADMIN  (Vue système + per-pharmacy drill-down)
// ────────────────────────────────────────────────────────────────────────────

function AdminView() {
  const [pharmacyId, setPharmacyId] = useState<number | null>(null);
  const { from: dateFrom, to: dateTo, setRange } = useGlobalDateRange();
  const [local, setLocal] = useState<LocalStatsFilters>(INITIAL_LOCAL);
  const filters: StatsFilters = { ...local, date_from: dateFrom, date_to: dateTo };
  const setFilters = (next: StatsFilters) => {
    const { date_from, date_to, ...rest } = next;
    setLocal(rest);
    setRange(date_from, date_to);
  };
  const [marginMode, setMarginMode] = useState<MargeMode>("produit");

  const { systemStats, isLoading: ls }         = useAdminStats();
  const { pharmacies }                         = useAdminPharmacies();
  const { stats,  isLoading: l1, isError: e1 } = useAdminPharmacyStats(pharmacyId, filters);
  const analyse                                = useAdminPharmacyAnalyseMarge(pharmacyId, marginMode, {
    date_from: dateFrom, date_to: dateTo, category_type: filters.category_type,
  });

  const loading = pharmacyId !== null && l1;
  const subtitleDates = dateFrom || dateTo
    ? `Période : ${dateFrom ?? "…"} → ${dateTo ?? "…"}`
    : "Ventes et achats sur les 12 derniers mois";

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Tableau de bord</h1>
        <p className="text-sm text-muted-foreground">Vue d'ensemble du système et drill-down par pharmacie.</p>
      </header>

      {/* Vue système — always shown */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vue système</h2>
        {ls || !systemStats ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}
          </div>
        ) : (
          <AdminSystemTiles stats={systemStats} />
        )}
      </section>

      {/* Per-pharmacy drill-down */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rapport par pharmacie</h2>
        {/* Admin pharmacy picker — uses the shared SingleSelectPopover so the
            trigger + panel match every other dropdown in the app (Catégorie,
            Type, Statut, page-size, etc.). */}
        <div className="flex flex-wrap items-center gap-3">
          <SingleSelectPopover
            label="Pharmacie"
            value={pharmacyId != null ? String(pharmacyId) : ""}
            onChange={(v) => setPharmacyId(v ? Number(v) : null)}
            options={[
              { value: "", label: "Toutes les pharmacies" },
              ...pharmacies.map((p) => ({
                value: String(p.id),
                label: [p.code, p.name].filter(Boolean).join(" · "),
              })),
            ]}
          />
        </div>

        <FilterBar<StatsFilters["category_type"]>
          dateRange={{
            from:     filters.date_from,
            to:       filters.date_to,
            onChange: (from, to) => setFilters({ ...filters, date_from: from, date_to: to }),
          }}
          segment={{
            value:    filters.category_type,
            onChange: (v) => setFilters({ ...filters, category_type: v }),
            options:  CATEGORY_TYPE_OPTIONS,
          }}
          activeFilters={[
            ...(pharmacyId !== null ? [{
              key:    "pharmacy",
              label:  <>Pharmacie : {pharmacies.find((p) => p.id === pharmacyId)?.code ?? pharmacies.find((p) => p.id === pharmacyId)?.name ?? "—"}</>,
              onClear: () => setPharmacyId(null),
            }] : []),
            ...buildActiveFilters(filters, setFilters),
          ]}
          onResetAll={() => { setLocal(INITIAL_LOCAL); setRange(null, null); setPharmacyId(null); }}
        />

        {pharmacyId === null && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <Building2 className="size-12 text-muted-foreground" aria-hidden />
            <p className="max-w-md text-sm text-muted-foreground">
              Sélectionnez une pharmacie ci-dessus pour afficher ses statistiques détaillées.
            </p>
          </div>
        )}

        {loading && <RapportSkeleton />}

        {e1 && (
          <div className="rounded-md border border-error-border bg-error-subtle px-4 py-3 text-sm text-error-subtle-foreground">
            Impossible de charger le rapport pour cette pharmacie.
          </div>
        )}

        {stats && pharmacyId !== null && !loading && (() => {
          const sel = pharmacies.find((p) => p.id === pharmacyId);
          const pharmacyLabel = sel ? [sel.code, sel.name].filter(Boolean).join(" · ") : "";
          return (
            <AdminPharmacyBody
              stats={stats}
              pharmacyLabel={pharmacyLabel}
              categoryType={filters.category_type}
              marginMode={marginMode}
              onMarginMode={setMarginMode}
              marginRows={(analyse.data?.rows ?? []) as Record<string, unknown>[]}
              marginLoading={analyse.isLoading}
              subtitleDates={subtitleDates}
            />
          );
        })()}
      </section>
    </div>
  );
}


// ────────────────────────────────────────────────────────────────────────────
// Shared sections (used by both owner + admin variants)
// ────────────────────────────────────────────────────────────────────────────

interface SectionsProps {
  stats:    NonNullable<ReturnType<typeof useStats>["stats"]>;
  alerts:   ReturnType<typeof useMarginAlerts>["alerts"];
  stock:    ReturnType<typeof useStockSummary>["stock"];
  category: CategoryType;
}

function RapportSections({ stats, alerts, stock, category }: SectionsProps) {
  const { me } = useMe();
  // Admin bypass: see every section regardless of feature flags. Non-admin:
  // hide sections whose backing feature isn't in their effective permissions.
  const has = (f: Feature) => me?.role === ROLES.ADMIN || (me?.permissions.includes(f) ?? false);

  return (
    <>
      {/* Section 2 — Indicateurs clés (Bento hero with aurora + sparkline) */}
      <IndicateursCles stats={stats} tint={category} />

      {/* Section 3 — Indicateurs avancés */}
      <IndicateursAvances kpis={stats.advanced_kpis} tint={category} />

      {/* Section 4 — Répartition du CA : donut + table (pleine largeur) */}
      <CategoriesDonut categories={stats.top_categories} tint={category} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
        <SanteFinanciereCard marge={stats.marge} tint={category} />
        <TrendChart points={stats.monthly_trend} granularity={stats.trend_granularity} tint={category} />
      </div>

      {/* Section 5 — Alertes marges (feature: alertes) */}
      {has("alertes") && alerts && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Alertes marges</h2>
          <MarginAlertCards data={alerts} tint={category} />
        </section>
      )}

      {/* Section 6 — Déclaration TVA (feature: accounting) */}
      {has("accounting") && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Déclaration TVA</h2>
          <TvaTiles tva={stats.tva} tint={category} />
        </section>
      )}

      {/* Section 7 — Analyse de marge preview (feature: analyse) */}
      {has("analyse") && <AnalyseMargePreview stats={stats} tint={category} />}

      {/* Section 8 — Stock summary (feature: stock) */}
      {has("stock") && stock && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stock</h2>
          <StockSummaryTiles stock={stock} tint={category} />
        </section>
      )}
    </>
  );
}