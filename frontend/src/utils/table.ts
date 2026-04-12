/**
 * Build an export filename in the format:
 *   "APCM - {TYPE} {dateFrom} - {dateTo}.{ext}"
 *
 * If a date is missing, falls back to today (YYYY-MM-DD).
 * Examples:
 *   exportFilename("RAPPORT", "csv", "2025-12-02", "2026-02-01") → "APCM - RAPPORT 2025-12-02 - 2026-02-01.csv"
 *   exportFilename("ANALYSE", "csv") → "APCM - ANALYSE 2026-04-12 - 2026-04-12.csv"
 */
export function exportFilename(
  type: string,
  ext: string,
  dateFrom?: string,
  dateTo?: string,
): string {
  const today = new Date().toISOString().slice(0, 10);
  const from = dateFrom || today;
  const to = dateTo || today;
  return `APCM - ${type} ${from} - ${to}.${ext}`;
}

export function getPharmacySuffix(
  category: string | null,
  suffixes: { category: string; suffix: string }[],
): string {
  if (!category || suffixes.length === 0) return "";
  const normalized = category.replace(/\s*\([\d.]+%\)/, "").trim().toLowerCase();
  const match = suffixes.find((s) => normalized === s.category.toLowerCase());
  return match?.suffix ?? "";
}

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
