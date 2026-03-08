import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { stripPct } from "@/lib/table-utils";

type CategoryMultiSelectProps = {
  allCategories: string[];
  selected: string[];
  onChange: (cats: string[]) => void;
  /** "default" = primary blue (toolbar), "destructive" = red (delete dialog) */
  variant?: "default" | "destructive";
  /**
   * When true, the dropdown renders as an inline positioned div (no portal).
   * Use this inside Dialogs to avoid Radix scroll-lock blocking the list scroll.
   */
  inline?: boolean;
  className?: string;
};

const SCROLLABLE = "max-h-52 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border";

export function CategoryMultiSelect({
  allCategories,
  selected,
  onChange,
  variant = "default",
  inline = false,
  className,
}: CategoryMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggle = (cat: string) =>
    onChange(selected.includes(cat) ? selected.filter((c) => c !== cat) : [...selected, cat]);

  const label =
    selected.length === 0
      ? "Toutes les catégories"
      : selected.length === 1
      ? stripPct(selected[0])
      : `${selected.length} catégories`;

  const activeClass =
    variant === "destructive" ? "border-destructive/60 text-destructive" : "border-primary text-primary";
  const checkClass =
    variant === "destructive" ? "bg-destructive border-destructive" : "bg-primary border-primary";
  const checkIconClass = variant === "destructive" ? "text-white" : "text-primary-foreground";

  // Close inline dropdown on outside click
  useEffect(() => {
    if (!inline || !open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [inline, open]);

  const triggerButton = (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "w-full justify-between text-sm font-normal min-w-50",
        selected.length > 0 && activeClass,
        className,
      )}
      onClick={inline ? () => setOpen((v) => !v) : undefined}
    >
      <span className="truncate">{label}</span>
      <ChevronDown className={cn("h-4 w-4 opacity-50 shrink-0 transition-transform", open && inline && "rotate-180")} />
    </Button>
  );

  const dropdownList = (
    <>
      {selected.length > 0 && (
        <button
          type="button"
          className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onChange([])}
        >
          Tout désélectionner
        </button>
      )}
      <div className={SCROLLABLE}>
        {allCategories.map((cat) => {
          const checked = selected.includes(cat);
          return (
            <div
              key={cat}
              className="flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer hover:bg-accent"
              onClick={() => toggle(cat)}
            >
              <div
                className={cn(
                  "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                  checked ? checkClass : "border-input",
                )}
              >
                {checked && <Check className={cn("h-3 w-3", checkIconClass)} />}
              </div>
              <span className="text-sm truncate">{stripPct(cat)}</span>
            </div>
          );
        })}
      </div>
    </>
  );

  // ── Inline mode (no portal — for use inside Dialog) ──
  if (inline) {
    return (
      <div ref={containerRef} className="relative">
        {triggerButton}
        {open && (
          <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
            {dropdownList}
          </div>
        )}
      </div>
    );
  }

  // ── Default mode (Radix Popover with portal — for toolbars) ──
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent className="w-64 p-1" align="start">
        {dropdownList}
      </PopoverContent>
    </Popover>
  );
}
