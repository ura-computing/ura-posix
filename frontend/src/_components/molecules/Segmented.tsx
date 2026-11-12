/** Pill-shaped segmented control with category-color tints when active.
 *
 *  Generic over the value type so any 2–5-option segment can use it.
 *  Used as the "Mixte / Pharmacie / Parapharmacie" filter on Rapport, Alertes,
 *  Ventes (categoryType filter).
 *
 *  Style is locked: rounded-full pill bg-surface-subtle with rounded-full
 *  buttons that pick up the option's `activeBg` class when selected.
 */
import { cn } from "@/utils/cn";

export interface SegmentOption<V extends string> {
  value: V;
  label: string;
  /** Tailwind classes applied when this option is active. */
  activeBg: string;
}

export interface SegmentedProps<V extends string> {
  value: V;
  options: SegmentOption<V>[];
  onChange: (v: V) => void;
  className?: string;
}

export function Segmented<V extends string>({ value, options, onChange, className }: SegmentedProps<V>) {
  return (
    <div
      className={cn(
        // Match date-input shape: h-9 + rounded-md + bordered surface-subtle shell
        "inline-flex h-9 max-w-full items-center self-start overflow-x-auto rounded-md border border-input bg-surface-subtle p-0.5",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              // h-full fills the parent's h-9; rounded-sm sits visually nested inside rounded-md
              "h-full shrink-0 cursor-pointer whitespace-nowrap rounded-sm px-3 text-sm font-semibold transition-colors",
              active ? opt.activeBg : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
