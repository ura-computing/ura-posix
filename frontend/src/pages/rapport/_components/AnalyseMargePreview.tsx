import { Coins, Percent, TrendingUp, UploadCloud } from "lucide-react";
import { Link } from "react-router-dom";

import { formatMAD } from "@/utils/format";
import { cn } from "@/utils/cn";
import { ROUTES } from "@/types";
import type { CategoryType, StatsResponse } from "@/types";

import { KpiTile } from "@/components/shared/KpiTile";

import { useCategoryTint } from "../_hooks/useCategoryTint";


/**
 * Section 8 — Analyse de marge preview.
 *
 * 3 KPI tiles fed from the existing /v1/stats data (no extra endpoint), plus a
 * static Optimisation gauge placeholder (locked until /v1/stats/analyse-marge
 * ships with the /analyse page), plus a dashed CTA card linking out.
 */

export function AnalyseMargePreview({ stats, tint = "all" }: { stats: StatsResponse; tint?: CategoryType }) {
  const ca       = stats.kpis.ventes_total;
  const margePct = stats.marge.marge_pct;
  // Single source of truth: the backend reconciles marge_brute_dh to the full CA
  // (marge_brute_dh / CA == marge_pct), so every margin display reads the same value.
  const margeDh  = stats.marge.marge_brute_dh;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Analyse de marge
      </h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Chiffre d'affaires" value={formatMAD(ca)}                icon={<Coins      className="size-5" />} tint={tint} />
        <KpiTile label="Marge moyenne (%)"  value={`${margePct.toFixed(3)} %`}   icon={<Percent    className="size-5" />} tint={tint} />
        <KpiTile label="Marge moyenne (MAD)" value={formatMAD(margeDh)}          icon={<TrendingUp className="size-5" />} tint={tint} />
        <OptimisationGaugePlaceholder tint={tint} />
      </div>

      <CtaCard tint={tint} />
    </section>
  );
}


/** Static half-circle gauge. Real data lands when /analyse page is built and the
 *  /v1/stats/analyse-marge endpoint exposes `difference_gain_dh`. Until then we
 *  show a calm, branded "à venir" state — not a sad empty box. */
function OptimisationGaugePlaceholder({ tint }: { tint: CategoryType }) {
  const { cardClass } = useCategoryTint(tint);
  return (
    <div className={cn("flex flex-col items-center justify-between gap-2 rounded-2xl p-5 shadow-sm", cardClass)}>
      <span className="self-start text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Optimisation
      </span>
      <svg viewBox="0 0 120 70" width="120" height="70" aria-hidden>
        {/* base half-ring */}
        <path d="M 12 60 A 48 48 0 0 1 108 60" fill="none" stroke="var(--surface-subtle)" strokeWidth="10" strokeLinecap="round" />
        {/* small primary fill (~25 %) hinting at the live state */}
        <path d="M 12 60 A 48 48 0 0 1 36 18" fill="none" stroke="var(--primary)" strokeWidth="10" strokeLinecap="round" opacity="0.6" />
      </svg>
      <span className="text-center text-xs text-muted-foreground">
        Disponible après analyse personnalisée
      </span>
    </div>
  );
}


function CtaCard({ tint }: { tint: CategoryType }) {
  // CtaCard keeps its dashed border but adopts the category's bg tint.
  const dashedTint = tint === "pharmacie"
    ? "border-pharmacie-border bg-pharmacie-bg/30"
    : tint === "parapharmacie"
    ? "border-parapharmacie-border bg-parapharmacie-bg/30"
    : "border-border bg-surface-subtle/30";
  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl border-2 border-dashed p-5 sm:flex-row sm:items-center sm:gap-4", dashedTint)}>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <UploadCloud className="size-5" />
      </div>
      <div className="flex-1">
        <h3 className="text-base font-semibold text-foreground">Analyse personnalisée</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Importez une liste de produits ou sélectionnez des éléments pour simuler vos marges.
        </p>
      </div>
      <Link
        to={ROUTES.ANALYSES}
        className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md bg-primary px-4 py-2 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        Créer une analyse
      </Link>
    </div>
  );
}