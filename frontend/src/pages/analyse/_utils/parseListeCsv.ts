/** CSV parser for /analyses → Liste mode. Detects the delimiter (`;` or `,`),
 *  reads the header, and maps the Produit / PID / Code-barre columns to
 *  ListeItem. Strips a UTF-8 BOM (real ﻿ or mojibake "ï»¿") that Sobrus glues
 *  to the first header — otherwise the PID column is never detected. */
import type { ListeItem } from "@/types";


function detectColumn(headers: string[], aliases: string[]): number {
  const norm = (s: string) =>
    s.replace(/﻿|ï»¿/g, "").toLowerCase().replace(/[\s_-]/g, "");
  const normalizedHeaders = headers.map(norm);
  for (const a of aliases) {
    const idx = normalizedHeaders.indexOf(norm(a));
    if (idx >= 0) return idx;
  }
  return -1;
}


export function parseCsv(text: string): ListeItem[] {
  // Drop a leading real BOM so it can't leak into the first data cell either.
  text = text.replace(/^﻿/, "");
  // Detect delimiter from the first line (`;` wins over `,`).
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0].split(delim).map((s) => s.trim().replace(/^"|"$/g, ""));
  const nameIdx     = detectColumn(headers, ["produit", "product", "designation", "désignation"]);
  const pidIdx      = detectColumn(headers, ["pid", "id", "code"]);
  const barcode1Idx = detectColumn(headers, ["codebarre1", "barcode1", "ean", "codebarre"]);
  const barcode2Idx = detectColumn(headers, ["codebarre2", "barcode2"]);

  // If no "Produit" column detected, fall back to first column.
  const effectiveNameIdx = nameIdx >= 0 ? nameIdx : 0;

  const items: ListeItem[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delim).map((s) => s.trim().replace(/^"|"$/g, ""));
    const name  = cells[effectiveNameIdx] || "";
    if (!name) continue;
    items.push({
      name,
      pid:      pidIdx      >= 0 ? cells[pidIdx]      || undefined : undefined,
      barcode1: barcode1Idx >= 0 ? cells[barcode1Idx] || undefined : undefined,
      barcode2: barcode2Idx >= 0 ? cells[barcode2Idx] || undefined : undefined,
    });
  }
  return items;
}