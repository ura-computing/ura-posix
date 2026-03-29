/**
 * Shared upload progress banner — injected into both the dashboard and Sobrus pages.
 *
 * Usage:
 *   showUploadBanner(status, { onViewData: (path) => ... });
 *
 * The only caller-supplied difference is onViewData:
 *   – dashboard  → window.location.href = path
 *   – Sobrus     → chrome.tabs.create({ url: DASHBOARD_URL + path })
 */

import { CANCEL_UPLOAD_KEY } from "../constants";

export type UploadStatus = {
  state: "uploading" | "success" | "error" | "cancelled";
  fileType?: "achat" | "vente";
  current?: number;
  total?: number;
  inserted?: number;
  skipped?: number;
  error?: string;
  timestamp?: number;
};

export type BannerConfig = {
  onViewData: (path: string) => void;
};

// ── Shared HTML helpers ───────────────────────────────────────────────────────

const BANNER_ID = "__apcm-upload-banner";

const CLOSE = `<button id="__apcm-x" aria-label="Fermer" style="
  position:absolute;top:7px;right:8px;background:none;border:none;
  color:#94a3b8;cursor:pointer;font-size:17px;line-height:1;padding:2px 5px;border-radius:4px
">×</button>`;

const SPINNER = `<span style="
  width:18px;height:18px;border-radius:50%;flex-shrink:0;
  border:2.5px solid rgba(20,184,166,0.3);border-top-color:#14b8a6;
  animation:__apcm-spin 0.7s linear infinite;display:inline-block
"></span>`;

const DOT = (c: string) => `<span style="
  width:8px;height:8px;border-radius:50%;flex-shrink:0;
  background:${c};display:inline-block;margin-top:3px
"></span>`;

// ── Keyframes (injected once per page) ───────────────────────────────────────

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

// ── Banner element (created once, reused across state changes) ────────────────

function _getOrCreate(config: BannerConfig): HTMLElement {
  let el = document.getElementById(BANNER_ID);
  if (el) return el;

  el = document.createElement("div");
  el.id = BANNER_ID;
  el.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:2147483647;
    background:#0f172a;color:#f1f5f9;border-radius:12px;
    padding:18px 48px 18px 22px;
    font:600 14px/1.5 system-ui,sans-serif;
    box-shadow:0 8px 24px rgba(0,0,0,0.4);
    max-width:400px;border:1px solid rgba(20,184,166,0.35);
    pointer-events:auto;animation:__apcm-up .3s ease;
  `;

  // Event delegation — survives innerHTML replacements
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
    } else if (target.id === "__apcm-link") {
      const path = target.dataset.path ?? "/";
      config.onViewData(path);
      el!.remove();
    }
  });

  document.body.appendChild(el);
  return el;
}

function _hide(el: HTMLElement, delay: number) {
  setTimeout(() => {
    el.style.transition = "opacity .4s";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 500);
  }, delay);
}

// ── Main export ───────────────────────────────────────────────────────────────

export function showUploadBanner(status: UploadStatus, config: BannerConfig): void {
  _ensureStyles();

  const section = status.fileType === "achat" ? "les achats" : "les ventes";
  const path    = status.fileType === "achat" ? "/achat"      : "/ventes";

  if (status.state === "uploading") {
    const hasChunks = (status.total ?? 0) > 1;
    const label = hasChunks ? `Lot ${status.current}/${status.total}` : "Import en cours";
    const pct   = hasChunks ? Math.round((status.current! / status.total!) * 100) : null;

    const el = _getOrCreate(config);

    // Smooth update — avoid re-rendering the full card on every chunk tick
    const existingFill  = el.querySelector<HTMLElement>("#__apcm-fill");
    const existingLabel = el.querySelector<HTMLElement>("#__apcm-label");
    if (existingLabel) {
      existingLabel.textContent = `${label}…`;
      if (existingFill && pct !== null) existingFill.style.width = `${pct}%`;
      return;
    }

    el.innerHTML = `
      ${CLOSE}
      <div style="width:100%">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:${pct !== null ? "12px" : "0"}">
          ${SPINNER}
          <span id="__apcm-label">${label}…</span>
        </div>
        ${pct !== null ? `
        <div style="width:100%;height:8px;background:rgba(255,255,255,0.12);border-radius:99px;overflow:hidden;margin-bottom:12px">
          <div id="__apcm-fill" style="height:100%;background:#14b8a6;border-radius:99px;width:${pct}%;transition:width .35s ease"></div>
        </div>` : ""}
        <button id="__apcm-cancel" style="
          width:100%;padding:8px 0;font-size:12px;font-weight:600;
          background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);
          color:#f87171;border-radius:6px;cursor:pointer;
        ">Annuler l'import</button>
      </div>`;

  } else if (status.state === "success") {
    const el = _getOrCreate(config);
    const skippedNote = (status.skipped ?? 0) > 0
      ? `<br><span style="color:#94a3b8;font-weight:400">${status.skipped} doublon(s) ignoré(s)</span>`
      : "";
    el.innerHTML = `
      ${CLOSE}
      <div style="display:flex;align-items:flex-start;gap:8px">
        ${DOT("#22c55e")}
        <span>
          <strong>${status.inserted ?? 0}</strong> ligne(s) importée(s) dans ${section}.${skippedNote}<br>
          <a id="__apcm-link" data-path="${path}" style="color:#14b8a6;cursor:pointer;text-decoration:underline;font-weight:400">
            Voir les données →
          </a>
        </span>
      </div>`;
    let t = setTimeout(() => _hide(el, 0), 12_000);
    el.addEventListener("mouseenter", () => clearTimeout(t));
    el.addEventListener("mouseleave", () => { t = setTimeout(() => _hide(el, 0), 12_000); });

  } else if (status.state === "cancelled") {
    const el = _getOrCreate(config);
    const note = (status.inserted ?? 0) > 0
      ? `<br><span style="color:#94a3b8;font-weight:400">${status.inserted} ligne(s) déjà importée(s)</span>`
      : "";
    el.innerHTML = `
      ${CLOSE}
      <div style="display:flex;align-items:flex-start;gap:8px">
        ${DOT("#f59e0b")}
        <span>Import annulé.${note}</span>
      </div>`;
    _hide(el, 6_000);

  } else {
    const el = _getOrCreate(config);
    el.innerHTML = `
      ${CLOSE}
      <div style="display:flex;align-items:center;gap:8px">
        ${DOT("#ef4444")}
        <span style="font-weight:400">${status.error ?? "Import échoué"}</span>
      </div>`;
    _hide(el, 8_000);
  }
}
