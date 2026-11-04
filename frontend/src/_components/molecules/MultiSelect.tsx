import { FloatingPortal } from "@floating-ui/react";
import { ChevronDown } from "lucide-react";

import { POPOVER_OPTION, POPOVER_PANEL, POPOVER_TRIGGER, usePopover } from "@/_components/molecules/popover";
import { useT } from "@/i18n/I18nProvider";

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}

export function MultiSelect({ label, options, selected, onChange }: MultiSelectProps) {
  const t = useT();
  const { open, setOpen, triggerRef, panelRef, panelStyle, getReferenceProps, getFloatingProps } = usePopover();

  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        {...getReferenceProps({ onClick: () => setOpen(!open) })}
        className={POPOVER_TRIGGER}
      >
        {label}
        {selected.length > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {selected.length}
          </span>
        )}
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>
      {open && (
        <FloatingPortal>
          <div data-list={label} ref={panelRef} {...getFloatingProps()} style={panelStyle} className={POPOVER_PANEL}>
            {options.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">{t("shared.noOption")}</div>
            )}
            {options.map((opt) => {
              const checked = selected.includes(opt);
              return (
                <label key={opt} className={POPOVER_OPTION}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(opt)}
                    className="cursor-pointer accent-primary"
                  />
                  <span className="flex-1 truncate">{opt}</span>
                </label>
              );
            })}
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="mt-1 block w-full cursor-pointer border-t border-border px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-surface-subtle"
              >
                {t("shared.deselectAll")}
              </button>
            )}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
