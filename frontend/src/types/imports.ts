/** Upload wizard + import history (mirrors backend/app/ingestion/schemas.py). */

// ── Upload-file types ────────────────────────────────────────────────────────

export type DocType = "achat" | "vente" | "stock";

/** `interrupted` is never stored: the backend shows it for an `in_progress` batch with no chunk
 *  for 1 min (browser closed or refreshed before the last chunk). */
export type ImportBatchStatus = "in_progress" | "success" | "cancelled" | "error" | "interrupted";

/** Response from /v1/uploads/{achat|vente}{,-json} */
export interface UploadTxResult {
  inserted: number;
  skipped: number; // total = no_pid + no_medicament + duplicate
  /** Per-reason breakdown so the post-upload card can show an honest cause
   *  instead of blaming every skip on "doublons". */
  skipped_no_pid: number;
  skipped_no_medicament: number;
  skipped_duplicate: number;
  batch_id: number;
  /** F19: products that didn't exist in the catalogue and were created during
   *  this import. Owner sees them as "needs admin classification" — they'll
   *  appear in /admin/catalogue under the "Non classés" filter. */
  new_medicaments: {
    count: number;
    sample: string[]; // first 10 product names
  };
}

/** Response from /v1/uploads/stock-json (per chunk). The frontend
 *  accumulates these across chunks into the final UploadProgress state. */
export interface UploadStockResult {
  inserted: number;
  skipped_unknown: { pid: string; product: string | null }[];
  total_rows: number;
  batch_id: number;
  /** F19: medicaments created during this chunk (PIDs not yet in catalogue).
   *  Surfaced to the owner so admin can classify via /admin/catalogue. */
  new_medicaments?: { count: number; sample: string[] };
}

/** Response from PATCH /v1/uploads/batches/{id} */
export interface BatchPatchResult {
  id: number;
  status: ImportBatchStatus;
  error_message: string | null;
  /** Number of Achat/Vente rows the PATCH deleted (only on status='cancelled'). */
  deleted_rows: number;
}

/** A row from GET /v1/data/imports — drives the /imports page. */
export interface DataImport {
  id: number;
  file_type: DocType;
  filename: string | null;
  rows_inserted: number;
  rows_skipped: number;
  status: ImportBatchStatus;
  error_message: string | null;
  imported_at: string;
  /** Who did the import. NULL for pre-migration batches. */
  created_by_full_name: string | null;
  created_by_email: string | null;
  /** Soft-delete audit. `deleted_at` set ⇒ the row renders as history. */
  deleted_at: string | null;
  deleted_by_full_name: string | null;
  deleted_by_email: string | null;
}

export interface DataImportsResponse {
  data: DataImport[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
}
