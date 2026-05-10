/** Currency / decimal formatter — always shows 2 decimals (e.g. "1 234,56"). */
export const fmt = (n: number | null) =>
  n != null ? n.toLocaleString("fr-MA", { minimumFractionDigits: 2 }) : "—";

/** Integer formatter for counts/quantities — no decimals (e.g. "1 234"). */
export const fmtInt = (n: number | null | undefined) =>
  n != null ? n.toLocaleString("fr-MA", { maximumFractionDigits: 0 }) : "—";

export const stripPct = (s: string) => s.replace(/\s*\([\d.]+%\)/, "").trim();
