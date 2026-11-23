/** Steps of a process: done ones ticked (primary), the current one outlined, the next ones numbered.
 *  `horizontal` (default, joined by a line): « Importer un fichier » 1 Type · 2 Fichier · 3 Aperçu.
 *  `vertical`: a store request's 5 steps, in a side card.
 *
 *    <Stepper steps={["Type de document", "Fichier CSV", "Aperçu et import"]} current={1} />   // 0-based */
import { Check } from "lucide-react";

import { cn } from "@/utils/cn";

export function Stepper({
  steps,
  current,
  vertical = false,
}: {
  steps: string[];
  current: number;
  vertical?: boolean;
}) {
  return (
    <ol className={cn("flex w-full gap-3", vertical ? "flex-col" : "items-center justify-between")}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-3">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary bg-primary/10 text-primary",
                  !done && !active && "border-border bg-card text-muted-foreground",
                )}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  !vertical && "hidden sm:inline",
                  done || active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {!vertical && i < steps.length - 1 && (
              <span
                className={cn("ml-2 h-[2px] flex-1 rounded-full transition-colors", done ? "bg-primary" : "bg-border")}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
