import { useState } from "react";
import { FloatingPortal } from "@floating-ui/react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import {
  CALENDAR_CELL,
  CALENDAR_CELL_SELECTED,
  CALENDAR_CELL_TODAY,
  CALENDAR_NAV,
  CALENDAR_PANEL,
  CALENDAR_TITLE,
} from "@/_components/molecules/dayPicker";
import { POPOVER_TRIGGER, usePopover } from "@/_components/molecules/popover";
import { useMonths, useMonthsShort } from "@/i18n/dates";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";

/** Month-picker matching the app's design system (same trigger shell as
 *  SingleSelect, same panel positioning). Returns a "YYYY-MM" string.
 *
 *  Used on /comptabilité: the month of the page and the month field of its payment dialog. Native
 *  <input type="month"> was the previous implementation; it doesn't match
 *  the rest of the popovers in the app, so we replaced it.
 *
 *  Behaviour: trigger shows "Mois MMMM YYYY". Click → panel with a year
 *  stepper (◀ YYYY ▶) and a 3×4 month grid. Pick a month → onChange(YYYY-MM),
 *  panel closes. ESC / outside-click close without committing.
 *  The panel is drawn on top of the page (portal, fixed): no parent (a dialog, the page frame) cuts it; it flips
 *  above the trigger when there is no room below.
 */

/** Decompose a "YYYY-MM" string into [year, monthIdx] (monthIdx is 0-based). */
function parseYearMonth(s: string): [number, number] {
  const [y, m] = s.split("-").map(Number);
  return [y || new Date().getFullYear(), (m || 1) - 1];
}

function formatYearMonth(year: number, monthIdx: number): string {
  return `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
}

interface MonthPickerProps {
  /** Current value as "YYYY-MM". */
  value: string;
  onChange: (next: string) => void;
  /** Label shown before the value in the trigger ("Mois" by default). Pass ""
   *  to show only the value (e.g. inside a header). */
  label?: string;
  /** Where the panel opens — matches SingleSelect's API. */
  placement?: "top" | "bottom";
  align?: "start" | "end";
}

export function MonthPicker({ value, onChange, label = "", placement = "bottom", align = "start" }: MonthPickerProps) {
  const t = useT();
  const MONTHS_FR = useMonths();
  const MONTHS_FR_SHORT = useMonthsShort();
  // ESC / outside-click close without committing.
  const { open, setOpen, triggerRef, panelRef, panelStyle, getReferenceProps, getFloatingProps } = usePopover(
    placement,
    align,
  );

  const [valueY, valueM] = parseYearMonth(value);
  // The year currently displayed in the panel — independent from `valueY` so
  // the user can browse other years before committing.
  const [displayYear, setDisplayYear] = useState(valueY);

  const now = new Date();
  const [thisYear, thisMonth] = [now.getFullYear(), now.getMonth()];

  const pick = (monthIdx: number) => {
    onChange(formatYearMonth(displayYear, monthIdx));
    setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        {...getReferenceProps({
          onClick: () => {
            if (!open) setDisplayYear(valueY); // the panel always opens on the selected year
            setOpen(!open);
          },
        })}
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
        <FloatingPortal>
          <div ref={panelRef} {...getFloatingProps()} style={panelStyle} className={cn(CALENDAR_PANEL, "w-72")}>
            {/* Year: the same title and arrows as the day calendars */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setDisplayYear(displayYear - 1)}
                aria-label={t("shared.prevYear")}
                className={CALENDAR_NAV}
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className={CALENDAR_TITLE}>{displayYear}</span>
              <button
                type="button"
                onClick={() => setDisplayYear(displayYear + 1)}
                aria-label={t("shared.nextYear")}
                className={CALENDAR_NAV}
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            {/* 3 × 4 month grid */}
            <div data-list="months" className="grid grid-cols-3 gap-1">
              {MONTHS_FR_SHORT.map((name, idx) => {
                const active = displayYear === valueY && idx === valueM;
                const current = displayYear === thisYear && idx === thisMonth;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => pick(idx)}
                    aria-pressed={active}
                    className={cn(CALENDAR_CELL, current && CALENDAR_CELL_TODAY, active && CALENDAR_CELL_SELECTED)}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
