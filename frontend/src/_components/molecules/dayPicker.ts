/** One look for every calendar of the app: the period picker (Ventes, Achats…), the product's « Date de péremption »,
 *  Comptabilité's month. Day grids: react-day-picker v10 (`classNames` keyed by its UI enum, `UI.d.ts`; selection +
 *  day flags in `modifiersClassNames`); the month grid (`MonthPicker`) uses the CALENDAR_* pieces below. */

/** The floating panel of every calendar. */
export const CALENDAR_PANEL = "z-[60] flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-2xl";
/** ‹ › (« ‹‹ ›› » years): bordered square buttons on both sides of the title. */
export const CALENDAR_NAV =
  "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary";
/** « Novembre 2026 », « 2026 ». */
export const CALENDAR_TITLE = "text-sm font-bold text-foreground capitalize";
/** A day / a month to pick; picked = primary fill, today / this month = a thin primary ring. */
export const CALENDAR_CELL =
  "inline-flex h-9 cursor-pointer items-center justify-center rounded-md text-sm font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
export const CALENDAR_CELL_SELECTED =
  "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground";
export const CALENDAR_CELL_TODAY = "font-bold ring-1 ring-inset ring-primary/40";

export const DAY_PICKER_CLASSES = {
  // The arrows sit in the calendar itself (not over what comes above it, e.g. « Périodes rapides »).
  root: "relative",
  months: "flex flex-col gap-6 sm:flex-row",
  month: "flex flex-col gap-3",
  month_caption: "flex items-center justify-center relative h-8",
  caption_label: CALENDAR_TITLE,
  // Above the month titles (drawn after it, `relative`): else a title covers the arrows and takes their clicks.
  nav: "flex items-center justify-between w-full absolute top-0 left-0 right-0 z-10 px-1",
  button_previous: CALENDAR_NAV,
  button_next: CALENDAR_NAV,
  chevron: "size-4 fill-current",
  month_grid: "w-full border-collapse",
  weekdays: "flex",
  weekday: "w-9 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground pb-1.5",
  weeks: "flex flex-col gap-1",
  week: "flex w-full",
  day: "size-9 p-0 text-center text-sm relative",
  day_button: `${CALENDAR_CELL} w-9`,
} as const;

export const DAY_PICKER_MODIFIERS = {
  today: `${CALENDAR_CELL_TODAY} rounded-md`,
  outside: "text-muted-foreground/40",
  disabled: "cursor-not-allowed opacity-30",
  selected:
    "[&_button]:bg-primary [&_button]:text-primary-foreground [&_button]:hover:bg-primary/90 [&_button]:hover:text-primary-foreground",
  range_start: "[&_button]:bg-primary [&_button]:text-primary-foreground [&_button]:rounded-r-none",
  range_end: "[&_button]:bg-primary [&_button]:text-primary-foreground [&_button]:rounded-l-none",
  range_middle:
    "[&_button]:bg-primary/15 [&_button]:text-foreground [&_button]:hover:bg-primary/20 [&_button]:hover:text-foreground [&_button]:rounded-none",
  hidden: "invisible",
} as const;
