/** A small label: a type, a status, « déjà exclu », a count. One shape, one tone per meaning:
 *  `pharmacie` / `parapharmacie` (category colors), `success` / `warning` / `error` / `info`,
 *  `primary`, `neutral`. `dot`: a colored dot before the text (stock status). */
import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

export type BadgeTone =
  "neutral" | "primary" | "success" | "warning" | "error" | "info" | "pharmacie" | "parapharmacie";

const TONE: Record<BadgeTone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  primary: "border-primary/20 bg-primary/10 text-primary",
  success: "border-success-border bg-success-subtle text-success-subtle-foreground",
  warning: "border-warning-border bg-warning-subtle text-warning-subtle-foreground",
  error: "border-error-border bg-error-subtle text-error-subtle-foreground",
  info: "border-info-border bg-info-subtle text-info-subtle-foreground",
  pharmacie: "border-pharmacie-border bg-pharmacie-bg text-pharmacie-fg",
  parapharmacie: "border-parapharmacie-border bg-parapharmacie-bg text-parapharmacie-fg",
};

const SIZE = { sm: "px-1.5 py-0.5 text-[11px]", md: "px-2.5 py-1 text-sm" } as const;

export function Badge({
  tone = "neutral",
  size = "sm",
  dot,
  className,
  children,
}: {
  tone?: BadgeTone;
  size?: keyof typeof SIZE;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border font-medium",
        SIZE[size],
        TONE[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
