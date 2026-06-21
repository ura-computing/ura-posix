// src/pages/alertes/_components/GlobalSummaryStrip.tsx
import type { ReactNode } from "react";
import { AlertTriangle, TrendingDown, CalendarX, PackageMinus, PackagePlus } from "lucide-react";
import { formatQty } from "@/utils/format";

export interface GlobalSummaryStripProps {
  totalAlerts: number;
  marginNegative: number;
  marginLow: number;
  peremptionCritical: number;
  toRestock: number;
  excessStock: number;
}

function Chip({ icon, color, label, value }: { icon: ReactNode; color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2 shadow-sm">
      <span className={`flex size-8 items-center justify-center rounded-md ${color}`}>{icon}</span>
      <div className="flex flex-col">
        <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-lg font-bold tabular-nums text-foreground">{formatQty(value)}</span>
      </div>
    </div>
  );
}

export function GlobalSummaryStrip(p: GlobalSummaryStripProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Chip icon={<AlertTriangle className="size-4" />} color="bg-red-500/10 text-red-500" label="Alertes totales" value={p.totalAlerts} />
      <Chip icon={<TrendingDown className="size-4" />} color="bg-red-500/10 text-red-500" label="Marges négatives" value={p.marginNegative} />
      <Chip icon={<TrendingDown className="size-4" />} color="bg-amber-500/10 text-amber-500" label="Marges faibles" value={p.marginLow} />
      <Chip icon={<CalendarX className="size-4" />} color="bg-red-500/10 text-red-500" label="Péremptions critiques" value={p.peremptionCritical} />
      <Chip icon={<PackageMinus className="size-4" />} color="bg-amber-500/10 text-amber-500" label="Stock à réapprovisionner" value={p.toRestock} />
      <Chip icon={<PackagePlus className="size-4" />} color="bg-blue-500/10 text-blue-500" label="Stock excessif" value={p.excessStock} />
    </div>
  );
}
