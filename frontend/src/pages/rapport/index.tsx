import { useState } from "react";
import { Building2 } from "lucide-react";

import { CATEGORY_TYPE_OPTIONS } from "@/components/shared/CategorySegment";
import { FilterBar, type ActiveFilter } from "@/components/shared/filterBar";
import { SingleSelectPopover } from "@/components/shared/SingleSelectPopover";
import { useMe } from "@/hooks/useMe";
import { ROLES } from "@/types";
import type { StatsFilters } from "@/types";

import {
  useAdminPharmacies,
  useAdminPharmacyMarginAlerts,
  useAdminPharmacyStats,
  useAdminPharmacyStockSummary,
  useAdminStats,
  useMarginAlerts,
  useStats,
  useStockSummary,
} from "./_hooks/useRapportData";

import { AdminContextStrip }    from "./_components/AdminContextStrip";
import { AdminSystemTiles }     from "./_components/AdminSystemTiles";
import { AnalyseMargePreview }  from "./_components/AnalyseMargePreview";
import { CategoriesDonut }      from "./_components/CategoriesDonut";
import { IndicateursAvances }   from "./_components/IndicateursAvances";
import { IndicateursCles }      from "./_components/IndicateursCles";
import { MarginAlertCards }     from "./_components/MarginAlertCards";
import { RapportSkeleton }      from "./_components/RapportSkeleton";
import { SanteFinanciereCard }  from "./_components/SanteFinanciereCard";
import { StockSummaryTiles }    from "./_components/StockSummaryTiles";
import { TopCategoriesList }    from "./_components/TopCategoriesList";
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


const INITIAL: StatsFilters = {
  date_from:            null,
  date_to:              null,
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
  const [filters, setFilters] = useState<StatsFilters>(INITIAL);

  const { stats,  isLoading: l1, isError: e1 } = useStats(filters);
  const { alerts, isLoading: l2 }              = useMarginAlerts(filters);
  const { stock,  isLoading: l3 }              = useStockSummary();

  const loading = l1 || l2 || l3;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Rapport</h1>
        <p className="text-sm text-muted-foreground">Tableau de bord de votre activité.</p>
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
        onResetAll={() => setFilters(INITIAL)}
      />

      {loading && <RapportSkeleton />}

      {e1 && (
        <div className="rounded-md border border-error-border bg-error-subtle px-4 py-3 text-sm text-error-subtle-foreground">
          Impossible de charger le rapport. Réessayez plus tard.
        </div>
      )}

      {stats && !loading && <RapportSections stats={stats} alerts={alerts} stock={stock} />}
    </div>
  );
}


// ────────────────────────────────────────────────────────────────────────────
// ADMIN  (Vue système + per-pharmacy drill-down)
// ────────────────────────────────────────────────────────────────────────────

function AdminView() {
  const [pharmacyId, setPharmacyId] = useState<number | null>(null);
  const [filters, setFilters]       = useState<StatsFilters>(INITIAL);

  const { systemStats, isLoading: ls }         = useAdminStats();
  const { pharmacies }                         = useAdminPharmacies();
  const { stats,  isLoading: l1, isError: e1 } = useAdminPharmacyStats(pharmacyId, filters);
  const { alerts, isLoading: l2 }              = useAdminPharmacyMarginAlerts(pharmacyId, filters);
  const { stock,  isLoading: l3 }              = useAdminPharmacyStockSummary(pharmacyId);

  const loading = pharmacyId !== null && (l1 || l2 || l3);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Rapport</h1>
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
          onResetAll={() => { setFilters(INITIAL); setPharmacyId(null); }}
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

        {stats && pharmacyId !== null && !loading && (
          <>
            {(() => {
              const selectedPharm = pharmacies.find((p) => p.id === pharmacyId);
              return selectedPharm ? <AdminContextStrip pharmacy={selectedPharm} /> : null;
            })()}
            <RapportSections stats={stats} alerts={alerts} stock={stock} />
          </>
        )}
      </section>
    </div>
  );
}


// ────────────────────────────────────────────────────────────────────────────
// Shared sections (used by both owner + admin variants)
// ────────────────────────────────────────────────────────────────────────────

interface SectionsProps {
  stats:  NonNullable<ReturnType<typeof useStats>["stats"]>;
  alerts: ReturnType<typeof useMarginAlerts>["alerts"];
  stock:  ReturnType<typeof useStockSummary>["stock"];
}

function RapportSections({ stats, alerts, stock }: SectionsProps) {
  return (
    <>
      {/* Section 2 — Indicateurs clés (Bento hero with aurora + sparkline) */}
      <IndicateursCles stats={stats} />

      {/* Section 3 — Indicateurs avancés */}
      <IndicateursAvances kpis={stats.advanced_kpis} />

      {/* Section 4 — Donut chart + Santé financière (left) + Top catégories (right) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
        <CategoriesDonut categories={stats.top_categories} />
        <TopCategoriesList categories={stats.top_categories} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
        <SanteFinanciereCard marge={stats.marge} />
        <TrendChart points={stats.monthly_trend} />
      </div>

      {/* Section 5 — Alertes marges */}
      {alerts && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Alertes marges</h2>
          <MarginAlertCards data={alerts} />
        </section>
      )}

      {/* Section 6 — Déclaration TVA */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Déclaration TVA</h2>
        <TvaTiles tva={stats.tva} />
      </section>

      {/* Section 7 — Analyse de marge preview (3 tiles + gauge placeholder + CTA) */}
      <AnalyseMargePreview stats={stats} />

      {/* Section 8 — Stock summary (4 tiles + info card + CTAs) */}
      {stock && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stock</h2>
          <StockSummaryTiles stock={stock} />
        </section>
      )}
    </>
  );
}