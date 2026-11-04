/** A calendar button next to a date field: a day picked = `onPick(date)`. One header row
 *  « « ‹ Novembre 2026 › » »: year and month arrows around the month shown (an expiry is often
 *  1–3 years away). */
import { useState, type ReactNode } from "react";
import { DayPicker } from "react-day-picker";
import { fr } from "date-fns/locale";
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
} from "@floating-ui/react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { Button } from "@/_components/atoms/Button";
import { DAY_PICKER_CLASSES, DAY_PICKER_MODIFIERS } from "@/_components/molecules/dayPicker";
import { useMonths } from "@/i18n/dates";
import { useT } from "@/i18n/I18nProvider";
import { cn } from "@/utils/cn";

const CALENDAR_CLASSES = { ...DAY_PICKER_CLASSES, month_caption: "hidden" };

export function DatePickerButton({
  selected,
  onPick,
  label,
}: {
  selected: Date | undefined;
  onPick: (day: Date) => void;
  /** The button's accessible name (« Choisir la date : Date d'expiration »). */
  label: string;
}) {
  const t = useT();
  const months = useMonths();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(selected ?? new Date());
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [panelEl, setPanelEl] = useState<HTMLElement | null>(null);
  const { floatingStyles, context } = useFloating({
    elements: { reference: anchorEl, floating: panelEl },
    open,
    onOpenChange: setOpen,
    placement: "bottom-start",
    strategy: "fixed", // drawn on top of the page (portal below): no parent cuts it
    middleware: [offset(8), flip({ padding: 16 }), shift({ padding: 16 })],
    whileElementsMounted: autoUpdate,
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([useDismiss(context)]);
  const toggle = () => {
    if (!open) setMonth(selected ?? new Date());
    setOpen(!open);
  };
  const moveMonths = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const arrow = (n: number, name: string, icon: ReactNode) => (
    <Button variant="outline" size="icon-sm" onClick={() => moveMonths(n)} aria-label={name}>
      {icon}
    </Button>
  );
  return (
    <>
      <Button
        ref={setAnchorEl}
        variant="outline"
        size="icon"
        aria-label={label}
        {...getReferenceProps({ onClick: toggle })}
        className={cn("text-muted-foreground hover:text-primary", open && "border-primary text-primary")}
      >
        <CalendarIcon className="size-4" />
      </Button>
      {open && (
        <FloatingPortal>
          <div
            ref={setPanelEl}
            {...getFloatingProps()}
            style={floatingStyles}
            className="z-[60] flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-base font-normal shadow-2xl"
          >
            <div className="flex items-center justify-between gap-1 text-sm font-bold text-foreground">
              <span className="flex gap-1">
                {arrow(-12, t("products.prevYear"), <ChevronsLeft className="size-4" />)}
                {arrow(-1, t("products.prevMonth"), <ChevronLeft className="size-4" />)}
              </span>
              <span>
                {months[month.getMonth()]} {month.getFullYear()}
              </span>
              <span className="flex gap-1">
                {arrow(1, t("products.nextMonth"), <ChevronRight className="size-4" />)}
                {arrow(12, t("products.nextYear"), <ChevronsRight className="size-4" />)}
              </span>
            </div>
            <div>
              <DayPicker
                mode="single"
                locale={fr}
                month={month}
                onMonthChange={setMonth}
                hideNavigation
                selected={selected}
                onSelect={(d) => {
                  if (!d) return;
                  onPick(d);
                  setOpen(false);
                }}
                weekStartsOn={1}
                showOutsideDays
                classNames={CALENDAR_CLASSES}
                modifiersClassNames={DAY_PICKER_MODIFIERS}
              />
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
