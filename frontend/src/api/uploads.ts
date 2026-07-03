import { API_BASE, ApiErr, api } from "@/api/client";
import type {
  BatchPatchResult,
  ImportBatchStatus,
  UploadStockResult,
  UploadTxResult,
} from "@/types";


// ─── Multipart: single-shot achat/vente uploads (used by the Chrome extension) ──

// EXEMPTION: bypasses the api() wrapper because that helper JSON-encodes its body.
// Multipart uploads need a raw FormData with the browser-supplied boundary header
// (setting Content-Type ourselves would break the multipart parser). Identical
// cookies/CSRF/error semantics as api() — kept minimal and isolated to this file.
async function postMultipart<T>(path: string, file: File, batchId?: number): Promise<T> {
  const fd = new FormData();
  fd.append("file", file);
  if (batchId != null) fd.append("batch_id", String(batchId));

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "X-Requested-With": "XMLHttpRequest" },
    body: fd,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const detail = data?.detail ?? "L'upload a échoué.";
    throw new ApiErr(res.status, typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data as T;
}

export const uploadAchatMultipart = (file: File, batchId?: number): Promise<UploadTxResult> =>
  postMultipart("/uploads/achat", file, batchId);

export const uploadVenteMultipart = (file: File, batchId?: number): Promise<UploadTxResult> =>
  postMultipart("/uploads/vente", file, batchId);


// ─── JSON: chunked uploads (page wizard) — same shape the Chrome extension uses ─

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