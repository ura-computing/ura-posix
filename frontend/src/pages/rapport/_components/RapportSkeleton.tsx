export function RapportSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div className="h-12 animate-pulse rounded-xl bg-muted" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="h-44 animate-pulse rounded-2xl bg-muted sm:col-span-2 sm:row-span-2" />
        <div className="h-44 animate-pulse rounded-2xl bg-muted" />
        <div className="h-44 animate-pulse rounded-2xl bg-muted" />
        <div className="h-44 animate-pulse rounded-2xl bg-muted" />
      </div>
      <div className="h-60 animate-pulse rounded-2xl bg-muted" />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr]">
        <div className="h-72 animate-pulse rounded-2xl bg-muted" />
        <div className="h-72 animate-pulse rounded-2xl bg-muted" />
      </div>
    </div>
  );
}