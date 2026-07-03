import type { ReactNode } from "react";

import { KpiTile } from "@/components/shared/KpiTile";
import { formatMAD } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { MargeSummary } from "@/types";


interface GradeDef { letter: string; label: string; bg: string; ring: string; text: string; }

function grade(marge_pct: number): GradeDef {
  if (marge_pct > 30) return { letter: "A+", label: "Excellente rentabilité", bg: "bg-success",     ring: "border-success", text: "text-success-foreground" };
  if (marge_pct > 25) return { letter: "A",  label: "Très bonne",             bg: "bg-success/80",  ring: "border-success", text: "text-success-foreground" };
  if (marge_pct > 20) return { letter: "B+", label: "Bonne",                  bg: "bg-info",        ring: "border-info",    text: "text-info-foreground" };
  if (marge_pct > 15) return { letter: "B",  label: "Correcte",               bg: "bg-info/80",     ring: "border-info",    text: "text-info-foreground" };
  if (marge_pct > 10) return { letter: "C",  label: "Faible",                 bg: "bg-warning",     ring: "border-warning", text: "text-warning-foreground" };
  if (marge_pct >  5) return { letter: "D",  label: "Critique",               bg: "bg-warning/80",  ring: "border-warning", text: "text-warning-foreground" };
  return                     { letter: "F",  label: "Insuffisante",           bg: "bg-error",       ring: "border-error",   text: "text-error-foreground" };
}


export function SanteFinanciereCard({ marge }: { marge: MargeSummary }) {
  const g = grade(marge.marge_pct);
  return (
    <KpiTile label="Santé financière" className="items-center text-center">
      <div className={cn(
        "mx-auto flex size-28 items-center justify-center rounded-full border-4 font-mono text-5xl font-bold tracking-tight",
        g.bg, g.ring, g.text,
      )}>
        {g.letter}
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold text-foreground">{g.label}</div>
        <div className="mt-0.5 font-mono text-sm tabular-nums text-muted-foreground">
          Marge moyenne : {marge.marge_pct.toFixed(2)} %
        </div>
      </div>
      <div className="grid w-full grid-cols-2 gap-3 rounded-xl bg-surface-subtle p-3">
        <Stat label="Marge brute" value={formatMAD(marge.marge_brute_dh)} />
        <Stat label="Marge nette" value={formatMAD(marge.marge_nette_dh)} />
      </div>
      <div className="text-center font-mono text-[10px] text-muted-foreground">
        A+ (&gt;30%) · A (&gt;25%) · B+ (&gt;20%) · B (&gt;15%) · C (&gt;10%) · D (&gt;5%) · F (≤5%)
      </div>
    </KpiTile>
  );
}


function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="font-mono text-sm font-bold tabular-nums text-foreground">{value}</span>
    </div>
  );
}
