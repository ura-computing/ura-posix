import { Check } from "lucide-react";

import { cn } from "@/utils/cn";


/**
 * 3-dot stepper. Each dot is numbered when pending/active, replaced with a
 * checkmark when complete. Connectors fill in primary as steps advance.
 */

const STEPS = [
  { n: 1, label: "Type de document" },
  { n: 2, label: "Fichier CSV" },
  { n: 3, label: "Aperçu et import" },
] as const;


export function Stepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex w-full items-center justify-between gap-3">
      {STEPS.map((s, i) => {
        const done    = current > s.n;
        const active  = current === s.n;
        return (
          <li key={s.n} className="flex flex-1 items-center gap-3">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold tabular-nums",
                  done   && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary bg-primary/10 text-primary",
                  !done && !active && "border-border bg-card text-muted-foreground",
                )}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="size-4" aria-hidden /> : s.n}
              </span>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:inline",
                  (done || active) ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={cn(
                  "ml-2 h-[2px] flex-1 rounded-full transition-colors",
                  done ? "bg-primary" : "bg-border",
                )}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}