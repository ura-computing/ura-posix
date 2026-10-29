/** The small grey capitals over a block (« INFORMATIONS GÉNÉRALES », « PRODUITS (3) »), + a hint
 *  after it. `size="sm"` inside a block (a group's title). */
import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

export function SectionTitle({
  as: Tag = "h2",
  size = "md",
  hint,
  className,
  children,
}: {
  as?: "h2" | "h3" | "h4" | "span";
  size?: "sm" | "md";
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const title = (
    <Tag
      className={cn(
        "font-semibold uppercase tracking-wide text-muted-foreground",
        size === "md" ? "text-sm" : "text-xs",
        !hint && className,
      )}
    >
      {children}
    </Tag>
  );
  if (!hint) return title;
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2", className)}>
      {title}
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  );
}
