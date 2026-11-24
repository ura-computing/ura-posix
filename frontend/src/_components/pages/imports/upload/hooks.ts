import { useCallback, useMemo, useState } from "react";

import {
  ACHAT_FILENAME_RE,
  STOCK_FILENAME_RE,
  VENTE_FILENAME_RE,
  parseDatesFromFilename,
  parseSobrusCsv,
  readFileText,
} from "@/utils/csv";
import type { DocType } from "@/types";

import { useUploadCtx, type UploadPhase } from "@/hooks/useUpload";
import { translate } from "@/i18n/I18nProvider";

/**
 * Wizard state machine — owns step navigation + selected doc-type + parsed
 * file preview. Delegates upload execution + queue to the global
 * the upload provider (`hooks/useUpload.tsx`).
 *
 * Steps:
 *   1. Pick docType (Achats | Ventes | Stock)
 *   2. Drop or browse-pick a Sobrus CSV (filename validated per type); Achats / Ventes:
 *      several files at once (each checked the same way, a wrong one is left out)
 *   3. Preview first 8 rows + date range → click "Importer" (enqueues a job); several files:
 *      one line per file → « Importer les N fichiers » (one job each, FIFO, results kept)
 *
 * REHYDRATION is now SCOPED PER DOC-TYPE — fixes the previous "blank page"
 * bug. `job` = the most-recent job in `jobs` for THIS
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

/** Columns a Sobrus file of this type must have. Compared on ASCII letters only, so
 *  « Référence » and a broken « RÃ©fÃ©rence » both match. */
const REQUIRED_COLUMNS: Record<DocType, string[]> = {
  achat: ["PID", "Produit", "Référence de livraison", "Quantité"],
  vente: ["PID", "Produit", "Numéro de transaction", "Quantité"],
  stock: ["PID", "Produit", "Stock"],
};
const asciiKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
// Every control character except tab, line feed, carriage return.
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/;

/** One file of a multi-file pick: its rows when good, else why it is left out. */
export interface PickedFile {
  name: string;
  rows: Record<string, string>[];
  dates: { from: string; to: string } | null;
  error: string | null;
}

/** The checks every Sobrus file goes through before its import (name, damaged bytes, empty,
 *  columns of its type). */
async function checkFile(
  f: File,
  t: DocType,
): Promise<{ error: string } | { headers: string[]; rows: Record<string, string>[] }> {
  if (!FILENAME_REGEX[t].test(f.name)) {
    return { error: translate("uploadFile.badFilename", { example: EXAMPLE_FILENAME[t] }) };
  }
  const text = await readFileText(f);
  // Control characters (NUL…) never appear in a good Sobrus export: the file is damaged.
  // Stop here, before anything is imported, and say which line.
  const bad = text.search(CONTROL_CHAR);
  if (bad >= 0) return { error: translate("uploadFile.corrupted", { line: text.slice(0, bad).split("\n").length }) };
  const parsed = parseSobrusCsv(text);
  if (parsed.rows.length === 0) return { error: translate("uploadFile.emptyFile") };
  const have = new Set(parsed.headers.map(asciiKey));
  const missing = REQUIRED_COLUMNS[t].filter((c) => !have.has(asciiKey(c)));
  // e.g. a Ventes file renamed « Achats »
  if (missing.length > 0) return { error: translate("uploadFile.missingColumns", { columns: missing.join(", ") }) };
  return { headers: parsed.headers, rows: parsed.rows };
}

export function useUpload(initialDocType: DocType | null = null) {
  const { jobs, cancelUpload, dismissJob, enqueueUpload } = useUploadCtx();

  // Local-only wizard scaffolding. Lost on unmount — that's OK because the
  // state card pulls everything from the rehydrated job below.
  const [localStep, setStep] = useState<Step>(initialDocType ? 2 : 1);
  const [localDocType, setDocType] = useState<DocType | null>(initialDocType);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [allRows, setAllRows] = useState<Record<string, string>[]>([]);
  const [filenameError, setFilenameError] = useState<string | null>(null);
  // Several files picked together (Achats / Ventes), then the ids of their jobs once queued.
  const [picked, setPicked] = useState<PickedFile[]>([]);
  const [batchIds, setBatchIds] = useState<string[]>([]);

  // One-shot "user clicked Nouvel import while the upload was running"
  // marker. Suppresses the rehydration card *for this mount only* so the
  // wizard goes back to the picker. Cleared when the user picks a type
  // (entering the wizard for that type means they want to see its card).
  // On next page mount (real navigation), this resets to false — the
  // global the upload provider (`hooks/useUpload.tsx`) still tracks the running job and the indicator
  // bubble in the layout keeps showing progress.
  const [dismissedRunningCard, setDismissedRunningCard] = useState(false);

  // ── Per-doc-type rehydration ─────────────────────────────────────────────
  // The wizard for `type=achat` cares only about achat jobs; it must NOT
  // show a running stock job's state card (which would render blank because
  // the local file/headers belong to a different intent).
  // From `jobs` (state), not getJobByDocType (reads a ref): the React Compiler caches a
  // call whose inputs never change, so the wizard would never see the job progress.
  const job = localDocType ? ([...jobs].reverse().find((j) => j.docType === localDocType) ?? null) : null;

  // Render priority: local file-preview > active/recent job for this docType > wizard
  // - localStep=3 + file: user is on the confirmation step with a freshly-picked file
  // - else if job (and not session-dismissed): show the rehydrated job's state card
  // - else:               normal wizard step 1 or 2
  const showJobCard = !file && job !== null && !dismissedRunningCard && batchIds.length === 0;
  const batchJobs = batchIds.map((id) => jobs.find((j) => j.id === id)).filter((j) => j !== undefined);
  const step: Step = showJobCard || picked.length > 0 || batchJobs.length > 0 ? 3 : localStep;
  const docType: DocType | null = localDocType;

  const previewRows = useMemo(() => allRows.slice(0, 8), [allRows]);
  const fileDates = useMemo(() => (file ? parseDatesFromFilename(file.name) : null), [file]);

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
    setPicked([]);
    setBatchIds([]);
    setStep(1);
  }, []);

  const acceptFile = useCallback(async (f: File, t: DocType) => {
    const checked = await checkFile(f, t);
    if ("error" in checked) {
      setFilenameError(checked.error);
      return;
    }
    setFilenameError(null);
    setFile(f);
    setHeaders(checked.headers);
    setAllRows(checked.rows);
    setStep(3);
  }, []);

  /** Several files dropped / picked at once. One file = the usual preview. Stock: one file only
   *  (each stock file is a full snapshot that replaces the previous one). */
  const acceptFiles = useCallback(
    async (files: File[], t: DocType) => {
      if (files.length <= 1) {
        if (files[0]) await acceptFile(files[0], t);
        return;
      }
      if (t === "stock") {
        setFilenameError(translate("uploadFile.oneStockFile"));
        return;
      }
      setFilenameError(null);
      const list: PickedFile[] = [];
      for (const f of files) {
        const checked = await checkFile(f, t);
        list.push({
          name: f.name,
          rows: "error" in checked ? [] : checked.rows,
          dates: parseDatesFromFilename(f.name),
          error: "error" in checked ? checked.error : null,
        });
      }
      setPicked(list);
      setStep(3);
    },
    [acceptFile],
  );

  const changeFile = useCallback(() => {
    setFile(null);
    setHeaders([]);
    setAllRows([]);
    setFilenameError(null);
    setPicked([]);
    setStep(2);
  }, []);

  /** Enqueue the parsed file and clear the local preview so the rehydration
   *  logic picks up the new job and renders its state card. Returns the
   *  uploadId so callers can reference it (not used today). */
  const startImport = useCallback(() => {
    if (!localDocType || !file || allRows.length === 0) return;
    const id = enqueueUpload(localDocType, allRows, file.name);
    // Release local preview state — `job` (rehydration) will now render the
    // queued/running card for this doc-type.
    setFile(null);
    setHeaders([]);
    setAllRows([]);
    return id;
  }, [localDocType, file, allRows, enqueueUpload]);

  /** « Importer les N fichiers »: one job per good file, in the order picked (the queue runs
   *  them one after the other); their results stay on the page until « Nouvel import ». */
  const startImportAll = useCallback(() => {
    if (!localDocType) return;
    const good = picked.filter((p) => p.error === null);
    setBatchIds(good.map((p) => enqueueUpload(localDocType, p.rows, p.name, true)));
    setPicked([]);
  }, [localDocType, picked, enqueueUpload]);

  /** Cancel the files of the batch not imported yet (queued or running). */
  const cancelBatch = useCallback(() => {
    for (const j of batchJobs) if (j.phase === "queued" || j.phase === "uploading") cancelUpload(j.id);
  }, [batchJobs, cancelUpload]);

  /** Cancel the currently-rehydrated job (queued or running). */
  const cancel = useCallback(() => {
    if (job) cancelUpload(job.id);
  }, [job, cancelUpload]);

  /** "Nouvel import" — return to step 1, like any normal navigation.
   *  • If the job is still in flight: leave it running in the global
   *    the upload provider (`hooks/useUpload.tsx`) (the indicator bubble keeps showing it) and just
   *    hide its card for this mount via `dismissedRunningCard`.
   *  • If the job is finished (success / error / cancelled): dismiss its
   *    card from the global state so navigating back doesn't keep
   *    showing a stale outcome. */
  const reset = useCallback(() => {
    // A batch: its finished files leave the list; the ones still running go on (layout bubble).
    for (const j of batchJobs) if (j.phase !== "queued" && j.phase !== "uploading") dismissJob(j.id);
    if (batchJobs.length > 0) {
      backToType();
      return;
    }
    if (job) {
      if (job.phase === "queued" || job.phase === "uploading") {
        setDismissedRunningCard(true);
      } else {
        dismissJob(job.id);
      }
    }
    backToType();
  }, [job, batchJobs, dismissJob, backToType]);

  return {
    // shell state (rehydration scoped per-doc-type via `job`)
    step,
    docType,
    file,
    headers,
    previewRows,
    totalRows: allRows.length,
    fileDates,
    filenameError,
    examples: EXAMPLE_FILENAME,
    // shell actions
    pickType,
    backToType,
    acceptFile,
    acceptFiles,
    changeFile,
    startImport,
    picked,
    startImportAll,
    batchJobs,
    cancelBatch,
    clearFilenameError: () => setFilenameError(null),
    // job state (null when no job for this doc-type) — the state card reads from here
    phase: (job?.phase ?? "idle") as UploadPhase | "idle",
    progress: job?.progress ?? {
      current: 0,
      total: 0,
      inserted: 0,
      skipped: 0,
    },
    batchId: job?.batchId ?? null,
    error: job?.error ?? null,
    stockResult: job?.stockResult ?? null,
    filename: job?.filename ?? null,
    cancel,
    reset,
  };
}
