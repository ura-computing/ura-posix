// fr-FR (not fr-MA): NBSP as thousand separator + comma decimal (1 234,56).
// fr-MA emits a `.` as thousand separator which reads wrong for our users.
const LOCALE = "fr-FR";

/** Currency / decimal formatter — always shows 2 decimals (e.g. "1 234,56"). */
export const fmt = (n: number | null) =>
  n != null ? n.toLocaleString(LOCALE, { minimumFractionDigits: 2 }) : "—";

/** Integer formatter for counts/quantities — no decimals (e.g. "1 234"). */
export const fmtInt = (n: number | null | undefined) =>
  n != null ? n.toLocaleString(LOCALE, { maximumFractionDigits: 0 }) : "—";

export const stripPct = (s: string) => s.replace(/\s*\([\d.]+%\)/, "").trim();
