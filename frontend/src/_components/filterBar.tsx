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
import { useEffect, useRef, useState, type ReactNode, useCallback } from "react";
import { ChevronDown, Search, X, Calendar as CalendarIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/utils/cn";
import { useT } from "@/i18n/I18nProvider";

import { CategorySegment, type SegmentOption } from "./CategorySegment";
import { SingleSelectPopover, type SingleSelectOption } from "./SingleSelectPopover";
import { DayPicker, type DateRange as DPRange } from "react-day-picker";
import { fr } from "date-fns/locale";
import { autoUpdate, flip, offset, shift, size, useDismiss, useFloating, useInteractions } from "@floating-ui/react";
import { DATE_PRESETS, type DateRange as IsoRange } from "@/utils/dateRange";

/** Date-range filter: 2 labelled segmented inputs ("DATE DÉBUT" / "DATE FIN")
 *  + a Calendar icon button that opens a 2-month popover with quick-period
 *  presets at top. Same UX as apcm-pharma's old picker (verified to feel
 *  right), restyled to our tokens (Vital Teal primary, our radii/typography).
 *
 *  Each field accepts JJ/MM/AAAA via 3 sub-inputs that auto-advance on a
 *  complete segment. Arrow keys navigate fields and bump values up/down.
 *  Esc reverts to props. Calendar selection rules: first click → start, second
 *  click → end + close popover. Presets jump to a full range + close.
 */

// NOTE: do NOT import "react-day-picker/dist/style.css" — its default styles
// fight our Tailwind overrides and cause weekday/day-grid layout breakage.

type Side = "from" | "to";
type Field = "d" | "m" | "y";
type Segs = { d: string; m: string; y: string };

const FIELD_ORDER: { side: Side; field: Field }[] = [
  { side: "from", field: "d" },
  { side: "from", field: "m" },
  { side: "from", field: "y" },
  { side: "to", field: "d" },
  { side: "to", field: "m" },
  { side: "to", field: "y" },
];

// ─── ISO ↔ segs helpers ──────────────────────────────────────────────────────

const isoToSegs = (iso: string): Segs => {
  if (!iso) return { d: "", m: "", y: "" };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return { d: "", m: "", y: "" };
  return { y: m[1], m: m[2], d: m[3] };
};

const segsToIso = (s: Segs): string | null => {
  if (s.d === "" && s.m === "" && s.y === "") return "";
  if (s.d.length < 1 || s.m.length < 1 || s.y.length !== 4) return null;
  const dd = parseInt(s.d, 10);
  const mm = parseInt(s.m, 10);
  const yyyy = parseInt(s.y, 10);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
  if (yyyy < 1900 || yyyy > 2999) return null;
  if (mm < 1 || mm > 12) return null;
  if (dd < 1 || dd > 31) return null;
  const dt = new Date(yyyy, mm - 1, dd);
  if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return null;
  return `${String(yyyy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
};

const segsEqual = (a: Segs, b: Segs) => a.d === b.d && a.m === b.m && a.y === b.y;

// ─── Public component ────────────────────────────────────────────────────────

interface DateRangePopoverProps {
  /** YYYY-MM-DD or "" / null when unset. */
  from: string | null;
  to: string | null;
  /** Called with both values whenever either side changes. */
  onChange: (from: string | null, to: string | null) => void;
  showPresets?: boolean;
  className?: string;
}

function DateRangePopover({ from, to, onChange, showPresets = true, className }: DateRangePopoverProps) {
  const t = useT();
  const fromIso = from ?? "";
  const toIso = to ?? "";

  const [fromSegs, setFromSegs] = useState<Segs>(() => isoToSegs(fromIso));
  const [toSegs, setToSegs] = useState<Segs>(() => isoToSegs(toIso));
  const [invalid, setInvalid] = useState({ from: false, to: false });
  const [open, setOpen] = useState(false);
  // The values the segments were last filled from (see « new value from outside » below).
  const [shownFromIso, setShownFromIso] = useState(fromIso);
  const [shownToIso, setShownToIso] = useState(toIso);
  // Popover anchor + panel, as state (not refs): Floating UI reads them during render.
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [panelEl, setPanelEl] = useState<HTMLElement | null>(null);

  const refs = useRef<Array<HTMLInputElement | null>>([null, null, null, null, null, null]);

  // ── Floating UI: anchors popover to the date-field wrapper, drops it
  // BELOW the fields by default, auto-flips above when no room, auto-shifts
  // left/right to fit within the viewport, clamps max-width on narrow screens.
  // `autoUpdate` re-positions on scroll, resize, transforms — for free.
  const { floatingStyles, context } = useFloating({
    elements: { reference: anchorEl, floating: panelEl },
    open,
    onOpenChange: setOpen,
    placement: "bottom-start",
    middleware: [
      offset(8),
      flip({ padding: 16 }),
      shift({ padding: 16 }),
      size({
        padding: 16,
        apply({ availableWidth, availableHeight, elements }) {
          Object.assign(elements.floating.style, {
            maxWidth: `${Math.min(availableWidth, 680)}px`,
            maxHeight: `${availableHeight}px`,
          });
        },
      }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

  // New value from outside (preset, « Tout réinitialiser », another page): refill
  // the segments during render, not in an effect (no extra render pass).
  if (fromIso !== shownFromIso) {
    setShownFromIso(fromIso);
    const next = isoToSegs(fromIso);
    setFromSegs((cur) => (segsEqual(cur, next) ? cur : next));
  }
  if (toIso !== shownToIso) {
    setShownToIso(toIso);
    const next = isoToSegs(toIso);
    setToSegs((cur) => (segsEqual(cur, next) ? cur : next));
  }

  const focusIdx = (idx: number, opts?: { selectAll?: boolean }) => {
    const el = refs.current[idx];
    if (!el) return;
    el.focus();
    if (opts?.selectAll) el.select();
  };
  const idxOf = (side: Side, field: Field) => FIELD_ORDER.findIndex((f) => f.side === side && f.field === field);

  const commit = useCallback(
    (side: Side, segs: Segs) => {
      const iso = segsToIso(segs);
      if (iso === null) {
        setInvalid((v) => ({ ...v, [side]: true }));
        return;
      }
      setInvalid((v) => ({ ...v, [side]: false }));
      if (side === "from") onChange(iso || null, toIso || null);
      else onChange(fromIso || null, iso || null);
    },
    [onChange, fromIso, toIso],
  );

  const updateSeg = (side: Side, field: Field, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    const maxLen = field === "y" ? 4 : 2;
    const trimmed = digits.slice(0, maxLen);

    const cur = side === "from" ? fromSegs : toSegs;
    const next: Segs = { ...cur, [field]: trimmed };
    if (side === "from") setFromSegs(next);
    else setToSegs(next);

    // Auto-advance + zero-pad on single-digit overflow (e.g. "5" in day → "05" + next)
    let advance = false;
    let padded = trimmed;
    if (field === "d") {
      if (trimmed.length === 2) advance = true;
      else if (trimmed.length === 1 && /^[4-9]$/.test(trimmed)) {
        advance = true;
        padded = "0" + trimmed;
      }
    } else if (field === "m") {
      if (trimmed.length === 2) advance = true;
      else if (trimmed.length === 1 && /^[2-9]$/.test(trimmed)) {
        advance = true;
        padded = "0" + trimmed;
      }
    } else if (field === "y") {
      if (trimmed.length === 4) advance = true;
    }

    if (padded !== trimmed) {
      const padNext: Segs = { ...next, [field]: padded };
      if (side === "from") setFromSegs(padNext);
      else setToSegs(padNext);
      const iso = segsToIso(padNext);
      if (iso !== null) commit(side, padNext);
      else
        setInvalid((v) => ({ ...v, [side]: padNext.d.length > 0 && padNext.m.length > 0 && padNext.y.length === 4 }));
    } else {
      if (next.d.length >= 1 && next.m.length >= 1 && next.y.length === 4) {
        const iso = segsToIso(next);
        if (iso !== null) commit(side, next);
        else setInvalid((v) => ({ ...v, [side]: true }));
      } else {
        setInvalid((v) => ({ ...v, [side]: false }));
      }
      // Empty everywhere → commit ""
      if (next.d === "" && next.m === "" && next.y === "" && (side === "from" ? fromIso : toIso) !== "") {
        if (side === "from") onChange(null, toIso || null);
        else onChange(fromIso || null, null);
      }
    }

    if (advance) {
      const nextIdx = idxOf(side, field) + 1;
      if (nextIdx < FIELD_ORDER.length) focusIdx(nextIdx, { selectAll: true });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, side: Side, field: Field) => {
    const target = e.currentTarget;
    const idx = idxOf(side, field);
    const cur = side === "from" ? fromSegs : toSegs;
    const value = cur[field];

    if (e.key === "ArrowRight") {
      if (
        target.selectionStart === value.length &&
        target.selectionEnd === value.length &&
        idx + 1 < FIELD_ORDER.length
      ) {
        e.preventDefault();
        focusIdx(idx + 1, { selectAll: true });
      }
    } else if (e.key === "ArrowLeft") {
      if (target.selectionStart === 0 && target.selectionEnd === 0 && idx > 0) {
        e.preventDefault();
        focusIdx(idx - 1, { selectAll: true });
      }
    } else if (e.key === "Backspace") {
      if (value === "" && idx > 0) {
        e.preventDefault();
        focusIdx(idx - 1, { selectAll: true });
      }
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const dir = e.key === "ArrowUp" ? 1 : -1;
      const n = parseInt(value || "0", 10) + dir;
      const max = field === "y" ? 2999 : field === "m" ? 12 : 31;
      const min = field === "y" ? 1900 : 1;
      if (n >= min && n <= max) {
        const padLen = field === "y" ? 4 : 2;
        updateSeg(side, field, String(n).padStart(padLen, "0"));
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      target.blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setFromSegs(isoToSegs(fromIso));
      setToSegs(isoToSegs(toIso));
      setInvalid({ from: false, to: false });
      target.blur();
    }
  };

  const handleBlur = (side: Side) => {
    const cur = side === "from" ? fromSegs : toSegs;
    const iso = segsToIso(cur);
    if (iso === null) setInvalid((v) => ({ ...v, [side]: true }));
    else {
      setInvalid((v) => ({ ...v, [side]: false }));
      if (iso !== (side === "from" ? fromIso : toIso)) commit(side, cur);
    }
  };

  // Calendar selection (range mode — first click = start, second click = end + close)
  const fromDate = fromIso ? new Date(fromIso + "T00:00:00") : undefined;
  const toDate = toIso ? new Date(toIso + "T00:00:00") : undefined;

  const handleRangeSelect = (range: DPRange | undefined) => {
    if (!range) {
      onChange(null, null);
      return;
    }
    const fmtDate = (d?: Date) =>
      d
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        : null;
    const newFrom = fmtDate(range.from);
    const newTo = fmtDate(range.to);
    onChange(newFrom, range.from && !range.to ? null : newTo);
    if (range.from && range.to) setOpen(false);
  };

  const applyPreset = (r: IsoRange) => {
    onChange(r.from, r.to);
    setOpen(false);
  };

  return (
    <div ref={setAnchorEl} {...getReferenceProps()} className={cn("inline-flex items-center gap-2", className)}>
      <DateField
        side="from"
        label={t("shared.dateStart")}
        segs={fromSegs}
        invalid={invalid.from}
        registerRef={(field, el) => {
          refs.current[idxOf("from", field)] = el;
        }}
        onUpdate={updateSeg}
        onKeyDown={handleKeyDown}
        onBlur={() => handleBlur("from")}
      />
      <span className="text-sm text-muted-foreground">→</span>
      <DateField
        side="to"
        label={t("shared.dateEnd")}
        segs={toSegs}
        invalid={invalid.to}
        registerRef={(field, el) => {
          refs.current[idxOf("to", field)] = el;
        }}
        onUpdate={updateSeg}
        onKeyDown={handleKeyDown}
        onBlur={() => handleBlur("to")}
      />

      {/* Calendar icon button — clicking toggles the popover, anchored to this whole wrapper */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={t("shared.openCalendar")}
        className={cn(
          "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-input bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary",
          open && "border-primary text-primary",
        )}
      >
        <CalendarIcon className="size-4" />
      </button>

      {/* Popover — Floating UI positions it under the date-field wrapper. flip()
          + shift() + size() handle every viewport edge case automatically. */}
      {open && (
        <div
          ref={setPanelEl}
          {...getFloatingProps()}
          style={floatingStyles}
          className="z-50 flex flex-col overflow-auto rounded-xl border border-border bg-card shadow-2xl"
        >
          {showPresets && (
            <div className="border-b border-border bg-muted/30 px-3 pb-3 pt-2.5">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t("shared.quickPeriods")}
              </div>
              <div className="grid grid-cols-2 gap-1">
                {DATE_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyPreset(p.get())}
                    className="cursor-pointer rounded-md px-3 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    {t(p.label)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="p-3">
            <DayPicker
              mode="range"
              numberOfMonths={2}
              locale={fr}
              selected={{ from: fromDate, to: toDate }}
              onSelect={handleRangeSelect}
              weekStartsOn={1}
              showOutsideDays
              defaultMonth={fromDate ?? new Date()}
              classNames={DAY_PICKER_CLASSES}
              modifiersClassNames={DAY_PICKER_MODIFIERS}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Single date field (label above + 3 segmented inputs DD/MM/YYYY) ─────────

interface DateFieldProps {
  side: Side;
  label: string;
  segs: Segs;
  invalid: boolean;
  registerRef: (field: Field, el: HTMLInputElement | null) => void;
  onUpdate: (side: Side, field: Field, value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, side: Side, field: Field) => void;
  onBlur: () => void;
}

function DateField({ side, label, segs, invalid, registerRef, onUpdate, onKeyDown, onBlur }: DateFieldProps) {
  const t = useT();
  const segClass = (w: string) =>
    cn(
      "bg-transparent text-center font-mono text-sm font-semibold tabular-nums outline-none placeholder:text-muted-foreground/60",
      "selection:bg-primary/20",
      w,
      invalid && "text-error",
    );
  // Monospace: every character is 1ch wide, so each box = its characters + 0.5ch for the
  // caret (2.5ch / 4.5ch): nothing scrolls out of a box, same gap around each « / ».
  // Label-less variant: the visible JJ/MM/AAAA placeholders + the left→right
  // reading order are enough to identify début vs fin. The `aria-label` on each
  // sub-input still includes the label for screen readers.
  return (
    <div
      aria-invalid={invalid || undefined}
      className={cn(
        "inline-flex h-9 items-center rounded-md border border-input bg-surface-subtle px-3 transition-colors",
        "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20",
        invalid && "border-error",
      )}
    >
      <input
        ref={(el) => registerRef("d", el)}
        value={segs.d}
        onChange={(e) => onUpdate(side, "d", e.target.value)}
        onKeyDown={(e) => onKeyDown(e, side, "d")}
        onBlur={onBlur}
        onFocus={(e) => e.target.select()}
        inputMode="numeric"
        maxLength={2}
        placeholder={t("shared.dayAbbr")}
        aria-label={`${label} ${t("shared.day")}`}
        className={segClass("w-[2.5ch]")}
      />
      <span className={cn("mx-1 select-none text-sm text-muted-foreground", invalid && "text-error")}>/</span>
      <input
        ref={(el) => registerRef("m", el)}
        value={segs.m}
        onChange={(e) => onUpdate(side, "m", e.target.value)}
        onKeyDown={(e) => onKeyDown(e, side, "m")}
        onBlur={onBlur}
        onFocus={(e) => e.target.select()}
        inputMode="numeric"
        maxLength={2}
        placeholder={t("shared.monthAbbr")}
        aria-label={`${label} ${t("shared.month")}`}
        className={segClass("w-[2.5ch]")}
      />
      <span className={cn("mx-1 select-none text-sm text-muted-foreground", invalid && "text-error")}>/</span>
      <input
        ref={(el) => registerRef("y", el)}
        value={segs.y}
        onChange={(e) => onUpdate(side, "y", e.target.value)}
        onKeyDown={(e) => onKeyDown(e, side, "y")}
        onBlur={onBlur}
        onFocus={(e) => e.target.select()}
        inputMode="numeric"
        maxLength={4}
        placeholder={t("shared.yearAbbr")}
        aria-label={`${label} ${t("shared.year")}`}
        className={segClass("w-[4.5ch]")}
      />
    </div>
  );
}

// ─── react-day-picker v10 className overrides — pinned here (self-contained)
//
// v10's classNames API is keyed by the UI enum (see
// node_modules/react-day-picker/dist/esm/UI.d.ts). Selection + day-flag
// modifiers live in a separate `modifiersClassNames` prop.

const DAY_PICKER_CLASSES = {
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

const DAY_PICKER_MODIFIERS = {
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
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const groups = suggestions ? (Object.entries(suggestions) as [keyof G, string[]][]) : [];
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
          {isLoading && <div className="px-3 py-2 text-xs text-muted-foreground">{t("common.searching")}</div>}
          {!isLoading && !hasAny && (
            <div className="px-3 py-2 text-xs text-muted-foreground">{t("common.noResult")}</div>
          )}
          {!isLoading &&
            groups.map(([g, items]) =>
              items.length === 0 ? null : (
                <div key={String(g)} className="border-b border-border last:border-0">
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

export function MultiSelectPopover({ label, options, selected, onChange }: MultiSelectPopoverProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} className={POPOVER_TRIGGER}>
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
      )}
    </div>
  );
}

// ─── FilterPill ──────────────────────────────────────────────────────────────

export function FilterPill({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
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

        {dateRange && <DateRangePopover from={dateRange.from} to={dateRange.to} onChange={dateRange.onChange} />}

        {segment && <CategorySegment<V> value={segment.value} options={segment.options} onChange={segment.onChange} />}

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
                <button key={i} type="button" onClick={a.onClick} disabled={a.disabled} className={cls}>
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
            {t("shared.activeFilters")}
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
