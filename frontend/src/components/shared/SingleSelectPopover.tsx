/** Same visual shell as MultiSelectPopover but single-pick.
 *
 *  Used for Stock's status filter (Tous / Sous-stock / Idéal / À surveiller /
 *  Sur-stock / Inconnu / Négatif). Selecting an option closes the popover.
 *
 *  Trigger shows "Label : <selected>" when a value is set, or just "Label" when
 *  the placeholder/empty value is active.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/utils/cn";


export interface SingleSelectOption {
  value: string;
  label: string;
}


export interface SingleSelectPopoverProps {
  label:        string;
  options:      SingleSelectOption[];
  value:        string;
  onChange:     (v: string) => void;
  /** The "no filter" sentinel — when value === emptyValue, the trigger shows
   *  just the label without ": …". Defaults to "" (empty string). */
  emptyValue?:  string;
}


export function SingleSelectPopover({
  label, options, value, onChange, emptyValue = "",
}: SingleSelectPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label;
  const isFiltering = value !== emptyValue && Boolean(selectedLabel);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-surface-subtle px-3 text-sm hover:bg-muted/50"
      >
        <span>
          {label}
          {isFiltering && <span className="ml-1 font-semibold text-foreground">: {selectedLabel}</span>}
        </span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-72 w-64 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-lg">
          {options.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Aucune option</div>}
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => pick(opt.value)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-surface-subtle",
                  active && "bg-surface-subtle font-semibold text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-3.5 shrink-0 items-center justify-center rounded-full border",
                    active ? "border-primary" : "border-input",
                  )}
                  aria-hidden
                >
                  {active && <span className="size-1.5 rounded-full bg-primary" />}
                </span>
                <span className="flex-1 truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
