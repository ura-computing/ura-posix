/** Turning circle: only inside a button (`Button isLoading`) or a tiny inline lookup. A page area that
 *  waits for data shows a skeleton instead (its shape, no jump). */
import { Loader2 } from "lucide-react";

import { cn } from "@/utils/cn";

const SIZE = { sm: "size-3.5", md: "size-4", lg: "size-5" } as const;

export function Spinner({ size = "md", className }: { size?: keyof typeof SIZE; className?: string }) {
  return <Loader2 className={cn("shrink-0 animate-spin", SIZE[size], className)} aria-hidden />;
}
