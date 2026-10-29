/** Label + `Input` + its error (red) or hint, for the react-hook-form pages (login, Mon compte…):
 *  `{...register("email")}` spreads on it. `rightSlot`: inside the input's right edge (the eye). */
import { forwardRef } from "react";

import { Input, type InputProps } from "@/_components/atoms/Input";

interface Props extends Omit<InputProps, "ref"> {
  label: string;
  error?: string;
  hint?: string;
}

export const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  { label, error, hint, id, ...rest },
  ref,
) {
  const inputId = id ?? `f-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const errorId = `${inputId}-err`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <Input ref={ref} id={inputId} invalid={!!error} aria-describedby={error ? errorId : undefined} {...rest} />
      {error ? (
        <p id={errorId} className="text-xs text-error-subtle-foreground">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
});
