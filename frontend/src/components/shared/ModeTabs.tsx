/** Horizontal scrollable tab strip — generic mode picker.
 *
 *  Used on /analyse for the 8 modes (Produit / Catégorie / Laboratoire /
 *  Grossistes / Client / Mois / Année / Liste). Scrolls horizontally on
 *  narrow viewports; active tab gets a primary underline + text color.
 *
 *  Reusable for any future page that needs >5 mutually-exclusive views.
 */
import { cn } from "@/utils/cn";


export interface ModeTabOption<K extends string> {
  value: K;
  label: string;
}


export interface ModeTabsProps<K extends string> {
  value:     K;
  options:   ModeTabOption<K>[];
  onChange:  (v: K) => void;
  className?: string;
}


export function ModeTabs<K extends string>({
  value, options, onChange, className,
}: ModeTabsProps<K>) {
  return (
    <div
      role="tablist"
      className={cn(
        "flex gap-1 overflow-x-auto border-b border-border",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "shrink-0 cursor-pointer whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors -mb-px",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
