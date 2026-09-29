import { api } from "@/api/client";
import type {
  BatchPatchResult,
  ImportBatchStatus,
  UploadStockResult,
  UploadTxResult,
} from "@/types";


// ─── JSON: chunked uploads (the /upload-file wizard) ────────────────────────

interface JsonBody {
  rows:      Record<string, string>[];
  filename?: string;
  batch_id?: number;
}

export const uploadAchatJson = (body: JsonBody): Promise<UploadTxResult> =>
  api<UploadTxResult>("/uploads/achat-json", { method: "POST", body });

export const uploadVenteJson = (body: JsonBody): Promise<UploadTxResult> =>
  api<UploadTxResult>("/uploads/vente-json", { method: "POST", body });

export const uploadStockJson = (body: JsonBody): Promise<UploadStockResult> =>
  api<UploadStockResult>("/uploads/stock-json", { method: "POST", body });


// ─── PATCH batch status (cancel or error) ────────────────────────────────────

export const patchBatchStatus = (
  batchId: number,
  status: ImportBatchStatus,
  errorMessage?: string,
): Promise<BatchPatchResult> =>
  api<BatchPatchResult>(`/uploads/batches/${batchId}`, {
    method: "PATCH",
    body: { status, error_message: errorMessage ?? null },
  });
