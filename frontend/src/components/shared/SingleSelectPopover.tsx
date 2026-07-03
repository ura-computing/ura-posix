/** Single-pick dropdown — the ONE shared primitive for every "pick one option"
 *  selector in the app. Same trigger/panel/option className as MultiSelectPopover
 *  (both pull from POPOVER_TRIGGER / POPOVER_PANEL / POPOVER_OPTION in filterBar.tsx).
 *
 *  Reused by:
 *    - Stock status filter         (label="Statut", placement="bottom", align="start")
 *    - Admin catalogue Type filter (label="Type",   placement="bottom", align="start")
 *    - DataTable page-size picker  (label="",       placement="top",    align="end")
 *
 *  Consumers only vary label / options / value / placement / align. If you find
 *  yourself reaching for a NEW dropdown component, this one almost certainly fits.
 *
 *  Trigger shows "Label : <selected>" when a value is set. When label="" the
 *  trigger shows the selected value alone (no leading colon).
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/utils/cn";

import { POPOVER_ALIGN, POPOVER_OPTION, POPOVER_PANEL, POPOVER_POSITION, POPOVER_TRIGGER } from "./filterBar";


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
  /** Where the panel opens relative to the trigger. Use "top" when the trigger
   *  is near the viewport bottom (e.g. sticky pagination footer). Default "bottom". */
  placement?:   "top" | "bottom";
  /** Horizontal anchor of the panel. "start" pins panel-left to trigger-left
   *  (panel grows rightward — default). "end" pins panel-right to trigger-right
   *  (panel grows leftward — use when trigger is near the viewport's right edge). */
  align?:       "start" | "end";
}


export function SingleSelectPopover({
  label, options, value, onChange, emptyValue = "", placement = "bottom", align = "start",
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
        className={POPOVER_TRIGGER}
      >
        <span>
          {label}
          {isFiltering && (
            <span className={cn("font-semibold text-foreground", label && "ml-1")}>
              {label ? `: ${selectedLabel}` : selectedLabel}
            </span>
          )}
        </span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className={cn(POPOVER_PANEL, POPOVER_POSITION[placement], POPOVER_ALIGN[align])}>
          {options.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Aucune option</div>}
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => pick(opt.value)}
                className={cn(POPOVER_OPTION, active && "bg-surface-subtle font-semibold text-foreground")}
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
