import {
  createContext, useCallback, useContext, useMemo, useRef, useState,
  type ReactNode,
} from "react";

import { ApiErr } from "@/api/client";
import {
  patchBatchStatus,
  uploadAchatJson,
  uploadStockJson,
  uploadVenteJson,
} from "@/api/uploads";
import { chunk } from "@/utils/csv";
import type { DocType, UploadStockResult, UploadTxResult } from "@/types";


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
  /** F19: products created during this import that weren't in the catalogue.
   *  Owner sees them in the Success card; admin classifies them via
   *  /admin/catalogue → "Non classés". Accumulates across chunks. */
  new_medicaments?: { count: number; sample: string[] };
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
  /** Chunked POST for any doc type (achat / vente / stock). Rejects if an
   *  upload is already in flight. Single entry point — the doc-type only
   *  changes which JSON endpoint each chunk hits + how the result is summarized. */
  uploadTx:    (docType: DocType, rows: Record<string, string>[], filename: string) => Promise<void>;
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
      let newMedCount = 0;
      const newMedSample: string[] = [];                                // capped at 10 across all chunks
      // Stock-only: accumulate the {pid, product} list across chunks (capped
      // at 100 entries — enough for diagnosis without blowing up state).
      const skippedUnknownAcc: { pid: string; product: string | null }[] = [];

      setState({
        ...INITIAL,
        phase: "uploading",
        progress: { current: 0, total, inserted: 0, skipped: 0 },
        docType,
        filename,
      });

      const post: (body: { rows: Record<string, string>[]; filename: string; batch_id?: number }) => Promise<UploadTxResult | UploadStockResult> =
        docType === "achat" ? uploadAchatJson
        : docType === "vente" ? uploadVenteJson
        : uploadStockJson;

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
          // Stock returns skipped_unknown[]; achat/vente return skipped (count).
          if ("skipped_unknown" in result) {
            skipped += result.skipped_unknown.length;
            for (const item of result.skipped_unknown) {
              if (skippedUnknownAcc.length >= 100) break;
              skippedUnknownAcc.push(item);
            }
          } else {
            skipped += result.skipped;
          }
          // F19: accumulate new-medicament tally across chunks; cap sample at 10.
          if (result.new_medicaments) {
            newMedCount += result.new_medicaments.count;
            for (const name of result.new_medicaments.sample) {
              if (newMedSample.length >= 10) break;
              if (!newMedSample.includes(name)) newMedSample.push(name);
            }
          }
          setState((s) => ({
            ...s,
            phase: "uploading",
            progress: {
              current: i + 1, total, inserted, skipped,
              new_medicaments: { count: newMedCount, sample: newMedSample.slice() },
            },
            batchId,
          }));
        }
        // Build the stock-shaped result for the Success card (only for docType="stock").
        const stockResult: UploadStockResult | null = docType === "stock" && batchId != null ? {
          inserted,
          skipped_unknown: skippedUnknownAcc.slice(),
          total_rows:      rows.length,
          batch_id:        batchId,
          new_medicaments: { count: newMedCount, sample: newMedSample.slice() },
        } : null;
        setState((s) => ({
          ...s,
          phase: "success",
          progress: {
            current: total, total, inserted, skipped,
            new_medicaments: { count: newMedCount, sample: newMedSample.slice() },
          },
          batchId,
          stockResult,
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

  const value = useMemo<UploadCtxValue>(
    () => ({ ...state, uploadTx, cancel, reset }),
    [state, uploadTx, cancel, reset],
  );

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}


export function useUploadCtx(): UploadCtxValue {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUploadCtx must be used inside <UploadProvider>");
  return ctx;
}