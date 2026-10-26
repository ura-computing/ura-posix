/** What the Sobrus page card shows, in one place: `setView(patch)` re-draws the card (`card.ts`). */
import type { Lang } from "@/i18n/config";
import type { DocType, ImportJob } from "@/types";
import type { FullExport } from "@/utils/sobrusExport";

/** The year of the full history being done right now, step by step. */
export interface YearStep {
  kind: DocType;
  year: number;
  start: string;
  end: string;
  phase: "dates" | "click" | "download" | "read" | "send";
  /** Bytes received from Sobrus so far. */
  bytes: number;
  jobId: string | null;
}

/** A file clicked on the page, still downloading from Sobrus (no job yet). */
export interface PendingDownload {
  id: string;
  filename: string;
  bytes: number;
}

export interface View {
  lang: Lang;
  jobs: ImportJob[];
  full: FullExport | null;
  step: YearStep | null;
  downloads: PendingDownload[];
  /** The jobs shown: created on this page, after the last « Fermer ». */
  shownSince: number;
}

let view: View = { lang: "fr", jobs: [], full: null, step: null, downloads: [], shownSince: Date.now() };
let draw: (v: View) => void = () => {};

export const getView = () => view;

export function setView(patch: Partial<View>): void {
  view = { ...view, ...patch };
  draw(view);
}

export function onView(fn: (v: View) => void): void {
  draw = fn;
  fn(view);
}
