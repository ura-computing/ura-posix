export const fmt = (n: number | null) =>
  n != null ? n.toLocaleString("fr-MA", { minimumFractionDigits: 2 }) : "—";

export const stripPct = (s: string) => s.replace(/\s*\([\d.]+%\)/, "").trim();
