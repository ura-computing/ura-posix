/** Sobrus export pages and files (saved pages of 2026-10-26): « Télécharger en CSV » is a button inside
 *  `<a download="Sobrus - Export Sales.csv" href="https://api.pharmav4.sobrus.com/reports/exports/sales?start_date=…&end_date=…">`.
 *  The same URL with other dates = the export of those dates, read with the Sobrus session. */
import type { DocType } from "@/types";

/** The export link, whatever the API host (api.pharma…, api.pharmav4…). */
export const EXPORT_LINK = 'a[download][href*="/reports/exports/"]';

/** The export pages of the full history, in import order (purchases first: margins need their PU). */
export const EXPORT_PAGES: { kind: DocType; url: string }[] = [
  { kind: "achat", url: "https://app.pharma.sobrus.com/reports/exportpurchases" },
  { kind: "vente", url: "https://app.pharma.sobrus.com/reports/exportsales" },
];

const API_PATH: Record<string, DocType> = { purchases: "achat", sales: "vente", stock: "stock" };
const KIND_PATH: Record<DocType, string> = { achat: "purchases", vente: "sales", stock: "stock" };

/** « …/reports/exports/sales?… » → vente; anything else → null. */
export function kindOfExportUrl(url: string): DocType | null {
  const m = new URL(url).pathname.match(/\/reports\/exports\/(\w+)/);
  return (m && API_PATH[m[1]]) || null;
}

/** The export of `kind` between 2 days (ISO), on the API host of the page's own link. */
export function exportUrl(apiOrigin: string, kind: DocType, start: string, end: string): string {
  return `${apiOrigin}/reports/exports/${KIND_PATH[kind]}?start_date=${start}&end_date=${end}`;
}

/** The name the app's import page expects (frontend/src/utils/csv.ts regexes), so the history
 *  shows the dates: « Sobrus - Ventes 2025-01-01 - 2025-12-31.csv », « Sobrus - Stock 20261026.csv ». */
export function exportFilename(url: string, fallback: string): string {
  const kind = kindOfExportUrl(url);
  const params = new URL(url).searchParams;
  const start = params.get("start_date");
  const end = params.get("end_date");
  if (kind === "achat" && start && end) return `Sobrus - Achats ${start} - ${end}.csv`;
  if (kind === "vente" && start && end) return `Sobrus - Ventes ${start} - ${end}.csv`;
  if (kind === "stock") return `Sobrus - Stock ${new Date().toISOString().slice(0, 10).replaceAll("-", "")}.csv`;
  return fallback;
}

/** chrome.storage.local: the full-history import in progress (the export pages still to do). */
export const FULL_EXPORT_KEY = "pharmagest_full_export";
export interface FullExport {
  /** Export pages still to do (the first = the one running). */
  kinds: DocType[];
  /** The years done, newest first: lines added, or null = Sobrus had no line that year. */
  log: { kind: DocType; year: number; inserted: number | null }[];
  /** Every page done: the summary stays until « Fermer ». */
  done: boolean;
}

/** Stops after this many years in a row without any line (the pharmacy's start on Sobrus). */
export const EMPTY_YEARS_TO_STOP = 5;
