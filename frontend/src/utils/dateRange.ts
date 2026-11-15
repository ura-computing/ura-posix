/** Date-range presets used in the DateRangePicker (and anywhere else a
 *  "quick period" shortcut is offered). Ported from apcm-pharma's
 *  `utils/dateRange.ts`. All returns are ISO YYYY-MM-DD strings.
 */

export interface DateRange {
  from: string;
  to: string;
}

const fmt = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};

/** Today as ISO YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  return fmt(now);
}

/** ISO date `n` days before today (0 = today). */
function daysAgo(n: number, now: Date = new Date()): string {
  return fmt(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
}

/** ISO date the day after `iso`. */
function dayAfter(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return fmt(new Date(y, m - 1, d + 1));
}

/** ISO date `n` years before today (same month/day). */
function yearsAgo(n: number, now: Date = new Date()): string {
  return fmt(new Date(now.getFullYear() - n, now.getMonth(), now.getDate()));
}

/** ISO date `n` months before today (same day, clamped to month length).
 *  e.g. monthsAgo(2) on 2026-07-31 → 2026-05-31,
 *       monthsAgo(1) on 2026-08-31 → 2026-07-31 (not rolled into Sept).
 */
export function monthsAgo(n: number, now: Date = new Date()): string {
  const day = now.getDate();
  const d = new Date(now.getFullYear(), now.getMonth() - n, 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return fmt(d);
}

/** First day of current month → today. */
function currentMonth(now: Date = new Date()): DateRange {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: fmt(from), to: fmt(now) };
}

/** Full previous calendar month (1st → last day). */
function previousMonth(now: Date = new Date()): DateRange {
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0); // day 0 = last day of prev month
  return { from: fmt(from), to: fmt(to) };
}

/** Full previous calendar quarter (Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec). */
function previousQuarter(now: Date = new Date()): DateRange {
  const currentQ = Math.floor(now.getMonth() / 3); // 0..3
  let prevQ = currentQ - 1;
  let year = now.getFullYear();
  if (prevQ < 0) {
    prevQ = 3;
    year -= 1;
  }
  const startMonth = prevQ * 3; // 0, 3, 6, 9
  const from = new Date(year, startMonth, 1);
  const to = new Date(year, startMonth + 3, 0); // last day of last month in quarter
  return { from: fmt(from), to: fmt(to) };
}

/** Full previous calendar year (Jan 1 → Dec 31). */
function previousYear(now: Date = new Date()): DateRange {
  const y = now.getFullYear() - 1;
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

/** Full current calendar year (Jan 1 → today). */
export function currentYear(now: Date = new Date()): DateRange {
  const y = now.getFullYear();
  return { from: `${y}-01-01`, to: fmt(now) };
}

/** « Période » next to a page's dates (product sheet, Sobrus import): 7 (Sobrus import only) / 30 / 90 days, the year
 *  so far, 12 months, today included. */
export type PeriodPreset = "7d" | "30d" | "90d" | "year" | "12m";
export const PERIOD_PRESETS: Record<PeriodPreset, () => DateRange> = {
  "7d": () => ({ from: daysAgo(6), to: todayIso() }),
  "30d": () => ({ from: daysAgo(29), to: todayIso() }),
  "90d": () => ({ from: daysAgo(89), to: todayIso() }),
  year: () => currentYear(),
  "12m": () => ({ from: dayAfter(yearsAgo(1)), to: todayIso() }),
};
/** Its button labels (fr.ts / es.ts), in order. */
export const PERIOD_LABELS = [
  ["30d", "products.period30"],
  ["90d", "products.period90"],
  ["year", "products.periodYear"],
  ["12m", "products.period12"],
] as const;
/** The preset these dates are (none: dates typed or picked). */
export function presetOf(from: string | null, to: string | null): PeriodPreset | null {
  return (
    (Object.keys(PERIOD_PRESETS) as PeriodPreset[]).find((k) => {
      const p = PERIOD_PRESETS[k]();
      return p.from === from && p.to === to;
    }) ?? null
  );
}

export const DATE_PRESETS = [
  { key: "current-year", label: "datePreset.currentYear", get: currentYear },
  { key: "current-month", label: "datePreset.currentMonth", get: currentMonth },
  { key: "previous-month", label: "datePreset.previousMonth", get: previousMonth },
  { key: "previous-quarter", label: "datePreset.previousQuarter", get: previousQuarter },
  { key: "previous-year", label: "datePreset.previousYear", get: previousYear },
] as const;
