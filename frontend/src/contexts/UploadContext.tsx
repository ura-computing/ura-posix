import {
  createContext, useCallback, useContext, useMemo, useRef, useState,
  type ReactNode,
} from "react";

import { ApiErr } from "@/api/client";
import {
  patchBatchStatus,
  uploadAchatJson,
  uploadStockMultipart,
  uploadVenteJson,
} from "@/api/uploads";
import { chunk } from "@/utils/csv";
import type { DocType, UploadStockResult } from "@/types";


/**
 * Global upload state. Lives at the app root so a chunked upload survives
 * navigation away from /upload-file. The bottom-right UploadProgressWidget
 * reads from this same context, as does the /upload-file wizard itself.
 *
 * Critical: do NOT use AbortController to cancel fetches on unmount. The
 * whole point is that uploads keep advancing while the user works elsewhere.
 * Cancel is explicit (button → PATCH /uploads/batches/{id} → true undo).
 */

const CHUNK_SIZE = 500;


export type UploadPhase = "idle" | "uploading" | "success" | "cancelled" | "error";


export interface UploadProgress {
  current:  number;   // chunks finished
  total:    number;   // total chunks
  inserted: number;
  skipped:  number;
}


interface UploadCtxState {
  phase:       UploadPhase;
  progress:    UploadProgress;
  batchId:     number | null;
  error:       string | null;
  stockResult: UploadStockResult | null;
  /** Set when an upload starts; the widget reads these to render its label. */
  docType:     DocType | null;
  filename:    string | null;
}


interface UploadCtxValue extends UploadCtxState {
  /** Achat / Vente chunked POST. Rejects if an upload is already in flight. */
  uploadTx:    (docType: "achat" | "vente", rows: Record<string, string>[], filename: string) => Promise<void>;
  /** Single-shot multipart stock upload. */
  uploadStock: (file: File) => Promise<void>;
  /** Set cancel flag; the running loop catches it between chunks and PATCHes the batch. */
  cancel:      () => void;
  /** Reset the context to idle. Called by the wizard's "Nouvel import" / by the widget after success auto-dismiss. */
  reset:       () => void;
}


const INITIAL: UploadCtxState = {
  phase: "idle",
  progress: { current: 0, total: 0, inserted: 0, skipped: 0 },
  batchId: null,
  error: null,
  stockResult: null,
  docType: null,
  filename: null,
};


const UploadContext = createContext<UploadCtxValue | null>(null);


export function UploadProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UploadCtxState>(INITIAL);
  const cancelRef = useRef(false);
  /** Guard against a second upload starting while one is still in flight. */
  const inFlightRef = useRef(false);

  const reset = useCallback(() => {
    cancelRef.current = false;
    inFlightRef.current = false;
    setState(INITIAL);
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const uploadTx = useCallback<UploadCtxValue["uploadTx"]>(
    async (docType, rows, filename) => {
      if (inFlightRef.current) {
        // Don't silently overwrite an in-flight upload.
        throw new Error("Un upload est déjà en cours. Annulez-le ou attendez la fin.");
      }
      inFlightRef.current = true;
      cancelRef.current = false;

      const chunks = chunk(rows, CHUNK_SIZE);
      const total = chunks.length;
      let batchId: number | null = null;
      let inserted = 0;
      let skipped = 0;

      setState({
        ...INITIAL,
        phase: "uploading",
        progress: { current: 0, total, inserted: 0, skipped: 0 },
        docType,
        filename,
      });

      const post = docType === "achat" ? uploadAchatJson : uploadVenteJson;

      try {
        for (let i = 0; i < chunks.length; i++) {
          if (cancelRef.current) {
            if (batchId != null) {
              await patchBatchStatus(batchId, "cancelled").catch(() => undefined);
            }
            setState((s) => ({ ...s, phase: "cancelled", batchId, progress: { ...s.progress, inserted: 0, skipped: 0 } }));
            inFlightRef.current = false;
            return;
          }
          const result = await post({
            rows:     chunks[i],
            filename,
            batch_id: batchId ?? undefined,
          });
          if (batchId == null) batchId = result.batch_id;
          inserted += result.inserted;
          skipped  += result.skipped;
          setState((s) => ({
            ...s,
            phase: "uploading",
            progress: { current: i + 1, total, inserted, skipped },
            batchId,
          }));
        }
        setState((s) => ({
          ...s,
          phase: "success",
          progress: { current: total, total, inserted, skipped },
          batchId,
        }));
      } catch (err) {
        const detail = err instanceof ApiErr ? err.detail : "Erreur inconnue lors de l'upload.";
        if (batchId != null) {
          await patchBatchStatus(batchId, "error", detail).catch(() => undefined);
        }
        setState((s) => ({ ...s, phase: "error", batchId, error: detail }));
      } finally {
        inFlightRef.current = false;
      }
    },
    [],
  );

  const uploadStock = useCallback<UploadCtxValue["uploadStock"]>(
    async (file) => {
      if (inFlightRef.current) throw new Error("Un upload est déjà en cours.");
      inFlightRef.current = true;
      cancelRef.current = false;

      setState({
        ...INITIAL,
        phase: "uploading",
        progress: { current: 0, total: 1, inserted: 0, skipped: 0 },
        docType: "stock",
        filename: file.name,
      });
      try {
        const result = await uploadStockMultipart(file);
        setState((s) => ({
          ...s,
          phase: "success",
          progress: { current: 1, total: 1, inserted: result.inserted, skipped: result.skipped_unknown.length },
          batchId: result.batch_id,
          stockResult: result,
        }));
      } catch (err) {
        const detail = err instanceof ApiErr ? err.detail : "Erreur inconnue lors de l'upload.";
        setState((s) => ({ ...s, phase: "error", error: detail }));
      } finally {
        inFlightRef.current = false;
      }
    },
    [],
  );

  const value = useMemo<UploadCtxValue>(
    () => ({ ...state, uploadTx, uploadStock, cancel, reset }),
    [state, uploadTx, uploadStock, cancel, reset],
  );

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}


export function useUploadCtx(): UploadCtxValue {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUploadCtx must be used inside <UploadProvider>");
  return ctx;
}