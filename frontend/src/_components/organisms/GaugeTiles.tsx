/** Needle gauge between two amounts + 3 summary tiles under it (ventes: sans / avec
 *  remise; achats: grossistes / direct laboratoire). The left side is the needle's
 *  red end, the right side its green end; `goodness` (0-100) places the needle. */
import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

import { NeedleGauge } from "@/_components/atoms/NeedleGauge";
import { Skeleton } from "@/_components/atoms/Skeleton";
import { SectionTitle } from "@/_components/atoms/SectionTitle";

export interface GaugeSide {
  title: string;
  value: ReactNode;
  sub: ReactNode;
}

export interface GaugeTilesProps {
  left: GaugeSide;
  right: GaugeSide;
  goodness: number;
  /** Line under the needle, e.g. « 42,10 % avec remise ». */
  caption: ReactNode;
  summary: { label: string; value: ReactNode }[];
  isLoading?: boolean;
}

export function GaugeTiles({ left, right, goodness, caption, summary, isLoading }: GaugeTilesProps) {
  if (isLoading) return <GaugeSkeleton />;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
        <SideTile side={left} dot="bg-error" />
        <div className="flex flex-col items-center justify-end">
          <NeedleGauge value={goodness} />
          <p className="-mt-1 text-sm font-medium text-muted-foreground">{caption}</p>
        </div>
        <SideTile side={right} dot="bg-success" alignRight />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
        {summary.map(({ label, value }) => (
          <div key={label} className="flex flex-col items-center text-center">
            <SectionTitle as="span" size="sm">
              {label}
            </SectionTitle>
            <span className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** One amount beside the gauge; the dot = which end of the needle it pulls to. */
function SideTile({ side, dot, alignRight = false }: { side: GaugeSide; dot: string; alignRight?: boolean }) {
  return (
    <div className={cn("px-1", alignRight && "md:text-right")}>
      <p
        className={cn(
          "flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
          alignRight && "md:justify-end",
        )}
      >
        <span className={cn("size-2 shrink-0 rounded-full", dot)} aria-hidden />
        {side.title}
      </p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">{side.value}</p>
      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{side.sub}</p>
    </div>
  );
}

function GaugeSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-2 pl-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="h-20 w-40 rounded-t-full" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="flex flex-col items-end gap-2 pr-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
