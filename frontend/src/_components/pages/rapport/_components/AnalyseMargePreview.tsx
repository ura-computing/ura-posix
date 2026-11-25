import { useMe } from "@/hooks/useMe";
import { Sparkles, Coins, TrendingUp, Percent, UploadCloud } from "lucide-react";
import type { CategoryType, StatsFilters, StatsResponse } from "@/types/stats";
import { useOptimisationGain } from "../hooks";
import { useT } from "@/i18n/I18nProvider";
import { KpiTile } from "@/_components/organisms/KpiTile";
import { NeedleGauge } from "@/_components/atoms/NeedleGauge";
import { formatMAD, formatPct } from "@/utils/format";
import { Link } from "react-router-dom";
import { cn } from "@/utils/cn";
import { SectionTitle } from "@/_components/atoms/SectionTitle";

/**
 * Section 8 — Analyse de marge preview.
 *
 * 3 KPI tiles from /v1/stats, the Optimisation tile (same gain as /analyses),
 * plus a dashed CTA card linking out.
 */

export function AnalyseMargePreview({
  stats,
  filters,
  tint = "all",
}: {
  stats: StatsResponse;
  filters: StatsFilters;
  tint?: CategoryType;
}) {
  const t = useT();
  const ca = stats.kpis.ventes_total;
  const margePct = stats.marge.marge_pct;
  // Single source of truth: the backend reconciles marge_brute_dh to the full CA
  // (marge_brute_dh / CA == marge_pct), so every margin display reads the same value.
  const margeDh = stats.marge.marge_brute_dh;

  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>{t("preview.sectionTitle")}</SectionTitle>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label={t("kpi.ca")} value={formatMAD(ca)} icon={<Coins className="size-5" />} tint={tint} />
        <KpiTile
          label={t("kpi.margeMoyPct")}
          value={formatPct(margePct)}
          icon={<Percent className="size-5" />}
          tint={tint}
        />
        <KpiTile
          label={t("kpi.margeMoyDh")}
          value={formatMAD(margeDh)}
          icon={<TrendingUp className="size-5" />}
          tint={tint}
        />
        <OptimisationTile filters={filters} tint={tint} />
      </div>

      <CtaCard tint={tint} />
    </section>
  );
}

/** Optimisation: gain best ↔ worst product (DH), same value + gauge scale as /analyses. */
function OptimisationTile({ filters, tint }: { filters: StatsFilters; tint: CategoryType }) {
  const t = useT();
  const gain = useOptimisationGain(filters);
  const gauge = Math.max(0, Math.min(100, Math.round(((gain ?? 0) / 10_000) * 100)));
  return (
    <KpiTile
      label={t("kpi.optimisation")}
      value={gain != null ? formatMAD(gain) : "—"}
      sub={t("kpi.optimisationSub")}
      icon={<Sparkles className="size-5" />}
      tint={tint}
    >
      <div className="mt-1 flex justify-center">
        <NeedleGauge value={gauge} />
      </div>
    </KpiTile>
  );
}

function CtaCard({ tint }: { tint: CategoryType }) {
  const t = useT();
  const { me } = useMe();
  const role = me?.role;
  // CtaCard keeps its dashed border but adopts the category's bg tint.
  const dashedTint =
    tint === "pharmacie"
      ? "border-pharmacie-border bg-pharmacie-bg/30"
      : tint === "parapharmacie"
        ? "border-parapharmacie-border bg-parapharmacie-bg/30"
        : "border-border bg-surface-subtle/30";
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl border-2 border-dashed p-5 sm:flex-row sm:items-center sm:gap-4",
        dashedTint,
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <UploadCloud className="size-5" />
      </div>
      <div className="flex-1">
        <h3 className="text-base font-semibold text-foreground">{t("preview.personalTitle")}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("preview.personalDesc")}</p>
      </div>
      <Link
        to={`/${role}/analyses`}
        className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md bg-primary px-4 py-2 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        {t("preview.createAnalyse")}
      </Link>
    </div>
  );
}
