/** react-day-picker v10 looks, shared by every calendar of the app (Ventes / Achats periods, the
 *  product's « Date de péremption »). `classNames` is keyed by the UI enum (react-day-picker's
 *  `UI.d.ts`); selection + day flags live in `modifiersClassNames`. */

export const DAY_PICKER_CLASSES = {
  months: "flex flex-col gap-6 sm:flex-row",
  month: "flex flex-col gap-3",
  month_caption: "flex items-center justify-center relative h-8",
  caption_label: "text-sm font-bold text-foreground capitalize",
  nav: "flex items-center justify-between w-full absolute top-0 left-0 right-0 px-1",
  button_previous:
    "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary",
  button_next:
    "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary",
  chevron: "size-4 fill-current",
  month_grid: "w-full border-collapse",
  weekdays: "flex",
  weekday: "w-9 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground pb-1.5",
  weeks: "flex flex-col gap-1",
  week: "flex w-full",
  day: "size-9 p-0 text-center text-sm relative",
  day_button:
    "inline-flex size-9 cursor-pointer items-center justify-center rounded-md font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
} as const;

export const DAY_PICKER_MODIFIERS = {
  today: "font-bold ring-1 ring-primary/40 ring-inset rounded-md",
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
