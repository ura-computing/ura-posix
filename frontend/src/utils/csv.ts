/**
 * Tiny browser-side CSV parser. Sobrus exports use `;` as delimiter, sometimes
 * quote fields with `"`. No streaming / no escape support beyond paired quotes
 * — the wizard only needs to:
 *   1. Render the first 8 rows as a preview, and
 *   2. Chunk all rows into 500-row arrays for the JSON ingest endpoints.
 *
 * If we ever need fancier CSV parsing (multi-line quoted fields, etc.) we can
 * swap in `papaparse` (~12 KB gzipped). Sobrus output is regular enough that
 * the naive split below is fine.
 */

export interface ParsedCsv {
  headers: string[];
  rows:    Record<string, string>[];
}


export async function readFileText(file: File): Promise<string> {
  // BOM-aware: strip the leading byte-order-mark Sobrus often prepends.
  const text = await file.text();
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}


export function parseSobrusCsv(text: string): ParsedCsv {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = splitLine(lines[0]).map(unquote);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i]).map(unquote);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cells[j] ?? "";
    }
    rows.push(row);
  }
  return { headers, rows };
}


function splitLine(line: string): string[] {
  // Honors paired double quotes around a field that contains the delimiter.
  const out: string[] = [];
  let buf = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      buf += ch;
    } else if (ch === ";" && !inQuotes) {
      out.push(buf);
      buf = "";
    } else {
      buf += ch;
    }
  }
  out.push(buf);
  return out;
}


function unquote(s: string): string {
  const t = s.trim();
  return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
}


/** Chunk an array into N-row pieces. Used by UploadContext for batched uploads. */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}


// ─── Filename regex (mirror backend constants) ──────────────────────────────

export const ACHAT_FILENAME_RE = /^Sobrus - Achats \d{4}-\d{2}-\d{2} - \d{4}-\d{2}-\d{2}( \(\d+\))?\.csv$/i;
export const VENTE_FILENAME_RE = /^Sobrus - Ventes \d{4}-\d{2}-\d{2} - \d{4}-\d{2}-\d{2}( \(\d+\))?\.csv$/i;
export const STOCK_FILENAME_RE = /^Sobrus - Stock \d{8}( \(\d+\))?\.csv$/i;


/** Extract the date range from a Sobrus filename. Returns { from, to } as ISO strings or null. */
export function parseDatesFromFilename(name: string): { from: string; to: string } | null {
  const m = name.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
  return m ? { from: m[1], to: m[2] } : null;
}