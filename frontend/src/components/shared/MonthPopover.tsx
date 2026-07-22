/** Month-picker matching the app's design system (same trigger shell as
 *  SingleSelectPopover, same panel positioning). Returns a "YYYY-MM" string.
 *
 *  Used on /comptabilité — both the activeMonth selector on the page and
 *  the month field inside PaymentEditDialog go through this. Native
 *  <input type="month"> was the previous implementation; it doesn't match
 *  the rest of the popovers in the app, so we replaced it.
 *
 *  Behaviour: trigger shows "Mois MMMM YYYY". Click → panel with a year
 *  stepper (◀ YYYY ▶) and a 3×4 month grid. Pick a month → onChange(YYYY-MM),
 *  panel closes. ESC / outside-click close without committing.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/utils/cn";
import { useMonths, useMonthsShort } from "@/i18n/dates";
import { useT } from "@/i18n/I18nProvider";

import { POPOVER_ALIGN, POPOVER_OPTION, POPOVER_PANEL, POPOVER_POSITION, POPOVER_TRIGGER } from "./filterBar";






/** Decompose a "YYYY-MM" string into [year, monthIdx] (monthIdx is 0-based). */
function parseYearMonth(s: string): [number, number] {
  const [y, m] = s.split("-").map(Number);
  return [y || new Date().getFullYear(), (m || 1) - 1];
}

function formatYearMonth(year: number, monthIdx: number): string {
  return `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
}


export interface MonthPopoverProps {
  /** Current value as "YYYY-MM". */
  value:     string;
  onChange:  (next: string) => void;
  /** Label shown before the value in the trigger ("Mois" by default). Pass ""
   *  to show only the value (e.g. inside a header). */
  label?:    string;
  /** Where the panel opens — matches SingleSelectPopover's API. */
  placement?: "top" | "bottom";
  align?:     "start" | "end";
}


export function MonthPopover({
  value, onChange, label = "", placement = "bottom", align = "start",
}: MonthPopoverProps) {
  const t = useT();
  const MONTHS_FR = useMonths();
  const MONTHS_FR_SHORT = useMonthsShort();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const [valueY, valueM] = parseYearMonth(value);
  // The year currently displayed in the panel — independent from `valueY` so
  // the user can browse other years before committing.
  const [displayYear, setDisplayYear] = useState(valueY);

  // Reset the panel's displayed year when the bound value changes or the
  // panel reopens, so we always start from the selected year.
  useEffect(() => { if (open) setDisplayYear(valueY); }, [open, valueY]);

  // Outside-click close
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const pick = (monthIdx: number) => {
    onChange(formatYearMonth(displayYear, monthIdx));
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
          <span className={cn("font-semibold text-foreground", label && "ml-1")}>
            {label ? `: ${MONTHS_FR[valueM]} ${valueY}` : `${MONTHS_FR[valueM]} ${valueY}`}
          </span>
        </span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className={cn(POPOVER_PANEL, POPOVER_POSITION[placement], POPOVER_ALIGN[align], "w-64 p-2")}>
          {/* Year stepper */}
          <div className="mb-1 flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setDisplayYear(displayYear - 1)}
              aria-label={t("shared.prevYear")}
              className="rounded p-1 hover:bg-surface-subtle"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-semibold text-foreground">{displayYear}</span>
            <button
              type="button"
              onClick={() => setDisplayYear(displayYear + 1)}
              aria-label={t("shared.nextYear")}
              className="rounded p-1 hover:bg-surface-subtle"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* 3 × 4 month grid */}
          <div className="grid grid-cols-3 gap-1">
            {MONTHS_FR_SHORT.map((name, idx) => {
              const active = displayYear === valueY && idx === valueM;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => pick(idx)}
                  className={cn(
                    POPOVER_OPTION,
                    "justify-center px-2 py-2 text-xs",
                    active && "bg-surface-subtle font-semibold text-foreground",
                  )}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
