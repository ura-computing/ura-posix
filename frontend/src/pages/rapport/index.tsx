import { useState } from "react";
import { Building2 } from "lucide-react";
import { useCategoryTypeOptions } from "@/hooks/useCategoryTypeOptions";
import { FilterBar, type ActiveFilter } from "@/_components/organisms/FilterBar";
import { SingleSelect } from "@/_components/molecules/SingleSelect";
import { useMe } from "@/hooks/useMe";
import { useGlobalDateRange } from "@/hooks/useGlobalDateRange";
import { isStaff } from "@/types";
import type { MargeMode, StatsFilters } from "@/types";
import {
  useAdminPharmacyStats,
  useAdminStats,
  useStockSummary,
  useAdminPharmacyAnalyseMarge,
  useAdminPharmacyMarginAlerts,
  useAdminPharmacyStockSummary,
} from "./hooks";
import { useAdminPharmaciesList, useMarginAlerts, useStats } from "@/hooks/useSharedQueries";
import { useT, type TFn } from "@/i18n/I18nProvider";
import { Page } from "@/_components/templates/Page";
import { SectionTitle } from "@/_components/atoms/SectionTitle";
import { EmptyState } from "@/_components/molecules/EmptyState";
import { LoadError } from "@/_components/molecules/LoadError";
import { SkeletonTile } from "@/_components/molecules/Skeletons";
import { RapportSections } from "./_components/RapportSections";
import { RapportSkeleton } from "./_components/RapportSkeleton";
import { AdminPharmacyBody } from "./_components/AdminPharmacyBody";
import { AdminSystemTiles } from "./_components/AdminSystemTiles";

const CATEGORY_KEY = {
  all: "category.mixte",
  pharmacie: "category.pharmacie",
  parapharmacie: "category.parapharmacie",
} as const;

/** Build the activeFilters[] array from StatsFilters — shared by both owner + admin views. */
function buildActiveFilters(filters: StatsFilters, setFilters: (f: StatsFilters) => void, t: TFn): ActiveFilter[] {
  return [
    filters.date_from || filters.date_to
      ? {
          key: "dates",
          label: (
            <>
              {t("dashboard.periode")} {filters.date_from ?? "…"} → {filters.date_to ?? "…"}
            </>
          ),
          onClear: () => setFilters({ ...filters, date_from: null, date_to: null }),
        }
      : null,
    filters.category_type !== "all"
      ? {
          key: "category",
          label: (
            <>
              {t("dashboard.categorieFilter")} {t(CATEGORY_KEY[filters.category_type])}
            </>
          ),
          onClear: () => setFilters({ ...filters, category_type: "all" }),
        }
      : null,
  ].filter(Boolean) as ActiveFilter[];
}

// Local-only filter slice — date fields come from the cross-route
// GlobalDateRangeProvider so picking dates on /rapport carries over to
// /achats, /ventes, /admin/stats, etc. The composed `StatsFilters` is built
// per-view by merging this local slice with the global range.
type LocalStatsFilters = Omit<StatsFilters, "date_from" | "date_to">;

const INITIAL_LOCAL: LocalStatsFilters = {
  category_type: "all",
  // USER DECISION 2026-08-01: special/excluded products + excluded fournisseurs/BLs
  // are INCLUDED in the Dashboard (Rapport). Only /comptabilite applies exclusions.
  include_non_declared: true,
};

export default function RapportPage() {
  const { me } = useMe();
  if (!me) return null;
  return isStaff(me.role) ? <AdminView /> : <OwnerView />;
}

// ────────────────────────────────────────────────────────────────────────────
// OWNER
// ────────────────────────────────────────────────────────────────────────────

function OwnerView() {
  const t = useT();
  const categoryTypeOptions = useCategoryTypeOptions();
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

  const { stats, isLoading: l1, isError: e1, reload } = useStats(filters);
  const { marginAlerts: alerts, isLoading: l2 } = useMarginAlerts(filters);
  const { stock, isLoading: l3 } = useStockSummary();

  const loading = l1 || l2 || l3;

  return (
    <Page title={t("dashboard.title")} subtitle={t("dashboard.subtitle")}>
      <FilterBar<StatsFilters["category_type"]>
        dateRange={{
          from: filters.date_from,
          to: filters.date_to,
          onChange: (from, to) => setFilters({ ...filters, date_from: from, date_to: to }),
        }}
        segment={{
          value: filters.category_type,
          onChange: (v) => setFilters({ ...filters, category_type: v }),
          options: categoryTypeOptions,
        }}
        activeFilters={buildActiveFilters(filters, setFilters, t)}
        onResetAll={() => {
          setLocal(INITIAL_LOCAL);
          setRange(null, null);
        }}
      />

      {loading && <RapportSkeleton />}

      {e1 && <LoadError message={t("dashboard.loadError")} onRetry={reload} />}

      {stats && !loading && (
        <RapportSections
          stats={stats}
          filters={filters}
          alerts={alerts}
          stock={stock}
          category={filters.category_type}
        />
      )}
    </Page>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ADMIN  (Vue système + per-pharmacy drill-down)
// ────────────────────────────────────────────────────────────────────────────

function AdminView() {
  const t = useT();
  const categoryTypeOptions = useCategoryTypeOptions();
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

  const { systemStats, isLoading: ls, isError: es, reload: reloadSystem } = useAdminStats();
  const { pharmacies = [] } = useAdminPharmaciesList();
  const { stats, isLoading: l1, isError: e1, reload } = useAdminPharmacyStats(pharmacyId, filters);
  const { alerts } = useAdminPharmacyMarginAlerts(pharmacyId, {
    date_from: dateFrom,
    date_to: dateTo,
    category_type: filters.category_type,
  });
  const { stock } = useAdminPharmacyStockSummary(pharmacyId);
  const { analyse, isLoading: analyseLoading } = useAdminPharmacyAnalyseMarge(pharmacyId, marginMode, {
    date_from: dateFrom,
    date_to: dateTo,
    category_type: filters.category_type,
  });

  const loading = pharmacyId !== null && l1;
  const subtitleDates =
    dateFrom || dateTo ? `${t("dashboard.periode")} ${dateFrom ?? "…"} → ${dateTo ?? "…"}` : t("trend.last12");

  return (
    <Page title={t("dashboard.title")} subtitle={t("dashboard.subtitleAdmin")}>
      {/* Vue système — always shown */}
      <section className="flex flex-col gap-3">
        <SectionTitle size="sm">{t("rapportAdmin.vueSysteme")}</SectionTitle>
        {es && !systemStats ? (
          <LoadError onRetry={reloadSystem} />
        ) : ls || !systemStats ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <SkeletonTile key={i} className="min-h-32" />
            ))}
          </div>
        ) : (
          <AdminSystemTiles stats={systemStats} />
        )}
      </section>

      {/* Per-pharmacy drill-down */}
      <section className="flex flex-col gap-3">
        <SectionTitle size="sm">{t("rapportAdmin.parPharmacie")}</SectionTitle>
        {/* Admin pharmacy picker — uses the shared SingleSelect so the
            trigger + panel match every other dropdown in the app (Catégorie,
            Type, Statut, page-size, etc.). */}
        <div className="flex flex-wrap items-center gap-3">
          <SingleSelect
            label={t("category.pharmacie")}
            value={pharmacyId != null ? String(pharmacyId) : ""}
            onChange={(v) => setPharmacyId(v ? Number(v) : null)}
            options={[
              { value: "", label: t("dashboard.toutesPharmacies") },
              ...pharmacies.map((p) => ({
                value: String(p.id),
                label: [p.code, p.name].filter(Boolean).join(" · "),
              })),
            ]}
          />
        </div>

        <FilterBar<StatsFilters["category_type"]>
          dateRange={{
            from: filters.date_from,
            to: filters.date_to,
            onChange: (from, to) => setFilters({ ...filters, date_from: from, date_to: to }),
          }}
          segment={{
            value: filters.category_type,
            onChange: (v) => setFilters({ ...filters, category_type: v }),
            options: categoryTypeOptions,
          }}
          activeFilters={[
            ...(pharmacyId !== null
              ? [
                  {
                    key: "pharmacy",
                    label: (
                      <>
                        {t("rapportAdmin.pharmacieFilter")}{" "}
                        {pharmacies.find((p) => p.id === pharmacyId)?.code ??
                          pharmacies.find((p) => p.id === pharmacyId)?.name ??
                          "—"}
                      </>
                    ),
                    onClear: () => setPharmacyId(null),
                  },
                ]
              : []),
            ...buildActiveFilters(filters, setFilters, t),
          ]}
          onResetAll={() => {
            setLocal(INITIAL_LOCAL);
            setRange(null, null);
            setPharmacyId(null);
          }}
        />

        {pharmacyId === null && (
          <EmptyState
            icon={<Building2 className="size-12" aria-hidden />}
            title={t("rapportAdmin.selectPharmacyHint")}
            className="py-16"
          />
        )}

        {loading && <RapportSkeleton />}

        {e1 && <LoadError message={t("rapportAdmin.pharmacyLoadError")} onRetry={reload} />}

        {stats &&
          pharmacyId !== null &&
          !loading &&
          (() => {
            const sel = pharmacies.find((p) => p.id === pharmacyId);
            const pharmacyLabel = sel ? [sel.code, sel.name].filter(Boolean).join(" · ") : "";
            return (
              <AdminPharmacyBody
                stats={stats}
                pharmacyLabel={pharmacyLabel}
                categoryType={filters.category_type}
                marginMode={marginMode}
                onMarginMode={setMarginMode}
                marginRows={(analyse?.rows ?? []) as Record<string, unknown>[]}
                marginLoading={analyseLoading}
                subtitleDates={subtitleDates}
                alerts={alerts}
                stock={stock}
              />
            );
          })()}
      </section>
    </Page>
  );
}
