/** A block of a page: rounded, bordered, white. `tone`: `dashed` (an empty place), `error` /
 *  `warning` / `info` / `success` (a message block); `padding` none for a table inside. */
import type { HTMLAttributes } from "react";

import { cn } from "@/utils/cn";

export type CardTone = "default" | "dashed" | "error" | "warning" | "info" | "success";

const TONE: Record<CardTone, string> = {
  default: "border-border bg-card shadow-sm",
  dashed: "border-dashed border-border bg-card",
  error: "border-error-border bg-error-subtle text-error-subtle-foreground",
  warning: "border-warning-border bg-warning-subtle text-warning-subtle-foreground",
  info: "border-info-border bg-info-subtle text-info-subtle-foreground",
  success: "border-success-border bg-success-subtle text-success-subtle-foreground",
};

const PADDING = { none: "overflow-hidden", sm: "p-4", md: "p-5" } as const;

export function Card({
  as: Tag = "section",
  tone = "default",
  padding = "md",
  className,
  ...rest
}: HTMLAttributes<HTMLElement> & {
  as?: "section" | "div" | "article" | "li";
  tone?: CardTone;
  padding?: keyof typeof PADDING;
}) {
  return <Tag className={cn("rounded-2xl border", TONE[tone], PADDING[padding], className)} {...rest} />;
}
