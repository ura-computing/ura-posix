/** The imports, in chrome.storage.local: written by the service worker only, read by the popup
 *  (`hooks/useJobs.ts`) and the Sobrus page card. Newest first, the last JOBS_KEPT. */
import { errorText, type TFn } from "@/i18n/translate";
import type { ImportJob } from "@/types";

const JOBS_KEY = "pharmagest_jobs";
const JOBS_KEPT = 10;

export async function readJobs(): Promise<ImportJob[]> {
  const res = await chrome.storage.local.get(JOBS_KEY);
  return (res[JOBS_KEY] as ImportJob[] | undefined) ?? [];
}

/** Insert or replace by id. The service worker is the only writer and awaits each save: no lost update. */
export async function saveJob(job: ImportJob): Promise<void> {
  const others = (await readJobs()).filter((j) => j.id !== job.id);
  const jobs = [job, ...others].sort((a, b) => b.createdAt - a.createdAt).slice(0, JOBS_KEPT);
  await chrome.storage.local.set({ [JOBS_KEY]: jobs });
}

/** Called on every change of the list (another part of the extension saved a job). */
export function onJobsChange(listener: (jobs: ImportJob[]) => void): () => void {
  const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === "local" && changes[JOBS_KEY]) listener((changes[JOBS_KEY].newValue as ImportJob[] | undefined) ?? []);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

export const isRunning = (job: ImportJob) => job.phase === "queued" || job.phase === "uploading";

/** What happened to a file, in one sentence (popup + Sobrus page card). */
export function jobStatus(t: TFn, job: ImportJob): string {
  if (job.phase === "error" && job.error) return errorText(t, job.error);
  if (job.phase === "uploading") return t("phase.uploading", { current: job.current, total: job.total });
  if (job.phase === "success") return t("phase.success", { inserted: job.inserted, skipped: job.skipped });
  return t(`phase.${job.phase}`);
}
