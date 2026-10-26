/** The card bottom right of the Sobrus page (plain DOM in a shadow root: no React on someone else's
 *  page, no clash with Sobrus' CSS). The app's light tokens (frontend/src/styles/tokens.css).
 *  - Full history: the steps of the current year (dates → clic → téléchargement Mo → lecture → envoi with
 *    a progress bar), the years done, « Arrêter »; at the end the summary, « Voir mes imports ».
 *  - Clicked files: downloading (Mo), then their import (progress bar, « Annuler »). */
import { translateIn, type TFn } from "@/i18n/translate";
import type { DocType, ImportJob } from "@/types";
import { formatDate, formatQty, formatSize } from "@/utils/format";
import { isRunning, jobStatus } from "@/utils/jobs";
import { appUrl } from "@/utils/links";
import { EMPTY_YEARS_TO_STOP } from "@/utils/sobrusExport";

import { send, stopFullExport, writeFullExport } from "./imports";
import { setView, type View, type YearStep } from "./state";

const STYLE = `
  :host { all: initial; }
  .card { position: fixed; right: 20px; bottom: 20px; z-index: 2147483646; width: 380px; max-height: 80vh;
    overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding: 16px; border: 1px solid #e3e8e7;
    border-radius: 16px; background: #fff; color: #121a18; box-shadow: 0 12px 32px rgba(18,26,24,.22);
    font: 14px/1.45 Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .title { font-size: 15px; font-weight: 700; color: #0e9e8c; }
  .sub { font-size: 13px; color: #5b6a67; }
  .steps { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: 10px; background: #f5f8f7; }
  .step { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #5b6a67; }
  .step.now { color: #121a18; font-weight: 600; } .step.ok { color: #15803d; }
  .icon { width: 16px; height: 16px; flex: none; display: inline-flex; align-items: center; justify-content: center; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: #c9d2d0; }
  .spin { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #cdeee9; border-top-color: #0e9e8c;
    animation: spin .8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .bar { height: 8px; border-radius: 99px; background: #e3e8e7; overflow: hidden; }
  .fill { height: 100%; border-radius: 99px; background: #0e9e8c; transition: width .3s; }
  .fill.moving { width: 35% !important; animation: slide 1.1s ease-in-out infinite; }
  @keyframes slide { 0% { margin-left: -35%; } 100% { margin-left: 100%; } }
  .log { display: flex; flex-direction: column; gap: 2px; font-size: 12px; color: #5b6a67; max-height: 120px; overflow-y: auto; }
  .job { display: flex; flex-direction: column; gap: 6px; padding: 10px; border: 1px solid #e3e8e7; border-radius: 10px; }
  .name { font-size: 12px; color: #5b6a67; word-break: break-all; }
  .status { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
  .success { color: #15803d; } .error { color: #b42318; }
  button { cursor: pointer; border-radius: 8px; padding: 8px 14px; font: 500 14px/1.4 inherit; font-family: inherit; }
  .primary { border: 0; background: #0e9e8c; color: #fff; } .primary:hover { background: #0c8a79; }
  .secondary { border: 1px solid #e3e8e7; background: #fff; color: #121a18; } .secondary:hover { background: #f0f4f3; }
  .close { border: 0; background: none; color: #5b6a67; padding: 4px 8px; font-size: 13px; }
`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text; // text only: a file name never becomes HTML
  return node;
}

function button(className: string, text: string, onClick: () => void) {
  const b = el("button", className, text);
  b.addEventListener("click", onClick);
  return b;
}

/** A progress bar: `ratio` 0 → 1, or null = still unknown (moving stripe). */
function bar(ratio: number | null) {
  const outer = el("div", "bar");
  const fill = el("div", ratio == null ? "fill moving" : "fill");
  fill.style.width = `${Math.round((ratio ?? 0) * 100)}%`;
  outer.appendChild(fill);
  return outer;
}

const icon = (state: "done" | "now" | "todo") => {
  const box = el("span", "icon", state === "done" ? "✓" : "");
  if (state === "now") box.appendChild(el("span", "spin"));
  if (state === "todo") box.appendChild(el("span", "dot"));
  return box;
};

const PHASES: YearStep["phase"][] = ["dates", "click", "download", "read", "send"];

/** The 5 steps of the current year, the current one with its spinner (and its bar when sending). */
function yearSteps(t: TFn, step: YearStep, job: ImportJob | undefined) {
  const box = el("div", "steps");
  const now = PHASES.indexOf(step.phase);
  const label: Record<YearStep["phase"], string> = {
    dates: t("full.stepDates", { start: formatDate(step.start), end: formatDate(step.end) }),
    click: t("full.stepClick"),
    download: t("full.stepDownload", { size: formatSize(step.bytes) }),
    read: t("full.stepRead"),
    send: job ? t("full.stepSend", { current: job.current, total: job.total }) : t("full.stepSendWait"),
  };
  PHASES.forEach((phase, i) => {
    const state = i < now ? "done" : i === now ? "now" : "todo";
    const row = el("div", `step ${state === "done" ? "ok" : state === "now" ? "now" : ""}`);
    row.append(icon(state), el("span", "", label[phase]));
    box.appendChild(row);
  });
  if (step.phase === "download") box.appendChild(bar(null));
  if (step.phase === "send") box.appendChild(bar(job && job.total ? job.current / job.total : null));
  return box;
}

let root: ShadowRoot | null = null;

export function drawCard(view: View): void {
  const { lang, jobs, full, step, downloads, shownSince } = view;
  const shown = jobs.filter((j) => j.createdAt >= shownSince);
  const visible = full || step || downloads.length > 0 || shown.length > 0;
  if (!root) {
    if (!visible) return;
    const host = document.createElement("div");
    document.body.appendChild(host);
    root = host.attachShadow({ mode: "open" });
  }
  root.replaceChildren();
  if (!visible) return;
  const t = translateIn(lang);
  const kindName = (kind: DocType | null) => t(`kind.${kind ?? "unknown"}`);
  const card = el("div", "card");
  const busy = (full && !full.done) || !!step;

  // Title + « Fermer » (not while the history runs: « Arrêter » is the way out).
  const head = el("div", "head");
  head.appendChild(el("span", "title", full ? t("full.title") : t("card.title")));
  if (!busy) {
    head.appendChild(
      button("close", t("card.close"), () => {
        if (full?.done) void writeFullExport(null);
        setView({ shownSince: Date.now() });
      }),
    );
  }
  card.appendChild(head);

  if (full) {
    if (step) {
      card.appendChild(el("div", "sub", t("full.yearOf", { kind: kindName(step.kind), year: step.year })));
      card.appendChild(
        yearSteps(
          t,
          step,
          jobs.find((j) => j.id === step.jobId),
        ),
      );
    } else if (!full.done) {
      card.appendChild(el("div", "step now")).append(icon("now"), el("span", "", t("full.starting")));
    } else {
      card.appendChild(el("div", "status success", t("full.finished")));
    }
    if (full.log.length > 0) {
      const added = full.log.reduce((sum, l) => sum + (l.inserted ?? 0), 0);
      card.appendChild(el("div", "sub", t("full.total", { n: formatQty(added) })));
      const log = el("div", "log");
      for (const l of [...full.log].reverse()) {
        const text =
          l.inserted == null
            ? t("full.logEmpty", { kind: kindName(l.kind), year: l.year })
            : t("full.logDone", { kind: kindName(l.kind), year: l.year, n: formatQty(l.inserted) });
        log.appendChild(el("div", "", text));
      }
      card.appendChild(log);
      if (!full.done) card.appendChild(el("div", "sub", t("full.stopRule", { n: EMPTY_YEARS_TO_STOP })));
    }
    if (busy) card.appendChild(button("secondary", t("full.stop"), stopFullExport));
  }

  // Clicked files (and, after the history, its imports with an error).
  for (const d of downloads) {
    const row = el("div", "job");
    const status = el("div", "status");
    status.append(icon("now"), el("span", "", t("card.downloading", { size: formatSize(d.bytes) })));
    row.append(status, el("div", "name", d.filename), bar(null));
    card.appendChild(row);
  }
  if (!full) {
    for (const job of shown) {
      const row = el("div", "job");
      const status = el("div", `status ${job.phase === "success" ? "success" : job.phase === "error" ? "error" : ""}`);
      if (isRunning(job)) status.appendChild(icon("now"));
      status.appendChild(el("span", "", `${kindName(job.docType)} · ${jobStatus(t, job)}`));
      row.append(status, el("div", "name", job.filename));
      if (job.phase === "uploading") row.appendChild(bar(job.total ? job.current / job.total : null));
      if (isRunning(job))
        row.appendChild(button("secondary", t("jobs.cancel"), () => send({ type: "CANCEL_IMPORT", id: job.id })));
      card.appendChild(row);
    }
  } else if (full.done) {
    for (const job of shown.filter((j) => j.phase === "error")) {
      card.appendChild(el("div", "status error", `${kindName(job.docType)} · ${jobStatus(t, job)}`));
    }
  }

  if (!busy && (full?.done || shown.some((j) => j.phase === "success"))) {
    card.appendChild(button("primary", t("jobs.seeAll"), () => window.open(appUrl("/imports"), "_blank", "noopener")));
  }

  const style = el("style", "", STYLE);
  root.append(style, card);
}
