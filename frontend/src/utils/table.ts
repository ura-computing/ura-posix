/** Table / export helpers. Ported from apcm-pharma's `utils/table.ts`.
 *
 * `xlsx` is dynamically imported so the lib (~150 KB) only loads when an
 * export button is actually clicked — zero cost on initial page load.
 */


/**
 * Build an export filename:
 *   "APCM - {TYPE} {dateFrom} - {dateTo}.{ext}"
 *
 * Missing dates fall back to today (YYYY-MM-DD).
 */
export function exportFilename(
  type: string,
  ext: string,
  dateFrom?: string | null,
  dateTo?: string | null,
): string {
  const today = new Date().toISOString().slice(0, 10);
  const from  = dateFrom || today;
  const to    = dateTo   || today;
  const cleanType = type.replace(/\s+ALL$/i, "").trim();
  return `APCM - ${cleanType} ${from} - ${to}.${ext}`;
}


/**
 * PG-003: pharmacist-facing exports are `.xlsx` only (no CSV).
 *
 * Call shape: `downloadXlsx([headers, ...rows], filename)`.
 *   headers : (string | number)[] — first row of the 2D array
 *   rows    : (string | number)[][] — body
 *
 * Auto-fits column widths to max(header, longest cell) + 2, capped at 50 chars.
 * Numeric cells stay numbers so Excel can format / sum them.
 */
export async function downloadXlsx(
  aoa: (string | number)[][],
  filename: string,
  sheetName: string = "Données",
) {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  const colCount = aoa[0]?.length ?? 0;
  ws["!cols"] = Array.from({ length: colCount }, (_, i) => {
    const maxLen = aoa.reduce((m, row) => {
      const cell = row[i];
      const s    = cell == null ? "" : String(cell);
      return Math.max(m, s.length);
    }, 0);
    return { wch: Math.min(50, maxLen + 2) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}