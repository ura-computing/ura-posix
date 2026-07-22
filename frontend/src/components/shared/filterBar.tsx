/** Filter-bar primitives + the unified `<FilterBar>` shell.
 *
 * Bundled in one file because they're tightly related (all sit inside the
 * sticky filter bar) and individually small. Splitting would balloon imports
 * without separation-of-concerns benefit.
 *
 * Exports:
 *   SearchAutocomplete  — debounced text input with grouped dropdown
 *   MultiSelectPopover  — checkbox-list popover with count badge trigger
 *   FilterPill          — small removable chip for the active-filter row
 *   FilterBar           — sticky shell composing all the above + DateRangePopover
 *                         + SingleSelectPopover + CategorySegment, every section
 *                         optional via props (used by all 5 list/dashboard pages)
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/utils/cn";
import { useT } from "@/i18n/I18nProvider";

import { CategorySegment, type SegmentOption } from "./CategorySegment";
import { DateRangePopover } from "./DateRangePopover";
import {
  SingleSelectPopover,
  type SingleSelectOption,
} from "./SingleSelectPopover";


// ─── Shared popover styles ───────────────────────────────────────────────────
// Single source of truth for the trigger / panel / option className strings.
// Consumed by MultiSelectPopover (here), SingleSelectPopover, and the DataTable
// pagination page-size selector. Keeps Catégorie / Type / page-size dropdowns
// visually identical across the app — D2 of the F19 design-system cleanup.

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
  top:    "bottom-full mb-1",
} as const;

/** Horizontal anchor. "start" pins the panel's LEFT edge to the trigger's left
 *  (default — panel grows rightward). "end" pins the panel's RIGHT edge to the
 *  trigger's right (panel grows leftward) — use when the trigger sits near the
 *  viewport's right edge so the panel doesn't clip off-screen. */
export const POPOVER_ALIGN = {
  start: "left-0",
  end:   "right-0",
} as const;

export const POPOVER_OPTION =
  "flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-surface-subtle";


// ─── SearchAutocomplete ──────────────────────────────────────────────────────

interface SearchAutocompleteProps<G extends Record<string, string[]>> {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  /** Map of group-label → string[]. e.g. { "Produit": [...], "Client": [...] } */
  suggestions: G | null;
  onPick: (label: string, group: keyof G) => void;
  isLoading?: boolean;
  debounceMs?: number;
}

export function SearchAutocomplete<G extends Record<string, string[]>>({
  value,
  onChange,
  placeholder,
  suggestions,
  onPick,
  isLoading = false,
  debounceMs = 300,
}: SearchAutocompleteProps<G>) {
  const t = useT();
  const [draft, setDraft] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Sync draft when parent externally resets `value` (Réinitialiser, etc.).
  // Render-phase comparison per React docs — avoids setState-in-useEffect.
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  useEffect(() => {
    if (draft === value) return;
    const t = setTimeout(() => onChange(draft), debounceMs);
    return () => clearTimeout(t);
  }, [draft, value, onChange, debounceMs]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const groups = suggestions
    ? (Object.entries(suggestions) as [keyof G, string[]][])
    : [];
  const hasAny = groups.some(([, items]) => items.length > 0);

  return (
    <div ref={ref} className="relative flex-1 min-w-[220px]">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
      <input
        type="text"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-input bg-surface-subtle pl-8 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      />
      {open && draft.length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-md border border-border bg-card shadow-lg">
          {isLoading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {t("common.searching")}
            </div>
          )}
          {!isLoading && !hasAny && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {t("common.noResult")}
            </div>
          )}
          {!isLoading &&
            groups.map(([g, items]) =>
              items.length === 0 ? null : (
                <div
                  key={String(g)}
                  className="border-b border-border last:border-0"
                >
                  <div className="bg-surface-subtle px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {String(g)}
                  </div>
                  {items.map((label) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        onPick(label, g);
                        onChange(label);
                        setDraft(label);
                        setOpen(false);
                      }}
                      className="block w-full cursor-pointer px-3 py-1.5 text-left text-sm hover:bg-surface-subtle"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ),
            )}
        </div>
      )}
    </div>
  );
}

// ─── MultiSelectPopover ──────────────────────────────────────────────────────

interface MultiSelectPopoverProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}

export function MultiSelectPopover({
  label,
  options,
  selected,
  onChange,
}: MultiSelectPopoverProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const toggle = (opt: string) =>
    onChange(
      selected.includes(opt)
        ? selected.filter((s) => s !== opt)
        : [...selected, opt],
    );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
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
        <div className={cn(POPOVER_PANEL, POPOVER_POSITION.bottom, POPOVER_ALIGN.start)}>
          {options.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Aucune option
            </div>
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
      )}
    </div>
  );
}

// ─── FilterPill ──────────────────────────────────────────────────────────────

export function FilterPill({
  children,
  onRemove,
}: {
  children: ReactNode;
  onRemove: () => void;
}) {
  const t = useT();
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs">
      <span>{children}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("shared.removeFilter")}
        className="cursor-pointer rounded-full p-0.5 hover:bg-muted"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

// ─── FilterBar (the shell) ───────────────────────────────────────────────────

export interface SearchConfig {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  suggestions?: Record<string, string[]> | null;
  onPick?: (label: string) => void;
  isLoading?: boolean;
}

export interface DateRangeConfig {
  from: string | null;
  to: string | null;
  onChange: (from: string | null, to: string | null) => void;
}

export interface SegmentConfig<V extends string> {
  value: V;
  onChange: (v: V) => void;
  options: SegmentOption<V>[];
}

export interface MultiSelectConfig {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}

export interface SingleSelectConfig {
  label: string;
  options: SingleSelectOption[];
  value: string;
  onChange: (v: string) => void;
}

export interface RightAction {
  label: ReactNode;
  icon?: ReactNode;
  variant: "primary" | "outline";
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}

export interface ActiveFilter {
  key: string;
  label: ReactNode;
  onClear: () => void;
}

export interface FilterBarProps<V extends string = string> {
  search?: SearchConfig;
  dateRange?: DateRangeConfig;
  segment?: SegmentConfig<V>;
  multiSelects?: MultiSelectConfig[];
  singleSelect?: SingleSelectConfig;
  rightActions?: RightAction[];
  activeFilters?: ActiveFilter[];
  onResetAll?: () => void;
}

export function FilterBar<V extends string = string>({
  search,
  dateRange,
  segment,
  multiSelects,
  singleSelect,
  rightActions,
  activeFilters,
  onResetAll,
}: FilterBarProps<V>) {
  const t = useT();
  const hasActive = (activeFilters?.length ?? 0) > 0;

  return (
    <section
      aria-label={t("shared.filters")}
      className="sticky top-0 z-20 flex flex-col gap-2.5 rounded-xl border border-border bg-card/95 p-3 shadow-sm backdrop-blur"
    >
      {/* Row 1 — controls + right cluster */}
      <div className="flex flex-wrap items-center gap-2.5">
        {search && (
          <SearchAutocomplete
            value={search.value}
            onChange={search.onChange}
            placeholder={search.placeholder}
            suggestions={search.suggestions ?? null}
            onPick={search.onPick ?? (() => {})}
            isLoading={search.isLoading}
          />
        )}

        {dateRange && (
          <DateRangePopover
            from={dateRange.from}
            to={dateRange.to}
            onChange={dateRange.onChange}
          />
        )}

        {segment && (
          <CategorySegment<V>
            value={segment.value}
            options={segment.options}
            onChange={segment.onChange}
          />
        )}

        {multiSelects?.map((ms) => (
          <MultiSelectPopover
            key={ms.label}
            label={ms.label}
            options={ms.options}
            selected={ms.selected}
            onChange={ms.onChange}
          />
        ))}

        {singleSelect && (
          <SingleSelectPopover
            label={singleSelect.label}
            options={singleSelect.options}
            value={singleSelect.value}
            onChange={singleSelect.onChange}
          />
        )}

        {rightActions && rightActions.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {rightActions.map((a, i) => {
              const cls = cn(
                "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                a.variant === "primary"
                  ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                  : "border border-border bg-card text-foreground hover:bg-surface-subtle",
              );
              if (a.href) {
                return (
                  <Link key={i} to={a.href} className={cls}>
                    {a.icon}
                    {a.label}
                  </Link>
                );
              }
              return (
                <button
                  key={i}
                  type="button"
                  onClick={a.onClick}
                  disabled={a.disabled}
                  className={cls}
                >
                  {a.icon}
                  {a.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Row 2 — active filter pills + reset all */}
      {hasActive && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Filtres actifs
          </span>
          {activeFilters!.map((f) => (
            <FilterPill key={f.key} onRemove={f.onClear}>
              {f.label}
            </FilterPill>
          ))}
          {onResetAll && (
            <button
              type="button"
              onClick={onResetAll}
              className="ml-1 cursor-pointer text-xs font-semibold text-primary hover:underline"
            >
              {t("shared.resetAll")}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
