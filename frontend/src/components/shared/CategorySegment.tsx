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
  value:    V;
  label:    string;
  /** Tailwind classes applied when this option is active. */
  activeBg: string;
}


export interface CategorySegmentProps<V extends string> {
  value:    V;
  options:  SegmentOption<V>[];
  onChange: (v: V) => void;
  className?: string;
}


export function CategorySegment<V extends string>({
  value, options, onChange, className,
}: CategorySegmentProps<V>) {
  return (
    <div
      className={cn(
        // Match date-input shape: h-9 + rounded-md + bordered surface-subtle shell
        "inline-flex h-9 items-center self-start rounded-md border border-input bg-surface-subtle p-0.5",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              // h-full fills the parent's h-9; rounded-sm sits visually nested inside rounded-md
              "h-full cursor-pointer rounded-sm px-3 text-sm font-semibold transition-colors",
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


/** Standard 3-option set for "Catégorie" filter — Mixte / Pharmacie / Parapharmacie.
 *  Locked palette: primary teal for Mixte, indigo for Pharmacie, orange for
 *  Parapharmacie (matches the tokens.css category trio). */
export const CATEGORY_TYPE_OPTIONS: SegmentOption<"all" | "pharmacie" | "parapharmacie">[] = [
  { value: "all",           label: "Mixte",         activeBg: "bg-primary text-primary-foreground shadow-sm" },
  { value: "pharmacie",     label: "Pharmacie",     activeBg: "bg-pharmacie-bg text-pharmacie-fg border border-pharmacie-border" },
  { value: "parapharmacie", label: "Parapharmacie", activeBg: "bg-parapharmacie-bg text-parapharmacie-fg border border-parapharmacie-border" },
];
