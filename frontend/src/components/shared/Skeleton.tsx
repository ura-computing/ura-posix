import { cn } from "@/utils/cn";

/** Shimmer placeholder block. Compose to build page / table / KPI skeletons.
 *  Usage: <Skeleton className="h-4 w-24" />. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} aria-hidden />;
}
