import { useCallback, useMemo, useState } from "react";

import {
  ACHAT_FILENAME_RE, STOCK_FILENAME_RE, VENTE_FILENAME_RE,
  parseDatesFromFilename, parseSobrusCsv, readFileText,
} from "@/utils/csv";
import type { DocType } from "@/types";

import { useUploadCtx } from "@/contexts/UploadContext";


/**
 * Wizard state machine — owns step navigation + selected doc-type + parsed
 * file preview. Delegates the actual upload (and its survives-navigation
 * lifetime) to the global UploadContext.
 *
 * Steps:
 *   1. Pick docType (Achats | Ventes | Stock)
 *   2. Drop or browse-pick a Sobrus CSV (filename validated per type)
 *   3. Preview first 8 rows + date range → click "Importer"
 *
 * REHYDRATION: if the user navigates AWAY mid-upload then comes back to
 * /upload-file, the local wizard state (file, parsed rows) is gone but the
 * context still has phase/progress/docType/filename. We override `step` →
 * 3 and `docType` → context.docType so the wizard renders the state card
 * (Uploading/Success/etc.) instead of starting over at step 1.
 */

export type Step = 1 | 2 | 3;


const FILENAME_REGEX: Record<DocType, RegExp> = {
  achat: ACHAT_FILENAME_RE,
  vente: VENTE_FILENAME_RE,
  stock: STOCK_FILENAME_RE,
};

const EXAMPLE_FILENAME: Record<DocType, string> = {
  achat: "Sobrus - Achats 2026-06-01 - 2026-06-22.csv",
  vente: "Sobrus - Ventes 2026-06-01 - 2026-06-22.csv",
  stock: "Sobrus - Stock 20260622.csv",
};


export function useUpload(initialDocType: DocType | null = null) {
  const upload = useUploadCtx();

  // Local-only wizard scaffolding. Lost on unmount — that's OK because the
  // state card only reads phase/docType/filename (all in the context).
  const [localStep,    setStep]    = useState<Step>(initialDocType ? 2 : 1);
  const [localDocType, setDocType] = useState<DocType | null>(initialDocType);
  const [file,         setFile]    = useState<File | null>(null);
  const [headers,      setHeaders] = useState<string[]>([]);
  const [allRows,      setAllRows] = useState<Record<string, string>[]>([]);
  const [filenameError, setFilenameError] = useState<string | null>(null);

  // ── Rehydration: an in-flight or just-finished upload takes priority over local wizard nav ──
  const hasActiveUpload = upload.phase !== "idle";
  const step:    Step          = hasActiveUpload ? 3 : localStep;
  const docType: DocType | null = hasActiveUpload ? upload.docType : localDocType;

  const previewRows = useMemo(() => allRows.slice(0, 8), [allRows]);
  const fileDates   = useMemo(() => (file ? parseDatesFromFilename(file.name) : null), [file]);

  const pickType = useCallback((t: DocType) => {
    setDocType(t);
    setStep(2);
  }, []);

  const backToType = useCallback(() => {
    setFile(null);
    setHeaders([]);
    setAllRows([]);
    setFilenameError(null);
    upload.reset();
    setStep(1);
  }, [upload]);

  const acceptFile = useCallback(async (f: File, t: DocType) => {
    if (!FILENAME_REGEX[t].test(f.name)) {
      setFilenameError(
        `Nom de fichier invalide. Format attendu : « ${EXAMPLE_FILENAME[t]} »`,
      );
      return;
    }
    setFilenameError(null);
    const text   = await readFileText(f);
    const parsed = parseSobrusCsv(text);
    setFile(f);
    setHeaders(parsed.headers);
    setAllRows(parsed.rows);
    setStep(3);
  }, []);

  const changeFile = useCallback(() => {
    setFile(null);
    setHeaders([]);
    setAllRows([]);
    setFilenameError(null);
    upload.reset();
    setStep(2);
  }, [upload]);

  const startImport = useCallback(() => {
    if (!localDocType || !file || allRows.length === 0) return;
    return upload.uploadTx(localDocType, allRows, file.name);
  }, [localDocType, file, allRows, upload]);

  return {
    // shell state (rehydration applied to step + docType)
    step, docType, file,
    headers, previewRows, totalRows: allRows.length, fileDates, filenameError,
    examples: EXAMPLE_FILENAME,
    // shell actions
    pickType, backToType, acceptFile, changeFile, startImport,
    // upload state + actions (delegated to context)
    phase:       upload.phase,
    progress:    upload.progress,
    batchId:     upload.batchId,
    error:       upload.error,
    stockResult: upload.stockResult,
    filename:    upload.filename,    // exposed so the wizard's state card can label itself when local `file` is null after navigation
    cancel:      upload.cancel,
    reset:       () => { upload.reset(); backToType(); },
  };
}