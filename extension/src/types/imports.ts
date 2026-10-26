/** Imports sent by the extension (stored in chrome.storage.local, `utils/jobs.ts`) and the
 *  backend's chunk answer (app/ingestion/router.py). */

export type DocType = "achat" | "vente" | "stock";
export type JobPhase = "queued" | "uploading" | "success" | "cancelled" | "error";

/** What went wrong: `code` = `errors.<code>` (the backend's ErrorCode or the extension's own),
 *  `detail` = the backend's French text, shown when the code has no translation. */
export interface JobError {
  code: string;
  detail: string;
  params?: Record<string, string>;
}

/** One Sobrus file sent to PharmaGest. */
export interface ImportJob {
  id: string;
  docType: DocType | null;
  filename: string;
  phase: JobPhase;
  /** Chunks sent / to send. */
  current: number;
  total: number;
  inserted: number;
  skipped: number;
  batchId: number | null;
  error: JobError | null;
  createdAt: number;
}

/** POST /v1/uploads/{type}-json. */
export interface UploadChunkResult {
  inserted: number;
  batch_id: number;
  /** Achats / ventes. */
  skipped?: number;
  /** Stock: the lines whose product is unknown. */
  skipped_unknown?: unknown[];
}

export interface UploadChunkBody {
  rows: Record<string, string>[];
  filename: string;
  batch_id?: number;
}

/** GET /v1/data/imports (backend app/ingestion/schemas.py ImportRow): the fields shown. */
export interface ServerImport {
  id: number;
  file_type: DocType;
  filename: string | null;
  rows_inserted: number;
  rows_skipped: number;
  /** success | in_progress | interrupted | cancelled | error */
  status: string;
  imported_at: string;
  deleted_at: string | null;
}

export interface ServerImportsResponse {
  data: ServerImport[];
}

/** content script / popup → service worker. */
export type ExtensionMessage =
  /** Answer: `{ id }` = its job. */
  | { type: "IMPORT_CSV"; filename: string; text: string }
  | { type: "DOWNLOAD_FAILED"; filename: string }
  | { type: "CANCEL_IMPORT"; id: string }
  /** Popup « Importer tout l'historique »: opens the Sobrus export pages one after the other. */
  | { type: "START_FULL_EXPORT" };
