/** Checkbox matching the app's design tokens (same family as `Switch`): rounded box,
 *  primary fill + check when ticked, a dash when only some rows are ticked (`mixed`).
 *
 *  Accessibility: button role="checkbox" + aria-checked (true / false / "mixed");
 *  give it an `aria-label` when no visible text names it. */
import { Check, Minus } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/utils/cn";

interface CheckboxProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  /** Some (not all) of the rows it stands for are ticked: shows a dash. */
  mixed?: boolean;
  onChange?: (next: boolean) => void;
}

export function Checkbox({ checked, mixed = false, onChange, disabled, className, ...rest }: CheckboxProps) {
  const on = checked || mixed;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={mixed ? "mixed" : checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border-[1.5px] transition-colors",
        "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
        on
          ? "border-primary bg-primary text-primary-foreground hover:bg-primary-hover"
          : "border-muted-foreground/70 bg-card hover:border-primary",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      {...rest}
    >
      {mixed ? (
        <Minus className="size-[11px]" strokeWidth={3.5} aria-hidden />
      ) : (
        checked && <Check className="size-[11px]" strokeWidth={3.5} aria-hidden />
      )}
    </button>
  );
}
