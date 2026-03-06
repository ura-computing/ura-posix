export const fmt = (n: number | null) =>
  n != null ? n.toLocaleString("fr-MA", { minimumFractionDigits: 2 }) : "—";

export const stripPct = (s: string) => s.replace(/\s*\([\d.]+%\)/, "").trim();

export function downloadCSV(
  rows: Record<string, unknown>[],
  rowToCSV: (r: Record<string, unknown>) => string[],
  headers: string[],
  filename: string,
) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers, ...rows.map(rowToCSV)]
    .map((row) => row.map(escape).join(";"))
    .join("\n");
  const blob = new Blob(["\ufeff" + lines], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
