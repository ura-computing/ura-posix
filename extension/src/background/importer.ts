/** The import queue — same flow as the app's import page (frontend/src/hooks/UploadContext.tsx):
 *  one file after the other; per file: account check, chunks of CHUNK_SIZE rows to
 *  POST /v1/uploads/{type}-json (the batch id of the 1st answer on the next ones), then
 *  PATCH /v1/uploads/batches/{id} success. « Annuler » between chunks → PATCH cancelled (the backend
 *  removes its rows); a failed chunk → PATCH error. Reads and writes go through a TanStack
 *  QueryClient, like the app's hooks (`fetchQuery` = useQuery, MutationObserver = useMutation). */
import { MutationObserver, QueryClient } from "@tanstack/query-core";

import { api, ApiErr } from "@/api/client";
import { API } from "@/api/api";
import type { DocType, ImportJob, JobError, MeResponse, UploadChunkBody, UploadChunkResult } from "@/types";
import { isRunning, readJobs, saveJob } from "@/utils/jobs";
import { FileError, readSobrusFile } from "@/utils/sobrusFile";
import { chunk } from "../../../frontend/src/utils/csv";

/** Rows per POST: same as the app's import page. */
const CHUNK_SIZE = 2000;
/** The permission each kind needs besides `import` (backend `member("import", …)`). */
const FEATURE: Record<DocType, string> = { achat: "achats", vente: "ventes", stock: "stock" };

const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

const readMe = () =>
  qc.fetchQuery({
    queryKey: API.auth.me.key,
    queryFn: () => api.get<MeResponse>(API.auth.me.url),
    staleTime: 60 * 1000,
  });

const uploadChunk = (docType: DocType, body: UploadChunkBody) =>
  new MutationObserver(qc, {
    mutationFn: (b: UploadChunkBody) => api.post<UploadChunkResult>(API.uploads[docType].url, b),
  }).mutate(body);

const setBatchStatus = (
  batchId: number,
  status: "success" | "cancelled" | "error",
  errorMessage: string | null = null,
) =>
  new MutationObserver(qc, {
    mutationFn: () => api.patch(API.uploads.setBatchStatus.url(batchId), { status, error_message: errorMessage }),
  }).mutate();

const queue: { job: ImportJob; rows: Record<string, string>[] }[] = [];
const cancelRequested = new Set<string>();
let running = false;

const toJobError = (err: unknown): JobError =>
  err instanceof ApiErr
    ? { code: err.code, detail: err.detail, params: err.params }
    : err instanceof FileError
      ? { code: err.code, detail: "", params: err.params }
      : { code: "unknown", detail: err instanceof Error ? err.message : "" };

/** Jobs left running by a stopped service worker (browser closed mid-import): shown as stopped. */
export async function markInterrupted(): Promise<void> {
  for (const job of await readJobs()) {
    if (isRunning(job)) await saveJob({ ...job, phase: "error", error: { code: "interrupted", detail: "" } });
  }
}

const newJob = (filename: string): ImportJob => ({
  id: crypto.randomUUID(),
  docType: null,
  filename,
  phase: "queued",
  current: 0,
  total: 0,
  inserted: 0,
  skipped: 0,
  batchId: null,
  error: null,
  createdAt: Date.now(),
});

/** The Sobrus page could not download the file: listed with why, nothing imported. */
export const downloadFailed = (filename: string) =>
  saveJob({ ...newJob(filename), phase: "error", error: { code: "sobrusDownload", detail: "" } });

/** Checks the file, queues it; gives its job id (the full-history import waits for it to end). */
export async function enqueue(filename: string, text: string): Promise<string> {
  const job = newJob(filename);
  try {
    const { docType, rows } = readSobrusFile(filename, text);
    const queued = { ...job, docType, total: Math.ceil(rows.length / CHUNK_SIZE) };
    await saveJob(queued);
    queue.push({ job: queued, rows });
    void run();
  } catch (err) {
    await saveJob({ ...job, phase: "error", error: toJobError(err) });
  }
  return job.id;
}

/** Queued → cancelled at once; running → stops before its next chunk. */
export async function cancel(id: string): Promise<void> {
  const i = queue.findIndex((q) => q.job.id === id);
  if (i >= 0) {
    const [{ job }] = queue.splice(i, 1);
    await saveJob({ ...job, phase: "cancelled" });
    return;
  }
  cancelRequested.add(id);
}

async function run(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (let next = queue.shift(); next; next = queue.shift()) await importOne(next.job, next.rows);
  } finally {
    running = false;
  }
}

async function importOne(start: ImportJob, rows: Record<string, string>[]): Promise<void> {
  const docType = start.docType as DocType;
  let job: ImportJob = { ...start, phase: "uploading" };
  const save = (patch: Partial<ImportJob>) => {
    job = { ...job, ...patch };
    return saveJob(job);
  };
  await save({});
  try {
    // Before any row: logged in, a pharmacy account, its permissions (the backend refuses anyway).
    const { permissions } = await readMe();
    if (!permissions.includes("import") || !permissions.includes(FEATURE[docType])) {
      throw new ApiErr(403, "featureDisabled", "");
    }
    for (const [i, part] of chunk(rows, CHUNK_SIZE).entries()) {
      if (cancelRequested.delete(job.id)) {
        if (job.batchId != null) await setBatchStatus(job.batchId, "cancelled");
        await save({ phase: "cancelled", inserted: 0, skipped: 0 });
        return;
      }
      const res = await uploadChunk(docType, {
        rows: part,
        filename: job.filename,
        batch_id: job.batchId ?? undefined,
      });
      await save({
        current: i + 1,
        batchId: job.batchId ?? res.batch_id,
        inserted: job.inserted + res.inserted,
        skipped: job.skipped + (res.skipped ?? res.skipped_unknown?.length ?? 0),
      });
    }
    // Awaited, not swallowed: without it the import stays « en cours » on PharmaGest.
    if (job.batchId != null) await setBatchStatus(job.batchId, "success");
    await save({ phase: "success" });
  } catch (err) {
    const error = toJobError(err);
    if (job.batchId != null) await setBatchStatus(job.batchId, "error", error.detail || error.code).catch(() => {});
    await save({ phase: "error", error });
  } finally {
    cancelRequested.delete(job.id);
  }
}
