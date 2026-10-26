/** Sending Sobrus exports to PharmaGest from the page: one clicked file, or the whole history (each
 *  export page, year by year, newest first, until EMPTY_YEARS_TO_STOP empty years in a row). The rows
 *  go through the service worker's queue: the app's batching (chunks of 2000 rows, one batch id, a
 *  final PATCH). Each year waits for the previous import to end. */
import type { DocType, ExtensionMessage, ImportJob } from "@/types";
import { isRunning, onJobsChange, readJobs } from "@/utils/jobs";
import {
  EMPTY_YEARS_TO_STOP,
  EXPORT_LINK,
  EXPORT_PAGES,
  exportFilename,
  exportUrl,
  FULL_EXPORT_KEY,
  type FullExport,
} from "@/utils/sobrusExport";

import { downloadText } from "./download";
import { clearSpotlight, pause, showClick, showDates } from "./spotlight";
import { getView, setView, type YearStep } from "./state";

/** The API host when the page shows no export link yet (seen on 2026-10-26). */
const DEFAULT_API_ORIGIN = "https://api.pharmav4.sobrus.com";

// The extension was reloaded / updated: this old page can't reach it any more.
const alive = () => !!chrome.runtime?.id;
export const send = (msg: ExtensionMessage) => {
  if (alive()) void chrome.runtime.sendMessage(msg);
};

/** Queues a file in the service worker; gives its job id. */
const enqueue = (filename: string, text: string) =>
  chrome.runtime
    .sendMessage<ExtensionMessage, { id: string }>({ type: "IMPORT_CSV", filename, text })
    .then((r) => r.id);

// ── One file: « Télécharger en CSV » clicked ──────────────────────────────────

export async function importClicked(url: string, fallbackName: string): Promise<void> {
  const filename = exportFilename(url, fallbackName);
  const id = crypto.randomUUID();
  const track = (bytes: number) =>
    setView({ downloads: [...getView().downloads.filter((d) => d.id !== id), { id, filename, bytes }] });
  track(0);
  try {
    const text = await downloadText(url, track);
    if (alive()) await enqueue(filename, text);
  } catch {
    send({ type: "DOWNLOAD_FAILED", filename });
  } finally {
    setView({ downloads: getView().downloads.filter((d) => d.id !== id) });
  }
}

// ── The whole history ────────────────────────────────────────────────────────

export async function readFullExport(): Promise<FullExport | null> {
  const res = await chrome.storage.local.get(FULL_EXPORT_KEY);
  return (res[FULL_EXPORT_KEY] as FullExport | undefined) ?? null;
}
export const writeFullExport = (state: FullExport | null) =>
  state ? chrome.storage.local.set({ [FULL_EXPORT_KEY]: state }) : chrome.storage.local.remove(FULL_EXPORT_KEY);

/** The API host of the page's own export link (it renders after the page's scripts), else the default. */
async function apiOrigin(): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const link = document.querySelector<HTMLAnchorElement>(EXPORT_LINK);
    if (link) return new URL(link.href).origin;
    await pause(500);
  }
  return DEFAULT_API_ORIGIN;
}

/** The job once it is no longer queued / running. */
async function jobEnd(id: string): Promise<ImportJob | null> {
  const done = (jobs: ImportJob[]) => {
    const job = jobs.find((j) => j.id === id);
    return job && !isRunning(job) ? job : null;
  };
  const now = done(await readJobs());
  if (now) return now;
  return new Promise((resolve) => {
    const stop = onJobsChange((jobs) => {
      const job = done(jobs);
      if (job) {
        stop();
        resolve(job);
      }
    });
  });
}

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dataLines = (csv: string) => csv.split("\n").filter((l) => l.trim()).length - 1;

/** Ends the full history (stopped, refused, or every page done). */
async function finish(state: FullExport | null) {
  clearSpotlight();
  setView({ step: null });
  await writeFullExport(state);
}

/** One year: shown on the page, downloaded, sent; its log line (null = no line that year). */
async function runYear(origin: string, kind: DocType, year: number, today: Date): Promise<number | null | "stop"> {
  const start = `${year}-01-01`;
  const end = year === today.getFullYear() ? iso(today) : `${year}-12-31`;
  let step: YearStep = { kind, year, start, end, phase: "dates", bytes: 0, jobId: null };
  const show = (patch: Partial<YearStep>) => {
    step = { ...step, ...patch };
    setView({ step });
  };
  show({});
  await showDates(start, end);
  show({ phase: "click" });
  await showClick();
  clearSpotlight();
  show({ phase: "download" });
  const url = exportUrl(origin, kind, start, end);
  let text: string;
  try {
    text = await downloadText(url, (bytes) => show({ bytes }));
  } catch {
    send({ type: "DOWNLOAD_FAILED", filename: exportFilename(url, "export.csv") });
    return "stop";
  }
  show({ phase: "read" });
  if (dataLines(text) <= 0) return null;
  if (!alive()) return "stop";
  const id = await enqueue(exportFilename(url, "export.csv"), text);
  show({ phase: "send", jobId: id });
  const job = await jobEnd(id);
  return job?.phase === "success" ? job.inserted : "stop";
}

/** On an export page, when the popup asked for the whole history and it is this page's turn. */
export async function runFullExport(): Promise<void> {
  const state = await readFullExport();
  const page = EXPORT_PAGES.find((p) => location.pathname.startsWith(new URL(p.url).pathname));
  if (!state || state.done || !page || state.kinds[0] !== page.kind) return;
  const origin = await apiOrigin();
  const today = new Date();
  let log = state.log;
  let emptyYears = 0;
  for (let year = today.getFullYear(); emptyYears < EMPTY_YEARS_TO_STOP; year--) {
    if (!(await readFullExport())) return finish(null); // « Arrêter »
    const result = await runYear(origin, page.kind, year, today);
    // Refused / failed: the summary stays (with why, in the jobs); stopped by the user: nothing stays.
    if (result === "stop") return finish((await readFullExport()) ? { ...state, log, done: true } : null);
    emptyYears = result === null ? emptyYears + 1 : 0;
    log = [...log, { kind: page.kind, year, inserted: result }];
    await writeFullExport({ ...state, log });
  }
  const kinds = state.kinds.slice(1);
  const next = EXPORT_PAGES.find((p) => p.kind === kinds[0]);
  await finish({ kinds, log, done: !next });
  if (next) location.href = next.url;
}

/** « Arrêter »: no next year; the running import is cancelled (the backend removes its rows). */
export function stopFullExport(): void {
  const { step } = getView();
  void finish(null);
  if (step?.jobId) send({ type: "CANCEL_IMPORT", id: step.jobId });
}
