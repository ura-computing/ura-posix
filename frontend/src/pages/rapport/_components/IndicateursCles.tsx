import { BarChart3, ShoppingCart, TrendingUp, Wallet } from "lucide-react";

import { formatMAD, formatQty, pctChange } from "@/utils/format";
import { ROUTES, type CategoryType, type StatsResponse } from "@/types";

import { KpiTile } from "@/components/shared/KpiTile";


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
  const ca       = stats.kpis.ventes_total;
  const achats   = stats.kpis.achats_total;
  const margePct = stats.marge.marge_pct;
  const txns     = stats.kpis.ventes_count;

  const dCA      = pctChange(ca,       stats.previous_kpis.ventes_total);
  const dAchats  = pctChange(achats,   stats.previous_kpis.achats_total);
  const dMarge   = pctChange(margePct, stats.previous_kpis.marge_pct);

  const phShare  = ca ? Math.round((stats.type_breakdown.pharmacie.ventes_total     / ca) * 100) : 0;
  const paShare  = ca ? Math.round((stats.type_breakdown.parapharmacie.ventes_total / ca) * 100) : 0;
  const sparkline = stats.monthly_trend.map((p) => p.ventes);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        hero
        href={ROUTES.COMPTABILITE}
        label="Chiffre d'affaires"
        value={formatMAD(ca)}
        delta={dCA != null ? { value: dCA } : null}
        icon={<Wallet className="size-5" />}
        sparkline={sparkline}
        sub={
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white">
              <span className="size-1.5 rounded-full" style={{ background: "var(--color-pharmacie)" }} />
              Pharmacie {phShare} %
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white">
              <span className="size-1.5 rounded-full" style={{ background: "var(--color-parapharmacie)" }} />
              Parapharmacie {paShare} %
            </span>
          </>
        }
      />
      <KpiTile
        className="lg:col-span-2"
        href={ROUTES.ACHATS}
        label="Total achats"
        value={formatMAD(achats)}
        sub={<>{formatQty(stats.kpis.achats_count)} unités</>}
        delta={dAchats != null ? { value: dAchats, invertColor: true } : null}
        icon={<ShoppingCart className="size-5" />}
        tint={tint}
      />
      <KpiTile
        label="Marge brute moyenne"
        value={`${margePct.toFixed(3)} %`}
        sub={`Année préc. : ${stats.previous_kpis.marge_pct.toFixed(3)} %`}
        delta={dMarge != null ? { value: dMarge } : null}
        icon={<TrendingUp className="size-5" />}
        tint={tint}
      />
      <KpiTile
        label="Transactions"
        value={formatQty(txns)}
        sub={<>Ticket moyen : {formatMAD(stats.advanced_kpis.ticket_moyen)}</>}
        icon={<BarChart3 className="size-5" />}
        tint={tint}
      />
    </div>
  );
}