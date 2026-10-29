/** A big choice the user clicks (signup: « Propriétaire » / « Employé »; import: the file type):
 *  a card with its content, the chosen one outlined. A radio: put the cards in a `role="radiogroup"`.
 *  `style`: the chosen card's own colors (the import file types). */
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/utils/cn";

export function ChoiceCard({
  selected,
  onSelect,
  disabled,
  className,
  style,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full cursor-pointer flex-col gap-2 rounded-2xl border-2 p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60",
        selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40",
        className,
      )}
      style={style}
    >
      {children}
    </button>
  );
}
