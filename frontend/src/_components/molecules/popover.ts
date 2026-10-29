/** The look of every dropdown (SingleSelect, MultiSelect, MonthPicker, the DataTable page size). */
export const POPOVER_TRIGGER =
  "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-surface-subtle px-3 text-sm hover:bg-muted/50";

/** Visual styles ONLY — vertical positioning (POPOVER_POSITION) AND horizontal
 *  anchoring (POPOVER_ALIGN) live in their own maps so the panel can adapt to
 *  the trigger's position on screen. */
export const POPOVER_PANEL =
  "absolute z-30 max-h-72 w-64 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-lg";

/** Vertical placement relative to the trigger. Use "top" when the trigger is
 *  near the viewport bottom (sticky pagination footer); default "bottom". */
export const POPOVER_POSITION = {
  bottom: "top-full mt-1",
  top: "bottom-full mb-1",
} as const;

/** Horizontal anchor. "start" pins the panel's LEFT edge to the trigger's left
 *  (default — panel grows rightward). "end" pins the panel's RIGHT edge to the
 *  trigger's right (panel grows leftward) — use when the trigger sits near the
 *  viewport's right edge so the panel doesn't clip off-screen. */
export const POPOVER_ALIGN = {
  start: "left-0",
  end: "right-0",
} as const;

export const POPOVER_OPTION =
  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-surface-subtle";
