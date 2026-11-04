/** Every dropdown (SingleSelect, MultiSelect, MonthPicker, the DataTable page size): its look, and `usePopover` (open
 *  state + position). The panel is drawn on top of the page (a portal, fixed): no parent — a dialog, the page frame —
 *  cuts it; it opens below (or above) its trigger and flips / shifts to fit the window. */
import { useState } from "react";
import { autoUpdate, flip, offset, shift, useDismiss, useFloating, useInteractions } from "@floating-ui/react";

export const POPOVER_TRIGGER =
  "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-surface-subtle px-3 text-sm hover:bg-muted/50";

/** Visual styles of the panel (its position: `usePopover`). Above dialogs (z-50). */
export const POPOVER_PANEL =
  "z-[60] max-h-72 w-64 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-lg";

export const POPOVER_OPTION =
  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-surface-subtle";

/** A dropdown's open state and position. `placement`: below its trigger (default) or above (a trigger near the
 *  window bottom); `align`: the panel's left edge on the trigger's (default) or its right edge. ESC and a click outside
 *  close it. Render the panel inside `<FloatingPortal>` with `panelRef`, `panelStyle`, `getFloatingProps()`. */
export function usePopover(placement: "top" | "bottom" = "bottom", align: "start" | "end" = "start") {
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  const { floatingStyles, context } = useFloating({
    elements: { reference: trigger, floating: panel },
    open,
    onOpenChange: setOpen,
    placement: `${placement}-${align}`,
    strategy: "fixed",
    middleware: [offset(4), flip({ padding: 16 }), shift({ padding: 16 })],
    whileElementsMounted: autoUpdate,
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([useDismiss(context)]);
  return {
    open,
    setOpen,
    triggerRef: setTrigger,
    panelRef: setPanel,
    panelStyle: floatingStyles,
    getReferenceProps,
    getFloatingProps,
  };
}
