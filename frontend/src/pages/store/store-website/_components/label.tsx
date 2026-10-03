import { forwardRef } from "react";
import type { LabelHTMLAttributes } from "react";

import { cn } from "@/utils/cn";

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(function Label(
  { className, ...rest },
  ref,
) {
  return <label ref={ref} className={cn("block text-sm font-medium text-foreground", className)} {...rest} />;
});
