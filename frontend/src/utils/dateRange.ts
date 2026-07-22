/** Date-range presets used in the DateRangePopover (and anywhere else a
 *  "quick period" shortcut is offered). Ported from apcm-pharma's
 *  `utils/dateRange.ts`. All returns are ISO YYYY-MM-DD strings.
 */

export interface DateRange {
  from: string;
  to:   string;
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


/** ISO date `n` years before today (same month/day). */
export function yearsAgo(n: number, now: Date = new Date()): string {
  return fmt(new Date(now.getFullYear() - n, now.getMonth(), now.getDate()));
}


/** First day of current month → today. */
export function currentMonth(now: Date = new Date()): DateRange {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: fmt(from), to: fmt(now) };
}


/** Full previous calendar month (1st → last day). */
export function previousMonth(now: Date = new Date()): DateRange {
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to   = new Date(now.getFullYear(), now.getMonth(),     0); // day 0 = last day of prev month
  return { from: fmt(from), to: fmt(to) };
}


/** Full previous calendar quarter (Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec). */
export function previousQuarter(now: Date = new Date()): DateRange {
  const currentQ = Math.floor(now.getMonth() / 3); // 0..3
  let prevQ = currentQ - 1;
  let year  = now.getFullYear();
  if (prevQ < 0) {
    prevQ = 3;
    year -= 1;
  }
  const startMonth = prevQ * 3; // 0, 3, 6, 9
  const from = new Date(year, startMonth,     1);
  const to   = new Date(year, startMonth + 3, 0); // last day of last month in quarter
  return { from: fmt(from), to: fmt(to) };
}


/** Full previous calendar year (Jan 1 → Dec 31). */
export function previousYear(now: Date = new Date()): DateRange {
  const y = now.getFullYear() - 1;
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}


export const DATE_PRESETS = [
  { key: "current-month",    label: "datePreset.currentMonth",         get: currentMonth },
  { key: "previous-month",   label: "datePreset.previousMonth",      get: previousMonth },
  { key: "previous-quarter", label: "datePreset.previousQuarter", get: previousQuarter },
  { key: "previous-year",    label: "datePreset.previousYear",    get: previousYear },
] as const;
