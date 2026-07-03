/** Thin shim mapping the handoff TSX's `<Button>` API to the apcm-refactor
 *  `<AsyncButton>` primitive. The handoff uses shadcn variants (default /
 *  outline / ghost / secondary / destructive / link) + sizes (sm / lg / icon
 *  / default); AsyncButton's variants are (primary / secondary / ghost /
 *  destructive) with no size prop. Mappings:
 *
 *    default  → primary
 *    outline  → secondary  (the closest visual match in this stack)
 *    secondary → secondary
 *    ghost    → ghost
 *    destructive → destructive
 *    link     → ghost (best-effort)
 *
 *  Sizes are emulated via Tailwind classes since AsyncButton uses fixed
 *  height/padding.
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { AsyncButton } from "@/components/shared/AsyncButton";
import { cn } from "@/utils/cn";


export type ButtonVariant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
export type ButtonSize    = "default" | "sm" | "lg" | "icon";


export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?:    ButtonSize;
  asChild?: boolean;      // ignored — handoff sometimes sets this; no Slot here
  children: ReactNode;
}


const VARIANT_MAP: Record<ButtonVariant, "primary" | "secondary" | "ghost" | "destructive"> = {
  default:     "primary",
  outline:     "secondary",
  secondary:   "secondary",
  ghost:       "ghost",
  destructive: "destructive",
  link:        "ghost",
};


const SIZE_CLASSES: Record<ButtonSize, string> = {
  default: "",
  sm:      "h-8 px-3 text-xs",
  lg:      "h-11 px-6 text-base",
  icon:    "size-9 p-0",
};


export function Button({
  variant = "default", size = "default", className, asChild: _asChild, ...rest
}: ButtonProps) {
  return (
    <AsyncButton
      variant={VARIANT_MAP[variant]}
      className={cn(SIZE_CLASSES[size], className)}
      {...rest}
    />
  );
}
