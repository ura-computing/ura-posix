import { SkeletonCard, SkeletonTile } from "@/_components/molecules/Skeletons";

/** The page's shape while its numbers load: the 4 main tiles (CA large, Achats wide, Marge,
 *  Transactions), the 4 advanced tiles, the CA split, then santé financière + the trend. */
export function RapportSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonTile className="min-h-[312px] sm:col-span-2 sm:row-span-2" />
        <SkeletonTile className="min-h-[150px] lg:col-span-2" />
        <SkeletonTile className="min-h-[150px]" />
        <SkeletonTile className="min-h-[150px]" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonTile key={i} className="min-h-[150px]" />
        ))}
      </div>
      <SkeletonCard lines={5} className="min-h-72" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
        <SkeletonCard lines={4} className="min-h-72" />
        <SkeletonCard lines={4} className="min-h-72" />
      </div>
    </div>
  );
}
