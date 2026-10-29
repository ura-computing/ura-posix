/** What a block looks like while its data comes (slow connection): same size as the real thing, no
 *  jump when it arrives. `SkeletonText` lines, `SkeletonCard` a block, `SkeletonRows` a table body,
 *  `SkeletonTile` a figure tile, `PageSkeleton` a whole page (title, toolbar, table). */
import { Card } from "@/_components/atoms/Card";
import { Skeleton } from "@/_components/atoms/Skeleton";
import { cn } from "@/utils/cn";

const WIDTHS = ["w-3/4", "w-full", "w-5/6", "w-2/3"];

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-4", WIDTHS[i % WIDTHS.length])} />
      ))}
    </div>
  );
}

export function SkeletonCard({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <Card as="div" className={cn("flex flex-col gap-4", className)} aria-busy>
      <Skeleton className="h-4 w-40" />
      <SkeletonText lines={lines} />
    </Card>
  );
}

export function SkeletonRows({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="flex flex-col divide-y divide-border" aria-hidden>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={cn("h-4", c === 0 ? "w-1/4" : "flex-1")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonTile({ className }: { className?: string }) {
  return (
    <Card as="div" className={cn("flex flex-col gap-3", className)} aria-busy>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="size-9 rounded-xl" />
      </div>
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-3 w-20" />
    </Card>
  );
}

/** A page while its code or its first data comes: title, the toolbar, a table. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-14 w-full rounded-xl" />
      <Card as="div" padding="none">
        <SkeletonRows rows={8} />
      </Card>
    </div>
  );
}
