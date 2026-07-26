import type { ReactNode } from "react";

import { NeedleGauge } from "@/components/shared/NeedleGauge";
import { Skeleton } from "@/components/shared/Skeleton";
import { formatMAD, formatQty, formatPct } from "@/utils/format";
import type { VentesDiscountSummary } from "@/types";
import { useT } from "@/i18n/I18nProvider";


/** Remise gauge. Per the manager's framing on this pharmacy, granting a
 *  remise is treated as the *desirable* outcome — so "Avec remise" sits on
 *  the right (emerald) and the needle goes greener as the discounted share
 *  rises. "Sans remise" sits on the left (rose). Goodness = discounted %. */
export function DiscountGauge({ data, isLoading }: { data: VentesDiscountSummary | undefined; isLoading?: boolean }) {
  const t = useT();
  if (isLoading && !data) return <GaugeSkeleton />;
  const discounted = data?.discounted ?? { total_mad: 0, count: 0, unit_count: 0 };
  const fullPrice  = data?.full_price ?? { total_mad: 0, count: 0, unit_count: 0 };

  const total       = discounted.total_mad + fullPrice.total_mad;
  const discPct     = total > 0 ? (discounted.total_mad / total) * 100 : 0;
  const totalLines  = discounted.count + fullPrice.count;
  const totalUnits  = discounted.unit_count + fullPrice.unit_count;

  // NeedleGauge expects 0-100 "goodness": 0=left/red, 100=right/green.
  const goodness = discPct;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
        <SideTile
          title={t("ventes.sansRemise")}
          value={formatMAD(fullPrice.total_mad)}
          sub={<>{formatQty(fullPrice.count)} {t("common.wLignes")} · {formatQty(fullPrice.unit_count)} {t("common.wUnites")}</>}
          accent="border-l-rose-500/70"
        />
        <div className="flex flex-col items-center justify-end">
          <NeedleGauge value={goodness} />
          <p className="-mt-1 text-sm font-medium text-muted-foreground">
            <span className="font-mono tabular-nums text-foreground">{formatPct(discPct)}</span> {t("ventes.avecRemiseInline")}
          </p>
        </div>
        <SideTile
          title={t("ventes.avecRemise")}
          value={formatMAD(discounted.total_mad)}
          sub={<>{formatQty(discounted.count)} {t("common.wLignes")} · {formatQty(discounted.unit_count)} {t("common.wUnites")}</>}
          accent="border-l-emerald-500/70"
          alignRight
        />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
        <SummaryTile label={t("ventes.caTotal")} value={formatMAD(total)} />
        <SummaryTile label={t("kpi.transactions")} value={formatQty(totalLines)} />
        <SummaryTile label={t("col.unites")}   value={formatQty(totalUnits)} />
      </div>
    </div>
  );
}


function GaugeSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-2 pl-3">
          <Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-32" /><Skeleton className="h-3 w-24" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-20 w-40 rounded-t-full" /><Skeleton className="h-3 w-24" />
        </div>
        <div className="flex flex-col items-end gap-2 pr-3">
          <Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-32" /><Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="h-3 w-16" /><Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}


function SideTile({ title, value, sub, accent, alignRight = false }: {
  title: string; value: ReactNode; sub: ReactNode; accent: string; alignRight?: boolean;
}) {
  return (
    <div className={`border-l-2 ${accent} pl-3 ${alignRight ? "md:text-right md:border-l-0 md:border-r-2 md:pl-0 md:pr-3" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{sub}</p>
    </div>
  );
}


function SummaryTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}
