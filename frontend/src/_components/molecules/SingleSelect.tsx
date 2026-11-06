/** Single-pick dropdown — the ONE shared primitive for every "pick one option"
 *  selector in the app. Same trigger/panel/option className as MultiSelect
 *  (both pull from POPOVER_TRIGGER / POPOVER_PANEL / POPOVER_OPTION in molecules/popover.ts).
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
import { FloatingPortal } from "@floating-ui/react";
import { useT } from "@/i18n/I18nProvider";
import { ChevronDown } from "lucide-react";

import { cn } from "@/utils/cn";

import { POPOVER_OPTION, POPOVER_PANEL, POPOVER_TRIGGER, usePopover } from "@/_components/molecules/popover";

export interface SingleSelectOption {
  value: string;
  label: string;
}

export interface SingleSelectProps {
  label: string;
  options: SingleSelectOption[];
  value: string;
  onChange: (v: string) => void;
  /** The "no filter" sentinel — when value === emptyValue, the trigger shows
   *  just the label without ": …". Defaults to "" (empty string). */
  emptyValue?: string;
  /** Where the panel opens relative to the trigger. Use "top" when the trigger
   *  is near the viewport bottom (e.g. sticky pagination footer). Default "bottom". */
  placement?: "top" | "bottom";
  /** Horizontal anchor of the panel. "start" pins panel-left to trigger-left
   *  (panel grows rightward — default). "end" pins panel-right to trigger-right
   *  (panel grows leftward — use when trigger is near the viewport's right edge). */
  align?: "start" | "end";
  /** With label="" inside a form field: that field's name, so the trigger is named « Pharmacie assignée: X »
   *  (screen readers), not by its value alone. */
  ariaLabel?: string;
}

export function SingleSelect({
  label,
  options,
  value,
  onChange,
  emptyValue = "",
  placement = "bottom",
  align = "start",
  ariaLabel,
}: SingleSelectProps) {
  const t = useT();
  const { open, setOpen, triggerRef, panelRef, panelStyle, getReferenceProps, getFloatingProps } = usePopover(
    placement,
    align,
  );

  const selectedLabel = options.find((o) => o.value === value)?.label;
  const isFiltering = value !== emptyValue && Boolean(selectedLabel);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        {...getReferenceProps({ onClick: () => setOpen(!open) })}
        aria-label={ariaLabel ? `${ariaLabel}: ${selectedLabel ?? ""}` : undefined}
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
        <FloatingPortal>
          <div data-list={label} ref={panelRef} {...getFloatingProps()} style={panelStyle} className={POPOVER_PANEL}>
            {options.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">{t("shared.noOption")}</div>
            )}
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
        </FloatingPortal>
      )}
    </>
  );
}
