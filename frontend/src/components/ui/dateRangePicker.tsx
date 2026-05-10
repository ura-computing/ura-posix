"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { cn } from "@/utils/cn";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { DATE_PRESETS } from "@/utils/dateRange";

type Side = "from" | "to";
type Field = "d" | "m" | "y";

type Segs = { d: string; m: string; y: string };

type Props = {
  from: string;
  to: string;
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
  showPresets?: boolean;
  className?: string;
  "aria-invalid"?: boolean;
};

const FIELD_ORDER: { side: Side; field: Field }[] = [
  { side: "from", field: "d" }, { side: "from", field: "m" }, { side: "from", field: "y" },
  { side: "to",   field: "d" }, { side: "to",   field: "m" }, { side: "to",   field: "y" },
];

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

export function DateRangePicker({
  from,
  to,
  onFromChange,
  onToChange,
  showPresets = true,
  className,
  "aria-invalid": ariaInvalid,
}: Props) {
  const [fromSegs, setFromSegs] = useState<Segs>(() => isoToSegs(from));
  const [toSegs, setToSegs] = useState<Segs>(() => isoToSegs(to));
  const [invalid, setInvalid] = useState({ from: false, to: false });
  const [open, setOpen] = useState(false);

  const refs = useRef<Array<HTMLInputElement | null>>([null, null, null, null, null, null]);

  // Keep segments in sync with external props (presets, calendar selection).
  useEffect(() => {
    const next = isoToSegs(from);
    setFromSegs((cur) => (segsEqual(cur, next) ? cur : next));
  }, [from]);
  useEffect(() => {
    const next = isoToSegs(to);
    setToSegs((cur) => (segsEqual(cur, next) ? cur : next));
  }, [to]);

  const focusIdx = (idx: number, opts?: { selectAll?: boolean }) => {
    const el = refs.current[idx];
    if (!el) return;
    el.focus();
    if (opts?.selectAll) el.select();
  };

  const idxOf = (side: Side, field: Field) =>
    FIELD_ORDER.findIndex((f) => f.side === side && f.field === field);

  const commit = useCallback(
    (side: Side, segs: Segs) => {
      const iso = segsToIso(segs);
      if (iso === null) {
        setInvalid((v) => ({ ...v, [side]: true }));
        return;
      }
      setInvalid((v) => ({ ...v, [side]: false }));
      if (side === "from") onFromChange(iso);
      else onToChange(iso);
    },
    [onFromChange, onToChange],
  );

  const updateSeg = (side: Side, field: Field, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    const maxLen = field === "y" ? 4 : 2;
    const trimmed = digits.slice(0, maxLen);

    const cur = side === "from" ? fromSegs : toSegs;
    const next: Segs = { ...cur, [field]: trimmed };
    if (side === "from") setFromSegs(next); else setToSegs(next);

    // Decide auto-advance and value padding
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
      if (side === "from") setFromSegs(padNext); else setToSegs(padNext);
      // Try commit with padded value
      const iso = segsToIso(padNext);
      if (iso !== null) commit(side, padNext);
      else setInvalid((v) => ({ ...v, [side]: padNext.d.length > 0 && padNext.m.length > 0 && padNext.y.length === 4 }));
    } else {
      // Try commit when fully filled
      if (next.d.length >= 1 && next.m.length >= 1 && next.y.length === 4) {
        const iso = segsToIso(next);
        if (iso !== null) commit(side, next);
        else setInvalid((v) => ({ ...v, [side]: true }));
      } else {
        setInvalid((v) => ({ ...v, [side]: false }));
      }
      // Empty everywhere → commit ""
      if (next.d === "" && next.m === "" && next.y === "" && (side === "from" ? from : to) !== "") {
        if (side === "from") onFromChange("");
        else onToChange("");
      }
    }

    if (advance) {
      const nextIdx = idxOf(side, field) + 1;
      if (nextIdx < FIELD_ORDER.length) focusIdx(nextIdx, { selectAll: true });
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    side: Side,
    field: Field,
  ) => {
    const target = e.currentTarget;
    const idx = idxOf(side, field);
    const cur = side === "from" ? fromSegs : toSegs;
    const value = cur[field];

    if (e.key === "ArrowRight") {
      if (target.selectionStart === value.length && target.selectionEnd === value.length) {
        if (idx + 1 < FIELD_ORDER.length) {
          e.preventDefault();
          focusIdx(idx + 1, { selectAll: true });
        }
      }
    } else if (e.key === "ArrowLeft") {
      if (target.selectionStart === 0 && target.selectionEnd === 0) {
        if (idx > 0) {
          e.preventDefault();
          focusIdx(idx - 1, { selectAll: true });
        }
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
      // Revert to props
      setFromSegs(isoToSegs(from));
      setToSegs(isoToSegs(to));
      setInvalid({ from: false, to: false });
      target.blur();
    }
  };

  const handleBlur = (side: Side) => {
    const cur = side === "from" ? fromSegs : toSegs;
    const iso = segsToIso(cur);
    if (iso === null) {
      setInvalid((v) => ({ ...v, [side]: true }));
    } else {
      setInvalid((v) => ({ ...v, [side]: false }));
      if (iso !== (side === "from" ? from : to)) commit(side, cur);
    }
  };

  const fromDate = from ? new Date(from + "T00:00:00") : undefined;
  const toDate = to ? new Date(to + "T00:00:00") : undefined;

  const handleRangeSelect = (range: DateRange | undefined) => {
    if (!range) {
      onFromChange("");
      onToChange("");
      return;
    }
    const newFrom = range.from ? format(range.from, "yyyy-MM-dd") : "";
    const newTo = range.to ? format(range.to, "yyyy-MM-dd") : "";
    if (newFrom !== from) onFromChange(newFrom);
    if (range.from && !range.to) {
      // First click — clear Au.
      if (to !== "") onToChange("");
      return;
    }
    if (range.from && range.to) {
      if (newTo !== to) onToChange(newTo);
      setOpen(false);
    }
  };

  const applyPreset = (r: { from: string; to: string }) => {
    onFromChange(r.from);
    onToChange(r.to);
    setOpen(false);
  };

  const frameInvalid = ariaInvalid || invalid.from || invalid.to;

  return (
    <div
      aria-invalid={frameInvalid || undefined}
      className={cn(
        "inline-flex items-center gap-2 h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs transition-[color,box-shadow]",
        "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        className,
      )}
    >
      <DateSegments
        side="from"
        label="Du"
        segs={fromSegs}
        invalid={invalid.from}
        registerRef={(field, el) => { refs.current[idxOf("from", field)] = el; }}
        onUpdate={updateSeg}
        onKeyDown={handleKeyDown}
        onBlur={() => handleBlur("from")}
      />
      <span className="text-muted-foreground select-none" aria-hidden="true">→</span>
      <DateSegments
        side="to"
        label="Au"
        segs={toSegs}
        invalid={invalid.to}
        registerRef={(field, el) => { refs.current[idxOf("to", field)] = el; }}
        onUpdate={updateSeg}
        onKeyDown={handleKeyDown}
        onBlur={() => handleBlur("to")}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            aria-label="Ouvrir le calendrier"
            className="h-7 w-7 p-0 -mr-1 text-muted-foreground hover:bg-transparent hover:text-foreground"
          >
            <CalendarIcon className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          {showPresets && (
            <div className="flex flex-col border-b border-border bg-muted/30 p-2 gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground px-1">
                Périodes rapides
              </span>
              <div className="grid grid-cols-2 gap-1">
                {DATE_PRESETS.map((p) => (
                  <Button
                    key={p.key}
                    variant="ghost"
                    size="sm"
                    className="h-7 justify-start text-xs font-normal"
                    onClick={() => applyPreset(p.get())}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <Calendar
            mode="range"
            selected={{ from: fromDate, to: toDate }}
            onSelect={handleRangeSelect}
            numberOfMonths={2}
            locale={fr}
            defaultMonth={fromDate ?? new Date()}
            showOutsideDays
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

type SegmentsProps = {
  side: Side;
  label: string;
  segs: Segs;
  invalid: boolean;
  registerRef: (field: Field, el: HTMLInputElement | null) => void;
  onUpdate: (side: Side, field: Field, value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>, side: Side, field: Field) => void;
  onBlur: () => void;
};

function DateSegments({
  side, label, segs, invalid, registerRef, onUpdate, onKeyDown, onBlur,
}: SegmentsProps) {
  const segClass = (w: string) =>
    cn(
      "bg-transparent text-center outline-none placeholder:text-muted-foreground/50 tabular-nums",
      "selection:bg-primary/20",
      w,
      invalid && "text-destructive",
    );
  return (
    <div className="inline-flex items-baseline gap-1.5">
      <span className="text-xs text-muted-foreground select-none">{label}</span>
      <div className="inline-flex items-baseline">
        <input
          ref={(el) => registerRef("d", el)}
          value={segs.d}
          onChange={(e) => onUpdate(side, "d", e.target.value)}
          onKeyDown={(e) => onKeyDown(e, side, "d")}
          onBlur={onBlur}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          maxLength={2}
          placeholder="JJ"
          aria-label={`${label} jour`}
          className={segClass("w-[1.5em]")}
        />
        <span className={cn("text-muted-foreground select-none", invalid && "text-destructive")}>/</span>
        <input
          ref={(el) => registerRef("m", el)}
          value={segs.m}
          onChange={(e) => onUpdate(side, "m", e.target.value)}
          onKeyDown={(e) => onKeyDown(e, side, "m")}
          onBlur={onBlur}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          maxLength={2}
          placeholder="MM"
          aria-label={`${label} mois`}
          className={segClass("w-[1.5em]")}
        />
        <span className={cn("text-muted-foreground select-none", invalid && "text-destructive")}>/</span>
        <input
          ref={(el) => registerRef("y", el)}
          value={segs.y}
          onChange={(e) => onUpdate(side, "y", e.target.value)}
          onKeyDown={(e) => onKeyDown(e, side, "y")}
          onBlur={onBlur}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          maxLength={4}
          placeholder="AAAA"
          aria-label={`${label} année`}
          className={segClass("w-[2.75em]")}
        />
      </div>
    </div>
  );
}
