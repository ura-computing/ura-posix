import type { ReactNode } from "react";

import { NeedleGauge } from "@/components/shared/NeedleGauge";
import { Skeleton } from "@/components/shared/Skeleton";
import { formatMAD, formatQty } from "@/utils/format";
import type { AchatsSupplierSummary } from "@/types";
import { useT } from "@/i18n/I18nProvider";


export function SupplierGauge({ data, isLoading }: { data: AchatsSupplierSummary | undefined; isLoading?: boolean }) {
  const t = useT();
  if (isLoading && !data) return <GaugeSkeleton />;
  const grossiste   = data?.grossiste   ?? { total_mad: 0, bl_count: 0, unit_count: 0 };
  const directLabo  = data?.direct_labo ?? { total_mad: 0, bl_count: 0, unit_count: 0 };

  const total      = grossiste.total_mad + directLabo.total_mad;
  const grossPct   = total > 0 ? (grossiste.total_mad / total) * 100 : 0;
  const totalBl    = grossiste.bl_count + directLabo.bl_count;
  const totalUnits = grossiste.unit_count + directLabo.unit_count;

  // NeedleGauge expects 0-100 "goodness": 0=left/red, 100=right/green.
  // For Achats, more direct laboratoire = more healthy supplier mix.
  const goodness = 100 - grossPct;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {/* Top row: grossistes tile · gauge · direct labo tile */}
      <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
        <SideTile
          title={t("achats.grossistes")}
          value={formatMAD(grossiste.total_mad)}
          sub={<>{formatQty(grossiste.bl_count)} BL · {formatQty(grossiste.unit_count)} {t("kpi.unites")}</>}
          accent="border-l-rose-500/70"
        />
        <div className="flex flex-col items-center justify-end">
          <NeedleGauge value={goodness} />
          <p className="-mt-1 text-sm font-medium text-muted-foreground">
            <span className="font-mono tabular-nums text-foreground">{grossPct.toFixed(3)} %</span> {t("achats.grossistesInline")}
          </p>
        </div>
        <SideTile
          title={t("achats.directLabo")}
          value={formatMAD(directLabo.total_mad)}
          sub={<>{formatQty(directLabo.bl_count)} BL · {formatQty(directLabo.unit_count)} {t("kpi.unites")}</>}
          accent="border-l-emerald-500/70"
          alignRight
        />
      </div>

      {/* 3 summary tiles under the gauge */}
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
        <SummaryTile label={t("achats.sommeCommandee")} value={formatMAD(total)} />
        <SummaryTile label={t("achats.bl")}               value={formatQty(totalBl)} />
        <SummaryTile label={t("col.unites")}           value={formatQty(totalUnits)} />
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