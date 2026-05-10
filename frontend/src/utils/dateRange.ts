/**
 * Date-range presets for filters. All return ISO YYYY-MM-DD strings.
 */

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export type DateRange = { from: string; to: string };

/** First day of current month → today */
export function currentMonth(now: Date = new Date()): DateRange {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: fmt(from), to: fmt(now) };
}

/** Full previous calendar month (1st → last day) */
export function previousMonth(now: Date = new Date()): DateRange {
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0); // day 0 = last day of prev month
  return { from: fmt(from), to: fmt(to) };
}

/** Full previous calendar quarter (Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec) */
export function previousQuarter(now: Date = new Date()): DateRange {
  const currentQ = Math.floor(now.getMonth() / 3); // 0..3
  let prevQ = currentQ - 1;
  let year = now.getFullYear();
  if (prevQ < 0) {
    prevQ = 3;
    year -= 1;
  }
  const startMonth = prevQ * 3; // 0, 3, 6, 9
  const from = new Date(year, startMonth, 1);
  const to = new Date(year, startMonth + 3, 0);
  return { from: fmt(from), to: fmt(to) };
}

/** Full previous calendar year (Jan 1 → Dec 31) */
export function previousYear(now: Date = new Date()): DateRange {
  const y = now.getFullYear() - 1;
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}

/**
 * Calendar-aligned ABCD window used as the default on /stock.
 * - Jan–Jun → previous full calendar year (Jan 1 → Dec 31 of Y-1)
 * - Jul–Dec → rolling Y-1 Jul 1 → Y Jun 30
 *
 * Mirrors the backend `stock_abcd_window` rule.
 */
export function stockAbcdWindow(now: Date = new Date()): DateRange {
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1..12
  if (month <= 6) {
    return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
  }
  return { from: `${year - 1}-07-01`, to: `${year}-06-30` };
}

export const DATE_PRESETS = [
  { key: "current-month",     label: "Mois actuel",        get: currentMonth },
  { key: "previous-month",    label: "Mois antérieur",     get: previousMonth },
  { key: "previous-quarter",  label: "Trimestre antérieur", get: previousQuarter },
  { key: "previous-year",     label: "Année antérieur",    get: previousYear },
] as const;
