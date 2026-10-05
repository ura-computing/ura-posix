import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/utils/cn";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "block w-full rounded-md border border-input bg-surface-subtle px-3 py-2 text-sm text-foreground",
        "placeholder:text-muted-foreground",
        "transition-colors",
        "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...rest}
    />
  );
});
