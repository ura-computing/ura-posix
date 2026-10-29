/** An empty place (no line yet, nothing found): a dashed block with an icon, one sentence, a hint
 *  and, when there is one, the action that fills it. */
import type { ReactNode } from "react";

import { Card } from "@/_components/atoms/Card";
import { cn } from "@/utils/cn";

export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <Card tone="dashed" as="div" className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {hint && <p className="max-w-md text-sm text-muted-foreground">{hint}</p>}
      {action}
    </Card>
  );
}
