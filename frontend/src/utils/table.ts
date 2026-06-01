/**
 * Build an export filename in the format:
 *   "APCM - {TYPE} {dateFrom} - {dateTo}.{ext}"
 *
 * If a date is missing, falls back to today (YYYY-MM-DD). Use "xlsx" for the
 * pharmacist-facing exports (PG-003 — no CSV).
 * Examples:
 *   exportFilename("RAPPORT", "xlsx", "2025-12-02", "2026-02-01") → "APCM - RAPPORT 2025-12-02 - 2026-02-01.xlsx"
 *   exportFilename("ANALYSE", "xlsx") → "APCM - ANALYSE 2026-04-12 - 2026-04-12.xlsx"
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
  // Strip trailing "ALL" suffix (used for the "mixte" category default)
  const cleanType = type.replace(/\s+ALL$/i, "").trim();
  return `APCM - ${cleanType} ${from} - ${to}.${ext}`;
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

/**
 * PG-003: pharmacist-facing exports are .xlsx only. CSV is gone \u2014 pharmacists
 * don't know how to open it. Same row-mapper signature as the old helper so
 * call sites only changed name (and got an `await`).
 *
 * Numeric values pass through as numbers (so Excel formats / sums them); other
 * values are coerced to strings.
 */
export async function downloadXlsx(
  rows: Record<string, unknown>[],
  rowToValues: (r: Record<string, unknown>) => (string | number)[],
  headers: string[],
  filename: string,
  sheetName: string = "Donn\u00e9es",
) {
  const XLSX = await import("xlsx");
  const aoa: (string | number)[][] = [headers, ...rows.map(rowToValues)];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Auto column widths: max(header length, max value length) + 2, capped at 50.
  const colWidths = headers.map((h, i) => {
    const headerLen = String(h).length;
    const maxValueLen = rows.reduce((m, r) => {
      const cell = rowToValues(r)[i];
      const s = cell == null ? "" : String(cell);
      return Math.max(m, s.length);
    }, 0);
    return { wch: Math.min(50, Math.max(headerLen, maxValueLen) + 2) };
  });
  ws["!cols"] = colWidths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}
