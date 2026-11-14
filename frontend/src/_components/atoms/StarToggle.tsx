/** A star ticked like the app's `Checkbox` (same border, same primary fill): ☆ = not chosen, ★ = chosen. Produits
 *  spéciaux: ★ = taken out of Comptabilité (search results, « BL par Fournisseur », the « exclus » list).
 *
 *  Accessibility: button role="checkbox" + aria-checked; give it an `aria-label` (no visible text names it) and a
 *  `title` saying what a click does. */
import { Star } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/utils/cn";

interface StarToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onChange?: (next: boolean) => void;
}

export function StarToggle({ checked, onChange, disabled, className, ...rest }: StarToggleProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-[1.5px] transition-colors",
        "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
        checked
          ? "border-primary bg-primary text-primary-foreground hover:bg-primary-hover"
          : "border-muted-foreground/70 bg-card text-muted-foreground hover:border-primary hover:text-primary",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      {...rest}
    >
      <Star className={cn("size-3.5", checked && "fill-current")} strokeWidth={2.5} aria-hidden />
    </button>
  );
}
