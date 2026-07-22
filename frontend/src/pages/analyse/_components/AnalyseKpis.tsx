/** 8 KPI tiles for /analyse (old-app parity):
 *  Row 1 — CA, Marge moyenne %, Marge moyenne DH, Optimisation.
 *  Row 2 — Unités vendues, Unités disponibles, Prix unitaires achetés, PPV disponibles.
 *  Reuses shared KpiTile + NeedleGauge primitives. */
import { BarChart3, Boxes, Coins, Percent, ShoppingCart, Sparkles, TrendingUp } from "lucide-react";

import { KpiTile } from "@/components/shared/KpiTile";
import { NeedleGauge } from "@/components/shared/NeedleGauge";
import { Skeleton } from "@/components/shared/Skeleton";
import { useT } from "@/i18n/I18nProvider";
import { formatMAD, formatPct, formatQty } from "@/utils/format";
import type { AnalyseMargeKpis } from "@/types";


export function AnalyseKpis({ kpis, isLoading }: { kpis?: AnalyseMargeKpis; isLoading?: boolean }) {
  const t = useT();
  if (isLoading && !kpis) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
    );
  }
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
        label={t("kpi.ca")}
        value={formatMAD(ca)}
        sub={<>{formatQty(unites)} {t("kpi.unites")}</>}
        icon={<Coins className="size-5" />}
        iconTone="primary"
      />
      <KpiTile
        label={t("kpi.margeMoyPct")}
        value={margePct != null ? formatPct(margePct) : "—"}
        sub={
          kpis?.marge_pct_max && kpis?.marge_pct_min ? (
            <>{t("kpi.max")} {formatPct(kpis.marge_pct_max.value)} · {t("kpi.min")} {formatPct(kpis.marge_pct_min.value)}</>
          ) : undefined
        }
        icon={<Percent className="size-5" />}
        iconTone="info"
      />
      <KpiTile
        label={t("kpi.margeMoyDh")}
        value={margeDh != null ? formatMAD(margeDh) : "—"}
        sub={
          kpis?.marge_dh_max && kpis?.marge_dh_min ? (
            <>{t("kpi.max")} {formatMAD(kpis.marge_dh_max.value)} · {t("kpi.min")} {formatMAD(kpis.marge_dh_min.value)}</>
          ) : undefined
        }
        icon={<TrendingUp className="size-5" />}
        iconTone="success"
      />
      <KpiTile
        label={t("kpi.optimisation")}
        value={kpis?.difference_gain_dh != null ? formatMAD(kpis.difference_gain_dh) : "—"}
        sub={t("kpi.optimisationSub")}
        icon={<Sparkles className="size-5" />}
        iconTone="warning"
      >
        <div className="mt-1 flex justify-center">
          <NeedleGauge value={gaugeValue} />
        </div>
      </KpiTile>

      {/* Row 2 — sub-KPIs (old-app parity). The stock/achat fields are only
          populated in produit + liste modes (pu also grossiste/laboratoire);
          elsewhere the backend sends null → "—". */}
      <KpiTile
        label={t("kpi.unitesVendues")}
        value={formatQty(unites)}
        sub={t("kpi.sumQtyVendues")}
        icon={<ShoppingCart className="size-5" />}
        iconTone="primary"
      />
      <KpiTile
        label={t("kpi.unitesDispo")}
        value={kpis?.total_units_available != null ? formatQty(kpis.total_units_available) : "—"}
        sub={t("kpi.sumStock")}
        icon={<Boxes className="size-5" />}
        iconTone="success"
      />
      <KpiTile
        label={t("kpi.prixUnitAchetes")}
        value={kpis?.total_pu_purchased != null ? formatMAD(kpis.total_pu_purchased) : "—"}
        sub={t("kpi.sumPuQty")}
        icon={<Coins className="size-5" />}
        iconTone="warning"
      />
      <KpiTile
        label={t("kpi.ppvDispo")}
        value={kpis?.ppv_total_available != null ? formatMAD(kpis.ppv_total_available) : "—"}
        sub={t("kpi.sumPpvStock")}
        icon={<BarChart3 className="size-5" />}
        iconTone="info"
      />
    </div>
  );
}
