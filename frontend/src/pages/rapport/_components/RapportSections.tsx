import { useMe } from "@/hooks/useMe";
import { ROLES, type MarginAlertsResponse } from "@/types";
import type { CategoryType, Feature, StatsFilters } from "@/types";
import { useStockSummary } from "../hooks";
import { useStats } from "@/hooks/sharedQueries";
import { useT } from "@/i18n/I18nProvider";
import { SectionTitle } from "@/_components/atoms/SectionTitle";
import { MarginAlertCards } from "./MarginAlertCards";
import { StockSummaryTiles } from "./StockSummaryTiles";
import { AnalyseMargePreview } from "./AnalyseMargePreview";
import { CategoriesDonut } from "./CategoriesDonut";
import { IndicateursAvances, IndicateursCles } from "./Indicateurs";
import { SanteFinanciereCard } from "./SanteFinanciereCard";
import { TrendChart } from "./TrendChart";
import { TvaTiles } from "./TvaTiles";

// ────────────────────────────────────────────────────────────────────────────
// Shared sections (used by both owner + admin variants)
// ────────────────────────────────────────────────────────────────────────────

interface SectionsProps {
  stats: NonNullable<ReturnType<typeof useStats>["stats"]>;
  filters: StatsFilters;
  alerts: MarginAlertsResponse | undefined;
  stock: ReturnType<typeof useStockSummary>["stock"];
  category: CategoryType;
}

export function RapportSections({ stats, filters, alerts, stock, category }: SectionsProps) {
  const t = useT();
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
          <SectionTitle size="sm">{t("rapportAdmin.alertesMarges")}</SectionTitle>
          <MarginAlertCards data={alerts} tint={category} />
        </section>
      )}

      {/* Section 6 — Déclaration TVA (feature: accounting) */}
      {has("accounting") && (
        <section className="flex flex-col gap-3">
          <SectionTitle size="sm">{t("rapportAdmin.declarationTva")}</SectionTitle>
          <TvaTiles tva={stats.tva} tint={category} />
        </section>
      )}

      {/* Section 7 — Analyse de marge preview (feature: analyse) */}
      {has("analyse") && <AnalyseMargePreview stats={stats} filters={filters} tint={category} />}

      {/* Section 8 — Stock summary (feature: stock) */}
      {has("stock") && stock && (
        <section className="flex flex-col gap-3">
          <SectionTitle size="sm">{t("col.stock")}</SectionTitle>
          <StockSummaryTiles stock={stock} tint={category} />
        </section>
      )}
    </>
  );
}
