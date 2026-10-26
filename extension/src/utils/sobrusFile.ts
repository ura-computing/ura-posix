/** The checks a Sobrus file goes through before its import — the app's import page rules
 *  (frontend/src/pages/imports/upload/hooks.ts `checkFile`): damaged bytes, empty, kind, columns of
 *  its kind. The CSV reader is the app's own (frontend/src/utils/csv.ts). */
import {
  ACHAT_FILENAME_RE,
  parseSobrusCsv,
  STOCK_FILENAME_RE,
  VENTE_FILENAME_RE,
} from "../../../frontend/src/utils/csv";
import type { DocType } from "@/types";

/** A file refused before anything is imported: `errors.<code>` with its params. */
export class FileError extends Error {
  code: string;
  params: Record<string, string>;

  constructor(code: string, params: Record<string, string> = {}) {
    super(code);
    this.code = code;
    this.params = params;
  }
}

// Same as the app's import page.
const REQUIRED_COLUMNS: Record<DocType, string[]> = {
  achat: ["PID", "Produit", "Référence de livraison", "Quantité"],
  vente: ["PID", "Produit", "Numéro de transaction", "Quantité"],
  stock: ["PID", "Produit", "Stock"],
};
const asciiKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
// Every control character except tab, line feed, carriage return.
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

/** « Sobrus - Ventes 2026-01-01 - 2026-01-31.csv » → vente; a renamed file → from its columns. */
function docTypeOf(filename: string, headers: string[]): DocType | null {
  if (ACHAT_FILENAME_RE.test(filename)) return "achat";
  if (VENTE_FILENAME_RE.test(filename)) return "vente";
  if (STOCK_FILENAME_RE.test(filename)) return "stock";
  const have = new Set(headers.map(asciiKey));
  const kinds = (Object.keys(REQUIRED_COLUMNS) as DocType[]).filter((t) =>
    REQUIRED_COLUMNS[t].every((c) => have.has(asciiKey(c))),
  );
  return kinds.length === 1 ? kinds[0] : null;
}

/** Its kind and rows, else a FileError. */
export function readSobrusFile(filename: string, text: string): { docType: DocType; rows: Record<string, string>[] } {
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // byte-order mark
  const bad = body.search(CONTROL_CHAR);
  if (bad >= 0) throw new FileError("fileCorruptedLine", { line: String(body.slice(0, bad).split("\n").length) });
  const { headers, rows } = parseSobrusCsv(body);
  if (rows.length === 0) throw new FileError("emptyFile");
  const docType = docTypeOf(filename, headers);
  if (!docType) throw new FileError("unknownFile");
  const have = new Set(headers.map(asciiKey));
  const missing = REQUIRED_COLUMNS[docType].filter((c) => !have.has(asciiKey(c)));
  if (missing.length > 0) throw new FileError("missingColumns", { columns: missing.join(", ") });
  return { docType, rows };
}
