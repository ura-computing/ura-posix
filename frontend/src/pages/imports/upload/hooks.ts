import { useCallback, useMemo, useState } from "react";

import {
  ACHAT_FILENAME_RE, STOCK_FILENAME_RE, VENTE_FILENAME_RE,
  parseDatesFromFilename, parseSobrusCsv, readFileText,
} from "@/utils/csv";
import type { DocType } from "@/types";

import { useUploadCtx, type UploadPhase } from "@/hooks/UploadContext";


/**
 * Wizard state machine — owns step navigation + selected doc-type + parsed
 * file preview. Delegates upload execution + queue to the global
 * UploadContext.
 *
 * Steps:
 *   1. Pick docType (Achats | Ventes | Stock)
 *   2. Drop or browse-pick a Sobrus CSV (filename validated per type)
 *   3. Preview first 8 rows + date range → click "Importer" (enqueues a job)
 *
 * REHYDRATION is now SCOPED PER DOC-TYPE — fixes the previous "blank page"
 * bug. `getJobByDocType(localDocType)` returns the most-recent job for THIS
 * doc-type (queued / running / finished). If present, we render its state
 * card; otherwise the wizard renders normally. Navigating to a different
 * doc-type while another is running shows that doc-type's wizard (or its
 * own job), not the global running one.
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
  // state card pulls everything from the rehydrated job below.
  const [localStep,    setStep]    = useState<Step>(initialDocType ? 2 : 1);
  const [localDocType, setDocType] = useState<DocType | null>(initialDocType);
  const [file,         setFile]    = useState<File | null>(null);
  const [headers,      setHeaders] = useState<string[]>([]);
  const [allRows,      setAllRows] = useState<Record<string, string>[]>([]);
  const [filenameError, setFilenameError] = useState<string | null>(null);

  // One-shot "user clicked Nouvel import while the upload was running"
  // marker. Suppresses the rehydration card *for this mount only* so the
  // wizard goes back to the picker. Cleared when the user picks a type
  // (entering the wizard for that type means they want to see its card).
  // On next page mount (real navigation), this resets to false — the
  // global UploadContext still tracks the running job and the indicator
  // bubble in the layout keeps showing progress.
  const [dismissedRunningCard, setDismissedRunningCard] = useState(false);

  // ── Per-doc-type rehydration ─────────────────────────────────────────────
  // The wizard for `type=achat` cares only about achat jobs; it must NOT
  // show a running stock job's state card (which would render blank because
  // the local file/headers belong to a different intent).
  const job = localDocType ? upload.getJobByDocType(localDocType) : null;

  // Render priority: local file-preview > active/recent job for this docType > wizard
  // - localStep=3 + file: user is on the confirmation step with a freshly-picked file
  // - else if job (and not session-dismissed): show the rehydrated job's state card
  // - else:               normal wizard step 1 or 2
  const showJobCard = !file && job !== null && !dismissedRunningCard;
  const step:    Step           = showJobCard ? 3 : localStep;
  const docType: DocType | null = localDocType;

  const previewRows = useMemo(() => allRows.slice(0, 8), [allRows]);
  const fileDates   = useMemo(() => (file ? parseDatesFromFilename(file.name) : null), [file]);

  const pickType = useCallback((t: DocType) => {
    setDocType(t);
    setStep(2);
    // Picking a type means "I want this type's wizard" — re-show its job
    // card if one exists, so the user can monitor / dismiss / cancel it.
    setDismissedRunningCard(false);
  }, []);

  const backToType = useCallback(() => {
    setFile(null);
    setHeaders([]);
    setAllRows([]);
    setFilenameError(null);
    setStep(1);
  }, []);

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
    setStep(2);
  }, []);

  /** Enqueue the parsed file and clear the local preview so the rehydration
   *  logic picks up the new job and renders its state card. Returns the
   *  uploadId so callers can reference it (not used today). */
  const startImport = useCallback(() => {
    if (!localDocType || !file || allRows.length === 0) return;
    const id = upload.enqueueUpload(localDocType, allRows, file.name);
    // Release local preview state — `job` (rehydration) will now render the
    // queued/running card for this doc-type.
    setFile(null);
    setHeaders([]);
    setAllRows([]);
    return id;
  }, [localDocType, file, allRows, upload]);

  /** Cancel the currently-rehydrated job (queued or running). */
  const cancel = useCallback(() => {
    if (job) upload.cancelUpload(job.id);
  }, [job, upload]);

  /** "Nouvel import" — return to step 1, like any normal navigation.
   *  • If the job is still in flight: leave it running in the global
   *    UploadContext (the indicator bubble keeps showing it) and just
   *    hide its card for this mount via `dismissedRunningCard`.
   *  • If the job is finished (success / error / cancelled): dismiss its
   *    card from the global state so navigating back doesn't keep
   *    showing a stale outcome. */
  const reset = useCallback(() => {
    if (job) {
      if (job.phase === "queued" || job.phase === "uploading") {
        setDismissedRunningCard(true);
      } else {
        upload.dismissJob(job.id);
      }
    }
    backToType();
  }, [job, upload, backToType]);

  return {
    // shell state (rehydration scoped per-doc-type via `job`)
    step, docType, file,
    headers, previewRows, totalRows: allRows.length, fileDates, filenameError,
    examples: EXAMPLE_FILENAME,
    // shell actions
    pickType, backToType, acceptFile, changeFile, startImport,
    // job state (null when no job for this doc-type) — the state card reads from here
    phase:       (job?.phase       ?? "idle") as UploadPhase | "idle",
    progress:    job?.progress    ?? { current: 0, total: 0, inserted: 0, skipped: 0 },
    batchId:     job?.batchId     ?? null,
    error:       job?.error       ?? null,
    stockResult: job?.stockResult ?? null,
    filename:    job?.filename    ?? null,
    cancel,
    reset,
  };
}
