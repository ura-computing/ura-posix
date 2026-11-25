/** Steps of a process.
 *  - horizontal (default, joined by a line): done ones ticked (primary), the current one outlined, the next ones
 *    numbered. « Importer un fichier » 1 Type · 2 Fichier · 3 Aperçu.
 *  - `vertical`: a timeline down a side card (a store request, a promis). Reached steps are green and joined by a
 *    green rail, the current one has a halo, the next ones are grey. `notes`: a line under a step
 *    (« 25/11 14:02 · Karim »). `tone`: the current step went wrong (« Incident » orange, « Annulé » red).
 *    `current` = steps.length: every step done.
 *
 *         ● Créé            25/11 14:02 · Karim
 *         ┃
 *         ● Commandé        Sophadims
 *         ┃
 *         ◉ Reçu            (current)
 *         │
 *         ○ Prêt à retirer
 *
 *    <Stepper steps={["Type de document", "Fichier CSV", "Aperçu et import"]} current={1} />   // 0-based */
import type { ReactNode } from "react";
import { Check } from "lucide-react";

import { cn } from "@/utils/cn";

type StepTone = "success" | "warning" | "error";

const DOT: Record<StepTone, string> = {
  success: "border-success bg-success text-success-foreground",
  warning: "border-warning bg-warning text-warning-foreground",
  error: "border-error bg-error text-error-foreground",
};
const HALO: Record<StepTone, string> = {
  success: "ring-success/20",
  warning: "ring-warning/25",
  error: "ring-error/20",
};

interface StepperProps {
  steps: string[];
  current: number;
  vertical?: boolean;
  /** Vertical only: one line under each step (same order as `steps`, cut when too long); empty = nothing. */
  notes?: ReactNode[];
  /** Vertical only: the current step's color (default green). */
  tone?: StepTone;
}

export function Stepper(props: StepperProps) {
  return props.vertical ? <VerticalSteps {...props} /> : <HorizontalSteps {...props} />;
}

function VerticalSteps({ steps, current, notes, tone = "success" }: StepperProps) {
  return (
    <ol className="flex w-full flex-col">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const last = i === steps.length - 1;
        return (
          // Same height for every step (the label + one line), so the circles are evenly spaced.
          <li key={label} className={cn("relative flex gap-3", !last && "h-16")}>
            {/* The rail down to the next step: green once that step is reached. */}
            {!last && (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[11px] top-6 -bottom-0 w-0.5 rounded-full",
                  i + 1 <= current ? "bg-success" : "bg-border",
                )}
              />
            )}
            <span
              aria-current={active ? "step" : undefined}
              className={cn(
                "relative flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                done && DOT.success,
                active && cn(DOT[tone], "ring-4", HALO[tone]),
                !done && !active && "border-border bg-card",
              )}
            >
              {done && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
              {active && <span className="size-2 rounded-full bg-card" aria-hidden />}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5 pt-0.5">
              <span
                className={cn(
                  "text-sm",
                  active
                    ? "font-semibold text-foreground"
                    : done
                      ? "font-medium text-foreground"
                      : "text-muted-foreground",
                )}
              >
                {label}
              </span>
              {notes?.[i] && <span className="truncate text-xs text-muted-foreground">{notes[i]}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function HorizontalSteps({ steps, current }: StepperProps) {
  return (
    <ol className="flex w-full items-center justify-between gap-3">
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
                  "hidden text-sm font-medium sm:inline",
                  done || active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
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
