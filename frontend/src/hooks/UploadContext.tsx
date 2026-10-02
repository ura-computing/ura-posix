import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiErr, api } from "@/api/client";
import { URLS } from "@/api/urls";
import { changedByImport } from "@/api/queries";
import { translate } from "@/i18n/I18nProvider";
import { chunk } from "@/utils/csv";
import { type DocType, type UploadStockResult, type UploadTxResult } from "@/types";


/**
 * Multi-upload queue (strict FIFO, concurrency=1). Provider lives at the app
 * root so uploads survive navigation. Every drop on /upload-file enqueues a
 * UploadJob; a single runner loop processes the queue head-first.
 *
 * Cancellation:
 *  - Queued job  → flipped to "cancelled" + skipped on next runner pass
 *  - Running job → cancelRequested flag; existing between-chunks check PATCHes
 *                  the batch and ends the loop
 *
 * Refresh = state loss (parity with the previous single-upload context). Chunks
 * already committed survive on the backend.
 */

const CHUNK_SIZE = 500;
/** Auto-dismiss a "success" card N ms after it completes. Manual dismiss for
 *  cancelled/error/queued so the user has time to read what happened. */
const AUTO_DISMISS_MS = 4_000;


export type UploadPhase = "queued" | "uploading" | "success" | "cancelled" | "error";


export interface UploadProgress {
  current:  number;   // chunks finished
  total:    number;   // total chunks
  inserted: number;
  skipped:  number;
  /** Per-reason skip breakdown for achat/vente (zero for stock — stock surfaces
   *  unknowns via `UploadStockResult.skipped_unknown` already). */
  skipped_no_pid?:        number;
  skipped_no_medicament?: number;
  skipped_duplicate?:     number;
  /** F19: products created during this import that weren't in the catalogue. */
  new_medicaments?: { count: number; sample: string[] };
}


export interface UploadJob {
  id:          string;
  docType:     DocType;
  filename:    string;
  /** Parsed rows held in memory until the runner picks this job up. Released
   *  after the chunked loop completes (or fails / is cancelled). */
  rows:        Record<string, string>[];
  phase:       UploadPhase;
  progress:    UploadProgress;
  batchId:     number | null;
  error:       string | null;
  stockResult: UploadStockResult | null;
  /** Monotonic timestamp used for stable sort. */
  createdAt:   number;
  /** Timestamp the job transitioned to "success" — used for the auto-dismiss
   *  countdown. Distinct from createdAt because the queue can stall a job
   *  for arbitrary minutes before it runs. */
  successAt:   number | null;
}


interface UploadCtxValue {
  /** All non-dismissed jobs. Iteration order = enqueue order (FIFO). */
  jobs: UploadJob[];

  /** Add a job to the queue tail. Returns the new job's id. Runner wakes up
   *  automatically. Same file twice → two separate jobs (backend dedup handles
   *  the actual duplicate detection). */
  enqueueUpload: (docType: DocType, rows: Record<string, string>[], filename: string) => string;

  /** Cancel a job by id. Queued → immediate flip to cancelled. Running →
   *  request cancel + the chunked loop catches it between chunks and PATCHes
   *  the batch (same as the old single-upload cancel flow). */
  cancelUpload: (id: string) => void;

  /** Remove a job from state (user dismissed its card). Successful cards
   *  auto-dismiss after AUTO_DISMISS_MS; this is the manual-dismiss path. */
  dismissJob: (id: string) => void;

  /** Wizard rehydration: the most-recent job for `docType`, regardless of
   *  phase. Returns null if no job matches — wizard renders step-1 picker.
   *  This is what fixes the "blank page" navigation bug. */
  getJobByDocType: (docType: DocType) => UploadJob | null;
}


const UploadContext = createContext<UploadCtxValue | null>(null);


export function UploadProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [jobs, setJobs] = useState<Map<string, UploadJob>>(() => new Map());

  /** Refs that survive across renders. The runner reads jobsRef (not the React
   *  state, which it would close over at start time) so it always sees the
   *  current queue. Updated SYNCHRONOUSLY in upsertJob/patchJob alongside the
   *  setJobs call — never in the render body, which would race with React's
   *  commit phase and break the queueMicrotask wake-up in enqueueUpload. */
  const jobsRef         = useRef(jobs);
  const cancelFlagsRef  = useRef<Set<string>>(new Set());
  const runnerActiveRef = useRef(false);
  /** Auto-dismiss timer ids per job, so we don't re-schedule on every render. */
  const dismissTimersRef = useRef<Map<string, number>>(new Map());

  // ── State helpers (keep jobsRef in lockstep with React state) ─────────────

  const upsertJob = useCallback((job: UploadJob) => {
    const next = new Map(jobsRef.current);
    next.set(job.id, job);
    jobsRef.current = next;
    setJobs(next);
  }, []);

  const patchJob = useCallback((id: string, patch: Partial<UploadJob>) => {
    const existing = jobsRef.current.get(id);
    if (!existing) return;
    const next = new Map(jobsRef.current);
    next.set(id, { ...existing, ...patch });
    jobsRef.current = next;
    setJobs(next);
  }, []);

  // ── Runner loop ──────────────────────────────────────────────────────────

  /** Run a single chunked upload, mirroring the previous single-state loop.
   *  All state mutations route through patchJob(id, …) so each job has its
   *  own progress/error/stockResult. */
  const runChunkedUpload = useCallback(async (job: UploadJob): Promise<void> => {
    const chunks = chunk(job.rows, CHUNK_SIZE);
    const total = chunks.length;
    let batchId: number | null = null;
    let inserted = 0;
    let skipped = 0;
    let skippedNoPid = 0;
    let skippedNoMed = 0;
    let skippedDup   = 0;
    let newMedCount = 0;
    const newMedSample: string[] = [];
    const skippedUnknownAcc: { pid: string; product: string | null }[] = [];

    patchJob(job.id, {
      phase: "uploading",
      progress: { current: 0, total, inserted: 0, skipped: 0 },
    });

    const post = (body: { rows: Record<string, string>[]; filename: string; batch_id?: number }) =>
      api.post<UploadTxResult | UploadStockResult>(URLS.uploads[job.docType], body);

    try {
      for (let i = 0; i < chunks.length; i++) {
        if (cancelFlagsRef.current.has(job.id)) {
          if (batchId != null) {
            await api.patch(URLS.uploads.batch(batchId), { status: "cancelled", error_message: null }).catch(() => undefined);
          }
          patchJob(job.id, { phase: "cancelled", batchId });
          cancelFlagsRef.current.delete(job.id);
          return;
        }
        const result = await post({
          rows:     chunks[i],
          filename: job.filename,
          batch_id: batchId ?? undefined,
        });
        if (batchId == null) batchId = result.batch_id;
        inserted += result.inserted;
        if ("skipped_unknown" in result) {
          skipped += result.skipped_unknown.length;
          for (const item of result.skipped_unknown) {
            if (skippedUnknownAcc.length >= 100) break;
            skippedUnknownAcc.push(item);
          }
        } else {
          skipped      += result.skipped;
          skippedNoPid += result.skipped_no_pid;
          skippedNoMed += result.skipped_no_medicament;
          skippedDup   += result.skipped_duplicate;
        }
        if (result.new_medicaments) {
          newMedCount += result.new_medicaments.count;
          for (const name of result.new_medicaments.sample) {
            if (newMedSample.length >= 10) break;
            if (!newMedSample.includes(name)) newMedSample.push(name);
          }
        }
        patchJob(job.id, {
          phase: "uploading",
          progress: {
            current: i + 1, total, inserted, skipped,
            skipped_no_pid:        skippedNoPid,
            skipped_no_medicament: skippedNoMed,
            skipped_duplicate:     skippedDup,
            new_medicaments: { count: newMedCount, sample: newMedSample.slice() },
          },
          batchId,
        });
      }
      const stockResult: UploadStockResult | null = job.docType === "stock" && batchId != null ? {
        inserted,
        skipped_unknown: skippedUnknownAcc.slice(),
        total_rows:      job.rows.length,
        batch_id:        batchId,
        new_medicaments: { count: newMedCount, sample: newMedSample.slice() },
      } : null;
      patchJob(job.id, {
        phase: "success",
        progress: {
          current: total, total, inserted, skipped,
          skipped_no_pid:        skippedNoPid,
          skipped_no_medicament: skippedNoMed,
          skipped_duplicate:     skippedDup,
          new_medicaments: { count: newMedCount, sample: newMedSample.slice() },
        },
        batchId,
        stockResult,
        successAt: Date.now(),
      });
    } catch (err) {
      const detail = err instanceof ApiErr ? err.detail : translate("toast.genericError");
      if (batchId != null) {
        await api.patch(URLS.uploads.batch(batchId), { status: "error", error_message: detail }).catch(() => undefined);
      }
      patchJob(job.id, { phase: "error", batchId, error: detail });
      toast.error(detail);
    } finally {
      // Rows added / removed: queries on screen refetch now (Rapport open during an import), others on next visit.
      if (batchId != null) void qc.invalidateQueries({ predicate: changedByImport(job.docType) });
    }
  }, [patchJob, qc]);

  /** Main loop: drain queued jobs FIFO. Awakened by enqueueUpload via
   *  wakeRunnerRef. Idle when no queued job is found. */
  const runner = useCallback(async () => {
    if (runnerActiveRef.current) return;
    runnerActiveRef.current = true;
    try {
      while (true) {
        const next = [...jobsRef.current.values()]
          .filter((j) => j.phase === "queued")
          .sort((a, b) => a.createdAt - b.createdAt)[0];
        if (!next) return;
        await runChunkedUpload(next);
      }
    } finally {
      runnerActiveRef.current = false;
    }
  }, [runChunkedUpload]);

  // Wake the runner whenever the jobs map changes (enqueue, cancel, etc).
  // Effects run AFTER React commits, so jobsRef is already current — no race
  // with the runner's `findNextQueued` scan. Idempotent thanks to runnerActiveRef.
  useEffect(() => { void runner(); }, [jobs, runner]);

  // ── Public API ───────────────────────────────────────────────────────────

  /** Cheap monotonic id. Native crypto.randomUUID isn't on every browser we
   *  support, so prefer Date.now + perf for uniqueness; the only requirement
   *  is per-session distinctness. */
  const newId = (): string =>
    `up_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const enqueueUpload = useCallback<UploadCtxValue["enqueueUpload"]>(
    (docType, rows, filename) => {
      const id = newId();
      const job: UploadJob = {
        id,
        docType,
        filename,
        rows,
        phase: "queued",
        progress: { current: 0, total: 0, inserted: 0, skipped: 0 },
        batchId: null,
        error: null,
        stockResult: null,
        createdAt: Date.now(),
        successAt: null,
      };
      upsertJob(job);
      // No explicit wake — the runner-wake effect picks up the jobs change
      // after React commits and starts processing the queue.
      return id;
    },
    [upsertJob],
  );

  const cancelUpload = useCallback<UploadCtxValue["cancelUpload"]>((id) => {
    const job = jobsRef.current.get(id);
    if (!job) return;
    if (job.phase === "queued") {
      patchJob(id, { phase: "cancelled" });
    } else if (job.phase === "uploading") {
      // Runner picks up the flag between chunks.
      cancelFlagsRef.current.add(id);
    }
  }, [patchJob]);

  const dismissJob = useCallback<UploadCtxValue["dismissJob"]>((id) => {
    if (!jobsRef.current.has(id)) return;
    const next = new Map(jobsRef.current);
    next.delete(id);
    // Ref + state must stay in lockstep: `getJobByDocType` reads the ref, so
    // skipping this line would leave the dismissed job visible to the
    // upload wizard → "Nouvel import" wouldn't navigate.
    jobsRef.current = next;
    setJobs(next);
  }, []);

  const getJobByDocType = useCallback<UploadCtxValue["getJobByDocType"]>(
    (docType) => {
      const matching = [...jobsRef.current.values()]
        .filter((j) => j.docType === docType)
        .sort((a, b) => b.createdAt - a.createdAt);
      return matching[0] ?? null;
    },
    [],
  );

  // ── Auto-dismiss successful cards ───────────────────────────────────────
  // Scheduling is keyed on job.id in dismissTimersRef so we don't re-schedule
  // on every render (which would flicker timings as state changes). Each
  // success-job gets exactly ONE timer based on its own successAt timestamp.

  useEffect(() => {
    for (const job of jobs.values()) {
      if (job.phase !== "success" || job.successAt == null) continue;
      if (dismissTimersRef.current.has(job.id)) continue;
      const remaining = Math.max(0, AUTO_DISMISS_MS - (Date.now() - job.successAt));
      const t = window.setTimeout(() => {
        dismissTimersRef.current.delete(job.id);
        dismissJob(job.id);
      }, remaining);
      dismissTimersRef.current.set(job.id, t);
    }
    // Drop timers for jobs that vanished from state (cancelled mid-success, etc).
    for (const [id, t] of dismissTimersRef.current.entries()) {
      if (!jobs.has(id)) {
        window.clearTimeout(t);
        dismissTimersRef.current.delete(id);
      }
    }
  }, [jobs, dismissJob]);

  // ── Memoize the list view + provide ─────────────────────────────────────

  const jobsList = useMemo(
    () => [...jobs.values()].sort((a, b) => a.createdAt - b.createdAt),
    [jobs],
  );

  const value = useMemo<UploadCtxValue>(
    () => ({ jobs: jobsList, enqueueUpload, cancelUpload, dismissJob, getJobByDocType }),
    [jobsList, enqueueUpload, cancelUpload, dismissJob, getJobByDocType],
  );

  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}


export function useUploadCtx(): UploadCtxValue {
  const ctx = useContext(UploadContext);
  if (!ctx) throw new Error("useUploadCtx must be used inside <UploadProvider>");
  return ctx;
}
