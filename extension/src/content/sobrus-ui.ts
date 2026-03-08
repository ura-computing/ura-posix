/**
 * ISOLATED WORLD content script — Sobrus export pages.
 *
 * Shows a status banner (bottom-right). Reads upload state from
 * chrome.storage.local so it stays in sync with the dashboard banner.
 */

import { DASHBOARD_URL, TOKEN_STORAGE_KEY, UPLOAD_STATUS_KEY } from "../constants";

const fileType: "achat" | "vente" = window.location.pathname.includes("exportpurchases")
  ? "achat"
  : "vente";

const style = document.createElement("style");
style.textContent = `@keyframes __apcm-spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(style);

// ── Banner ────────────────────────────────────────────────────────────────────

const BANNER_ID = "__apcm-pharma-banner";

const CLOSE_BTN = `<button id="__apcm-x" aria-label="Fermer" style="
  position:absolute;top:7px;right:8px;background:none;border:none;
  color:#94a3b8;cursor:pointer;font-size:17px;line-height:1;
  padding:2px 5px;border-radius:4px;
">×</button>`;

const DOT = (color: string) =>
  `<span style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${color};display:inline-block"></span>`;

const SPINNER = `<span style="
  width:14px;height:14px;border-radius:50%;flex-shrink:0;
  border:2px solid rgba(20,184,166,0.3);border-top-color:#14b8a6;
  animation:__apcm-spin 0.7s linear infinite;display:inline-block
"></span>`;

function getBanner(): HTMLElement {
  let el = document.getElementById(BANNER_ID);
  if (el) return el;

  el = document.createElement("div");
  el.id = BANNER_ID;
  el.style.cssText = `
    position:fixed;bottom:20px;right:20px;z-index:2147483647;
    background:#0f172a;color:#f1f5f9;
    border-radius:12px;padding:10px 40px 10px 16px;
    font:600 13px/1.5 system-ui,sans-serif;
    box-shadow:0 8px 24px rgba(0,0,0,0.4);
    display:flex;align-items:center;gap:8px;
    max-width:320px;transition:opacity 0.4s;
    border:1px solid rgba(20,184,166,0.35);
    pointer-events:auto;
  `;

  // Close button via event delegation (survives innerHTML replacements)
  el.addEventListener("click", (e) => {
    if ((e.target as HTMLElement).id === "__apcm-x") {
      el!.style.opacity = "0";
      setTimeout(() => el!.remove(), 400);
    }
  });

  document.body.appendChild(el);
  return el;
}

function hideBanner(delay = 0) {
  const el = document.getElementById(BANNER_ID);
  if (!el) return;
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 500);
  }, delay);
}

function setBanner(state: "idle" | "no-auth" | "uploading" | "success" | "error", detail = "") {
  const el = getBanner();

  switch (state) {
    case "idle":
      el.innerHTML = `${DOT("#14b8a6")} APCM Pharma actif`;
      break;

    case "no-auth":
      el.innerHTML = `
        ${CLOSE_BTN}
        ${DOT("#f59e0b")}
        <span>
          Non connecté à APCM.<br>
          <a id="__apcm-login" style="color:#14b8a6;cursor:pointer;text-decoration:underline;font-weight:400">
            Se connecter →
          </a>
        </span>`;
      el.querySelector("#__apcm-login")?.addEventListener("click", () =>
        chrome.tabs.create({ url: `${DASHBOARD_URL}/login` })
      );
      break;

    case "uploading": {
      const p = detail ? detail.split("/") : null;
      const hasChunks = p && p[1] !== "1";
      const label = hasChunks ? `Lot ${p![0]}/${p![1]}` : "Import en cours";
      const pct = hasChunks ? Math.round((parseInt(p![0]) / parseInt(p![1])) * 100) : null;

      // Smooth update of existing bar
      const existingFill = el.querySelector<HTMLElement>("#__apcm-fill");
      const existingLabel = el.querySelector<HTMLElement>("#__apcm-label");
      if (existingFill && existingLabel && pct !== null) {
        existingFill.style.width = `${pct}%`;
        existingLabel.textContent = `${label}…`;
        break;
      }

      el.innerHTML = `
        ${CLOSE_BTN}
        <div style="width:100%">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:${pct !== null ? "7px" : "0"}">
            ${SPINNER}
            <span id="__apcm-label">${label}…</span>
          </div>
          ${pct !== null ? `
          <div style="width:100%;height:3px;background:rgba(255,255,255,0.12);border-radius:2px;overflow:hidden">
            <div id="__apcm-fill" style="height:100%;background:#14b8a6;border-radius:2px;width:${pct}%;transition:width .35s ease"></div>
          </div>` : ""}
        </div>`;
      break;
    }

    case "success": {
      const section = fileType === "achat" ? "les achats" : "les ventes";
      const path = fileType === "achat" ? "/achat" : "/ventes";
      const [inserted, skipped] = detail.split("|");
      const skippedNote = Number(skipped) > 0
        ? `<br><span style="color:#94a3b8;font-weight:400">${skipped} doublon(s) ignoré(s)</span>`
        : "";
      el.innerHTML = `
        ${CLOSE_BTN}
        ${DOT("#22c55e")}
        <span>
          <strong>${inserted}</strong> ligne(s) importée(s) dans ${section}.${skippedNote}<br>
          <a id="__apcm-open" style="color:#14b8a6;cursor:pointer;text-decoration:underline;font-weight:400">
            Ouvrir le tableau de bord →
          </a>
        </span>`;
      el.querySelector("#__apcm-open")?.addEventListener("click", () =>
        chrome.tabs.create({ url: `${DASHBOARD_URL}${path}` })
      );
      hideBanner(12_000);
      break;
    }

    case "error":
      el.innerHTML = `
        ${CLOSE_BTN}
        ${DOT("#ef4444")}
        <span style="font-weight:400">${detail || "Import échoué"}</span>`;
      setTimeout(() => setBanner("idle"), 8_000);
      break;
  }
}

// ── Init: show idle or no-auth ────────────────────────────────────────────────

chrome.storage.local.get(TOKEN_STORAGE_KEY, (result) => {
  const token = result[TOKEN_STORAGE_KEY] ?? null;
  setBanner(token ? "idle" : "no-auth");
});

// ── Listen to upload status changes in chrome.storage ────────────────────────

type UploadStatus = {
  state: "uploading" | "success" | "error";
  current?: number;
  total?: number;
  inserted?: number;
  skipped?: number;
  error?: string;
};

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[UPLOAD_STATUS_KEY]) return;
  const status = changes[UPLOAD_STATUS_KEY].newValue as UploadStatus | undefined;
  if (!status) return;

  if (status.state === "uploading") {
    const detail = (status.total ?? 0) > 1 ? `${status.current}/${status.total}` : "";
    setBanner("uploading", detail);
  } else if (status.state === "success") {
    setBanner("success", `${status.inserted ?? 0}|${status.skipped ?? 0}`);
  } else if (status.state === "error") {
    setBanner("error", status.error ?? "Erreur");
  }
});

// If page loaded while an upload was already in progress, show it
chrome.storage.local.get(UPLOAD_STATUS_KEY, (res) => {
  const status = res[UPLOAD_STATUS_KEY] as UploadStatus | undefined;
  if (status?.state === "uploading") {
    const detail = (status.total ?? 0) > 1 ? `${status.current}/${status.total}` : "";
    setBanner("uploading", detail);
  }
});
