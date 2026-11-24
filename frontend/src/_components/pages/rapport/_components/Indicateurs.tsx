import { useMe } from "@/hooks/useMe";
import { BarChart3, CalendarCheck, CalendarX, Receipt, ShoppingCart, TrendingUp, Wallet } from "lucide-react";
import type { CategoryType, StatsResponse, AdvancedKpis } from "@/types";
import { useT } from "@/i18n/I18nProvider";
import { KpiTile } from "@/_components/organisms/KpiTile";
import { formatDate, formatQty, formatMAD, formatPct, pctChange } from "@/utils/format";

export function IndicateursAvances({ kpis, tint = "all" }: { kpis: AdvancedKpis; tint?: CategoryType }) {
  const t = useT();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        label={t("kpi.ticketMoyen")}
        value={formatMAD(kpis.ticket_moyen)}
        icon={<Receipt className="size-5" />}
        tint={tint}
      />
      <KpiTile
        label={t("kpi.moyenneJour")}
        value={formatMAD(kpis.vente_moyenne_par_jour)}
        sub={t("kpi.ventesJourn")}
        icon={<BarChart3 className="size-5" />}
        tint={tint}
      />
      <KpiTile
        label={t("kpi.meilleureJournee")}
        value={formatMAD(kpis.best_day_dh?.total ?? 0)}
        sub={
          <>
            {formatDate(kpis.best_day_dh?.date)} · {formatQty(kpis.best_day_count?.count ?? 0)}{" "}
            {t("kpi.operationsShort")}
          </>
        }
        icon={<CalendarCheck className="size-5" />}
        tint={tint}
      />
      <KpiTile
        label={t("kpi.moinsBonneJournee")}
        value={formatMAD(kpis.worst_day_dh?.total ?? 0)}
        sub={
          <>
            {formatDate(kpis.worst_day_dh?.date)} · {formatQty(kpis.worst_day_count?.count ?? 0)}{" "}
            {t("kpi.operationsShort")}
          </>
        }
        icon={<CalendarX className="size-5" />}
        tint={tint}
      />
    </div>
  );
}

/**
 * Section 2 — 4 main KPI tiles in a Bento layout.
 *
 * CA is the hero (spans 2x2 on sm+) with an inline sparkline driven by the
 * monthly_trend `ventes` series. Other 3 tiles fill the satellites.
 *
 * Responsive grid (Bento):
 *   ≥ 1024px (lg) → 4 cols, CA spans 2x2 (rest 1x1)
 *   ≥ 640px  (sm) → 2 cols, CA spans 2x2 (rest 1x1 below)
 *   < 640px      → 1 col, CA on top
 */

export function IndicateursCles({ stats, tint = "all" }: { stats: StatsResponse; tint?: CategoryType }) {
  const t = useT();
  const { me } = useMe();
  const role = me?.role;
  const ca = stats.kpis.ventes_total;
  const achats = stats.kpis.achats_total;
  const margePct = stats.marge.marge_pct;
  const txns = stats.kpis.ventes_count;

  const dCA = pctChange(ca, stats.previous_kpis.ventes_total);
  const dAchats = pctChange(achats, stats.previous_kpis.achats_total);
  const dMarge = pctChange(margePct, stats.previous_kpis.marge_pct);

  const phShare = ca ? Math.round((stats.type_breakdown.pharmacie.ventes_total / ca) * 100) : 0;
  const paShare = ca ? Math.round((stats.type_breakdown.parapharmacie.ventes_total / ca) * 100) : 0;
  const sparkline = stats.monthly_trend.map((p) => p.ventes);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        hero
        href={`/${role}/comptabilite`}
        label={t("kpi.ca")}
        value={formatMAD(ca)}
        delta={dCA != null ? { value: dCA } : null}
        icon={<Wallet className="size-5" />}
        sparkline={sparkline}
        sub={
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white">
              <span className="size-1.5 rounded-full" style={{ background: "var(--color-pharmacie)" }} />
              {t("category.pharmacie")} {phShare} %
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white">
              <span className="size-1.5 rounded-full" style={{ background: "var(--color-parapharmacie)" }} />
              {t("category.parapharmacie")} {paShare} %
            </span>
          </>
        }
      />
      <KpiTile
        className="lg:col-span-2"
        href={`/${role}/achats`}
        label={t("kpi.totalAchats")}
        value={formatMAD(achats)}
        sub={
          <>
            {formatQty(stats.kpis.achats_count)} {t("common.wLignes")}
          </>
        }
        delta={dAchats != null ? { value: dAchats, invertColor: true } : null}
        icon={<ShoppingCart className="size-5" />}
        tint={tint}
      />
      <KpiTile
        label={t("kpi.margeBruteMoy")}
        value={formatPct(margePct)}
        sub={
          <>
            {t("kpi.anneePrec")} {formatPct(stats.previous_kpis.marge_pct)}
          </>
        }
        delta={dMarge != null ? { value: dMarge } : null}
        icon={<TrendingUp className="size-5" />}
        tint={tint}
      />
      <KpiTile
        label={t("kpi.transactions")}
        value={formatQty(txns)}
        sub={
          <>
            {t("kpi.ticketMoyenSub")} {formatMAD(stats.advanced_kpis.ticket_moyen)}
          </>
        }
        icon={<BarChart3 className="size-5" />}
        tint={tint}
      />
    </div>
  );
}
