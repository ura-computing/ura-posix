/** Minimal toggle switch matching the app's design tokens.
 *
 *  Used by the admin permission pages (PharmacyFeature + UserPermission toggles
 *  on /admin/pharmacies). Single shared primitive — every toggle goes through
 *  this so we never grow a second styling story.
 *
 *  Accessibility: button role="switch" + aria-checked + space/enter keyboard. */
import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/utils/cn";

interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onChange?: (next: boolean) => void;
  /** Visual size — sm = 32×18, md = 40×22 (default). */
  size?: "sm" | "md";
}

export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch(
  { checked, onChange, disabled, size = "md", className, ...rest },
  ref,
) {
  const track = size === "sm" ? "h-[18px] w-8" : "h-[22px] w-10";
  const thumb = size === "sm" ? "size-3.5" : "size-[18px]";
  const slide =
    size === "sm"
      ? checked
        ? "translate-x-[14px]"
        : "translate-x-0.5"
      : checked
        ? "translate-x-[18px]"
        : "translate-x-0.5";

  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors",
        "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
        track,
        checked ? "bg-primary" : "bg-muted",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      {...rest}
    >
      <span
        aria-hidden
        className={cn("inline-block rounded-full bg-white shadow transition-transform", thumb, slide)}
      />
    </button>
  );
});
