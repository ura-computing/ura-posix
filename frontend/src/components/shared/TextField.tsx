import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

import { cn } from "@/utils/cn";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label:      string;
  error?:     string;
  hint?:      string;
  /** Slot rendered inside the input's right edge (e.g. eye toggle). */
  rightSlot?: React.ReactNode;
}

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  { label, error, hint, rightSlot, id, className, ...rest },
  ref,
) {
  const inputId = id ?? `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const errorId = `${inputId}-err`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "block w-full rounded-md border bg-surface-subtle px-3 py-2 text-sm text-foreground",
            "placeholder:text-muted-foreground",
            "transition-colors duration-fast",
            "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            error ? "border-error" : "border-input",
            rightSlot && "pr-10",
            className,
          )}
          {...rest}
        />
        {rightSlot && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">
            {rightSlot}
          </div>
        )}
      </div>
      {error ? (
        <p id={errorId} className="text-xs text-error-subtle-foreground">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
});