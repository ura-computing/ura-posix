/** An on / off choice shown as a chip (« À surveiller : remises », Pharmacie / Parapharmacie of the
 *  catalogue): `pressed` = on (primary, or `activeClass` for a category color). */
import type { ReactNode } from "react";

import { cn } from "@/utils/cn";

export function ToggleChip({
  pressed,
  onToggle,
  activeClass = "border-primary bg-primary text-primary-foreground",
  children,
}: {
  pressed: boolean;
  onToggle: () => void;
  activeClass?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        "inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        pressed ? activeClass : "border-border bg-card text-foreground hover:bg-surface-subtle",
      )}
    >
      {children}
    </button>
  );
}
