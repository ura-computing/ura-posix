/** The product sheet while it loads: « Retour », photo + name, the 3 header tiles, the tabs, the 5
 *  figure tiles and the first block, at their real sizes. */
import { Skeleton } from "@/_components/atoms/Skeleton";
import { SkeletonCard, SkeletonTile } from "@/_components/molecules/Skeletons";

export function SheetSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy>
      <Skeleton className="h-11 w-56" />
      <div className="flex items-center gap-5">
        <Skeleton className="size-20 rounded-xl" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-80 max-w-full" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-11 w-full" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <SkeletonTile key={i} />
        ))}
      </div>
      <SkeletonCard lines={6} />
    </div>
  );
}
