/**
 * Shared upload progress banner — shows a stacked list of upload jobs.
 * Supports multiple simultaneous uploads: active one with progress bar,
 * queued ones showing "En attente...", completed ones showing results.
 */

import { CANCEL_UPLOAD_KEY /*, UPLOAD_STATUS_KEY*/ } from "../constants";
import type { UploadJob } from "./sobrusExport";

export type BannerConfig = {
  onViewData: (path: string) => void;
};

const BANNER_ID = "__apcm-upload-banner";

function _ensureStyles() {
  if (document.getElementById("__apcm-banner-styles")) return;
  const s = document.createElement("style");
  s.id = "__apcm-banner-styles";
  s.textContent = `
    @keyframes __apcm-spin { to { transform: rotate(360deg); } }
    @keyframes __apcm-up   { from { opacity:0;transform:translateY(12px) } to { opacity:1;transform:none } }
  `;
  document.head.appendChild(s);
}

const SPINNER = `<span style="
  width:14px;height:14px;border-radius:50%;flex-shrink:0;
  border:2px solid rgba(20,184,166,0.3);border-top-color:#14b8a6;
  animation:__apcm-spin 0.7s linear infinite;display:inline-block
"></span>`;

const DOT = (c: string) => `<span style="
  width:7px;height:7px;border-radius:50%;flex-shrink:0;
  background:${c};display:inline-block;margin-top:2px
"></span>`;

const HOURGLASS = `<span style="font-size:12px;flex-shrink:0;opacity:0.6">⏳</span>`;

function _renderJob(job: UploadJob /*, config: BannerConfig*/): string {
  const label = job.fileType === "achat" ? "Achats" : job.fileType === "vente" ? "Ventes" : "Stock";
  const badgeBg = job.fileType === "achat" ? "rgba(59,130,246,0.2)"
    : job.fileType === "vente" ? "rgba(16,185,129,0.2)"
    : "rgba(168,85,247,0.2)";
  const badgeFg = job.fileType === "achat" ? "#93c5fd"
    : job.fileType === "vente" ? "#6ee7b7"
    : "#d8b4fe";
  const badge = `<span style="
    font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;
    padding:1px 6px;border-radius:4px;flex-shrink:0;
    background:${badgeBg};
    color:${badgeFg};
  ">${label}</span>`;

  if (job.state === "queued") {
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;opacity:0.7">
        ${HOURGLASS} ${badge}
        <span style="font-size:12px;font-weight:400;color:#94a3b8">En attente...</span>
      </div>`;
  }

  if (job.state === "uploading") {
    const hasChunks = (job.total ?? 0) > 1;
    const text = hasChunks ? `Lot ${job.current}/${job.total}` : "Import en cours";
    const pct = hasChunks ? Math.round((job.current! / job.total!) * 100) : 0;
    return `
      <div style="padding:6px 0" data-job-id="${job.id}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          ${SPINNER} ${badge}
          <span data-label style="flex:1;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${text}…</span>
          <span data-pct style="color:#94a3b8;font-size:11px;flex-shrink:0">${pct}%</span>
        </div>
        <div style="width:100%;height:5px;background:rgba(255,255,255,0.1);border-radius:99px;overflow:hidden">
          <div data-fill style="height:100%;background:#14b8a6;border-radius:99px;width:${pct}%;transition:width .35s ease"></div>
        </div>
      </div>`;
  }

  if (job.state === "success") {
    const section = job.fileType === "achat" ? "les achats" : job.fileType === "vente" ? "les ventes" : "le stock";
    const path = job.fileType === "achat" ? "/achat" : job.fileType === "vente" ? "/ventes" : "/stock";
    const skipped = (job.skipped ?? 0) > 0
      ? ` · <span style="color:#94a3b8">${job.skipped} doublon(s)</span>` : "";
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0">
        ${DOT("#22c55e")} ${badge}
        <span style="font-size:12px;font-weight:400;flex:1">
          <strong>${job.inserted ?? 0}</strong> ligne(s) dans ${section}${skipped}
        </span>
        <a data-view-path="${path}" style="color:#14b8a6;cursor:pointer;font-size:11px;flex-shrink:0;text-decoration:underline">Voir →</a>
      </div>`;
  }

  if (job.state === "cancelled") {
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 0;opacity:0.7">
        ${DOT("#f59e0b")} ${badge}
        <span style="font-size:12px;font-weight:400;color:#94a3b8">Annulé${(job.inserted ?? 0) > 0 ? ` (${job.inserted} importé(s))` : ""}</span>
      </div>`;
  }

  // error
  return `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0">
      ${DOT("#ef4444")} ${badge}
      <span style="font-size:12px;font-weight:400;color:#f87171">${job.error ?? "Erreur"}</span>
    </div>`;
}

function _getOrCreate(config: BannerConfig): HTMLElement {
  let el = document.getElementById(BANNER_ID);
  if (el) return el;

  el = document.createElement("div");
  el.id = BANNER_ID;
  el.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:2147483647;
    background:#0f172a;color:#f1f5f9;border-radius:12px;
    padding:12px 16px;
    font:600 13px/1.5 system-ui,sans-serif;
    box-shadow:0 8px 24px rgba(0,0,0,0.4);
    width:300px;border:1px solid rgba(20,184,166,0.35);
    pointer-events:auto;animation:__apcm-up .3s ease;
  `;

  el.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.id === "__apcm-x") {
      el!.style.transition = "opacity .3s";
      el!.style.opacity = "0";
      setTimeout(() => el!.remove(), 300);
    } else if (target.id === "__apcm-cancel") {
      chrome.storage.local.set({ [CANCEL_UPLOAD_KEY]: true });
      (target as HTMLButtonElement).disabled = true;
      target.textContent = "Annulation…";
    } else if (target.dataset.viewPath) {
      config.onViewData(target.dataset.viewPath);
      el!.remove();
    }
  });

  document.body.appendChild(el);
  return el;
}

export function showUploadBanner(jobs: UploadJob[], config: BannerConfig): void {
  if (!jobs.length) return;
  _ensureStyles();

  const el = _getOrCreate(config);

  // Check if we can do a smooth update (only progress changed on the active job)
  const activeJob = jobs.find((j) => j.state === "uploading");
  if (activeJob) {
    const jobEl = el.querySelector(`[data-job-id="${activeJob.id}"]`);
    if (jobEl) {
      const labelEl = jobEl.querySelector<HTMLElement>("[data-label]");
      const pctEl = jobEl.querySelector<HTMLElement>("[data-pct]");
      const fillEl = jobEl.querySelector<HTMLElement>("[data-fill]");
      if (labelEl && pctEl && fillEl) {
        const hasChunks = (activeJob.total ?? 0) > 1;
        const text = hasChunks ? `Lot ${activeJob.current}/${activeJob.total}` : "Import en cours";
        const pct = hasChunks ? Math.round((activeJob.current! / activeJob.total!) * 100) : 0;
        labelEl.textContent = `${text}…`;
        pctEl.textContent = `${pct}%`;
        fillEl.style.width = `${pct}%`;
        return;
      }
    }
  }

  // Full re-render
  const hasActiveOrQueued = jobs.some((j) => j.state === "uploading" || j.state === "queued");
  const closeBtn = `<button id="__apcm-x" aria-label="Fermer" style="
    position:absolute;top:8px;right:10px;background:none;border:none;
    color:#94a3b8;cursor:pointer;font-size:14px;line-height:1;padding:2px 4px;border-radius:4px
  ">×</button>`;

  const cancelBtn = hasActiveOrQueued ? `
    <div style="border-top:1px solid rgba(255,255,255,0.08);margin-top:6px;padding-top:8px">
      <button id="__apcm-cancel" style="
        width:100%;padding:5px 0;font-size:11px;font-weight:600;
        background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);
        color:#f87171;border-radius:6px;cursor:pointer;
      ">Annuler tout</button>
    </div>` : "";

  const jobsHtml = jobs.map((j) => _renderJob(j /*, config*/)).join(
    '<div style="border-top:1px solid rgba(255,255,255,0.06)"></div>'
  );

  el.innerHTML = `${closeBtn}<div style="padding-right:16px">${jobsHtml}</div>${cancelBtn}`;

  // Auto-hide if all jobs are done (no active/queued)
  if (!hasActiveOrQueued) {
    let t = setTimeout(() => {
      el.style.transition = "opacity .4s";
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 500);
    }, 12_000);
    el.addEventListener("mouseenter", () => clearTimeout(t));
    el.addEventListener("mouseleave", () => {
      t = setTimeout(() => {
        el.style.transition = "opacity .4s";
        el.style.opacity = "0";
        setTimeout(() => el.remove(), 500);
      }, 12_000);
    });
  }
}

// Clean up completed jobs older than 60 seconds
export function cleanOldJobs(jobs: UploadJob[]): UploadJob[] {
  const now = Date.now();
  return jobs.filter((j) =>
    j.state === "uploading" || j.state === "queued" || (now - j.timestamp < 60_000)
  );
}
