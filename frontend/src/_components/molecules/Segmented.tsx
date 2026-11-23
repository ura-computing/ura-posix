/** Pill-shaped segmented control with category-color tints when active.
 *
 *  Generic over the value type so any 2–5-option segment can use it.
 *  Used as the "Mixte / Pharmacie / Parapharmacie" filter on Rapport, Alertes,
 *  Ventes (categoryType filter).
 *
 *  Style is locked: rounded-full pill bg-surface-subtle with rounded-full
 *  buttons that pick up the option's `activeBg` class when selected. The active
 *  background slides from one option to the next (same spring as TabBar's underline).
 *  `activeBg` omitted = primary.
 */
import { useId } from "react";
import { motion } from "framer-motion";

import { cn } from "@/utils/cn";

const PRIMARY_ACTIVE = "bg-primary text-primary-foreground shadow-sm";

export interface SegmentOption<V extends string> {
  value: V;
  label: string;
  /** Tailwind classes applied when this option is active (default: primary). */
  activeBg?: string;
}

export interface SegmentedProps<V extends string> {
  value: V;
  options: SegmentOption<V>[];
  onChange: (v: V) => void;
  className?: string;
}

export function Segmented<V extends string>({ value, options, onChange, className }: SegmentedProps<V>) {
  const indicatorId = useId(); // one sliding pill per control (two controls side by side never share it)
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
        const activeBg = opt.activeBg ?? PRIMARY_ACTIVE;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              // h-full fills the parent's h-9; rounded-sm sits visually nested inside rounded-md
              // duration-300: the text turns light as the pill arrives (not before: white on grey for a moment).
              "relative h-full shrink-0 cursor-pointer whitespace-nowrap rounded-sm px-3 text-sm font-semibold transition-colors duration-300",
              // The text color of `activeBg`; its background + shadow are drawn by the sliding pill below.
              active ? cn(activeBg, "!bg-transparent !shadow-none") : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={indicatorId}
                aria-hidden
                className={cn("absolute inset-0 rounded-sm", activeBg)}
                transition={{ type: "spring", stiffness: 420, damping: 42 }}
              />
            )}
            <span className="relative">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
