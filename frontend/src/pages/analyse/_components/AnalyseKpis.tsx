/** 4 KPI tiles for /analyse: CA, Marge moyenne %, Marge moyenne DH, Optimisation.
 *  Reuses shared KpiTile + NeedleGauge primitives. */
import { Coins, Percent, Sparkles, TrendingUp } from "lucide-react";

import { KpiTile } from "@/components/shared/KpiTile";
import { NeedleGauge } from "@/components/shared/NeedleGauge";
import { formatMAD, formatPct, formatQty } from "@/utils/format";
import type { AnalyseMargeKpis } from "@/types";


export function AnalyseKpis({ kpis }: { kpis?: AnalyseMargeKpis }) {
  const ca       = kpis?.total_ventes_dh ?? 0;
  const unites   = kpis?.total_ventes_unites ?? 0;
  const margePct = kpis?.marge_pct_avg;
  const margeDh  = kpis?.marge_dh_avg;
  const gain     = kpis?.difference_gain_dh ?? 0;

  // Gauge 0-100 — clamp `difference_gain_dh` against an arbitrary scale (10k MAD).
  // The gauge is a relative signal: bigger gain → higher needle.
  const gaugeValue = Math.max(0, Math.min(100, Math.round((gain / 10_000) * 100)));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <KpiTile
        label="Chiffre d'affaires"
        value={formatMAD(ca)}
        sub={<>{formatQty(unites)} unités</>}
        icon={<Coins className="size-5" />}
        iconTone="primary"
      />
      <KpiTile
        label="Marge moyenne (%)"
        value={margePct != null ? formatPct(margePct) : "—"}
        sub={
          kpis?.marge_pct_max && kpis?.marge_pct_min ? (
            <>Max {formatPct(kpis.marge_pct_max.value)} · Min {formatPct(kpis.marge_pct_min.value)}</>
          ) : undefined
        }
        icon={<Percent className="size-5" />}
        iconTone="info"
      />
      <KpiTile
        label="Marge moyenne (DH)"
        value={margeDh != null ? formatMAD(margeDh) : "—"}
        sub={
          kpis?.marge_dh_max && kpis?.marge_dh_min ? (
            <>Max {formatMAD(kpis.marge_dh_max.value)} · Min {formatMAD(kpis.marge_dh_min.value)}</>
          ) : undefined
        }
        icon={<TrendingUp className="size-5" />}
        iconTone="success"
      />
      <KpiTile
        label="Optimisation"
        value={kpis?.difference_gain_dh != null ? formatMAD(kpis.difference_gain_dh) : "—"}
        sub="Écart meilleur ↔ pire produit"
        icon={<Sparkles className="size-5" />}
        iconTone="warning"
      >
        <div className="mt-1 flex justify-center">
          <NeedleGauge value={gaugeValue} />
        </div>
      </KpiTile>
    </div>
  );
}
