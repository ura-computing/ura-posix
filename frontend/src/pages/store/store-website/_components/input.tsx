/** Bare input styled to match the existing `<TextField>` look (the apcm
 *  primitives bundle label + error inside TextField; this shim provides
 *  the unbundled `<Input>` the handoff TSX imports). */
import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

import { cn } from "@/utils/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        "block w-full rounded-md border border-input bg-surface-subtle px-3 py-2 text-sm text-foreground",
        "placeholder:text-muted-foreground",
        "transition-colors",
        "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "aria-invalid:border-error",
        className,
      )}
      {...rest}
    />
  );
});
