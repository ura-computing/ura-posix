import type { ReactNode } from "react";

import { NeedleGauge } from "@/components/shared/NeedleGauge";
import { formatMAD, formatQty } from "@/utils/format";
import type { AchatsSupplierSummary } from "@/types";


export function SupplierGauge({ data }: { data: AchatsSupplierSummary | undefined }) {
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
          title="Grossistes"
          value={formatMAD(grossiste.total_mad)}
          sub={<>{formatQty(grossiste.bl_count)} BL · {formatQty(grossiste.unit_count)} unités</>}
          accent="border-l-rose-500/70"
        />
        <div className="flex flex-col items-center justify-end">
          <NeedleGauge value={goodness} />
          <p className="-mt-1 text-xs font-medium text-muted-foreground">
            <span className="font-mono tabular-nums text-foreground">{grossPct.toFixed(1)} %</span> grossistes
          </p>
        </div>
        <SideTile
          title="Direct laboratoire"
          value={formatMAD(directLabo.total_mad)}
          sub={<>{formatQty(directLabo.bl_count)} BL · {formatQty(directLabo.unit_count)} unités</>}
          accent="border-l-emerald-500/70"
          alignRight
        />
      </div>

      {/* 3 summary tiles under the gauge */}
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
        <SummaryTile label="Somme commandée" value={formatMAD(total)} />
        <SummaryTile label="BL"               value={formatQty(totalBl)} />
        <SummaryTile label="Unités"           value={formatQty(totalUnits)} />
      </div>
    </div>
  );
}


function SideTile({ title, value, sub, accent, alignRight = false }: {
  title: string; value: ReactNode; sub: ReactNode; accent: string; alignRight?: boolean;
}) {
  return (
    <div className={`border-l-2 ${accent} pl-3 ${alignRight ? "md:text-right md:border-l-0 md:border-r-2 md:pl-0 md:pr-3" : ""}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{sub}</p>
    </div>
  );
}


function SummaryTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="mt-1 font-mono text-base font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}