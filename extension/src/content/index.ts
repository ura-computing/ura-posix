import { ACTIONS, SOBRUS_HOSTNAME, INDICATOR_POSITION_KEY, DASHBOARD_URL, TOKEN_STORAGE_KEY } from "../constants";
import { showUploadBanner, cleanOldJobs } from "./uploadBanner";
import type { UploadJob } from "./sobrusExport";

function toJobs(raw: unknown): UploadJob[] {
  return Array.isArray(raw) ? raw : [];
}

console.log("[Content Script] Loaded");

// ─── Auth token relay ─────────────────────────────────────────────────────────
// 1. On every load: if sessionStorage already has the token (user is logged in),
//    sync it immediately to chrome.storage. Covers reinstalls / storage wipes.
function _send(msg: object) {
  try {
    if (chrome.runtime?.id) chrome.runtime.sendMessage(msg);
  } catch { /* extension context invalidated — silently ignore */ }
}

const _storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
if (_storedToken) {
  _send({ action: ACTIONS.STORE_TOKEN, token: _storedToken });
}

// 2. After login/register: authProvider fires APCM_AUTH_TOKEN — store the new token.
//    After logout: authProvider fires APCM_CLEAR_TOKEN — clear the token.
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type === "APCM_AUTH_TOKEN" && event.data?.token) {
    _send({ action: ACTIONS.STORE_TOKEN, token: event.data.token });
  }
  if (event.data?.type === "APCM_CLEAR_TOKEN") {
    _send({ action: ACTIONS.CLEAR_TOKEN });
  }
});

// 3. Background → content: force logout message relayed to the dashboard page.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "APCM_FORCE_LOGOUT") {
    window.postMessage({ type: "APCM_FORCE_LOGOUT" }, "*");
  }
});

// ─── Notifications relay (dashboard only) ────────────────────────────────────

const NOTIF_KEY = "apcm_notifications";
const UPLOAD_STATUS_KEY = "apcm_upload_status";

type NotifEntry = { id: string; fileType: string; inserted: number; skipped: number; read: boolean; timestamp: number };


function _postNotifications(notifications: unknown[]) {
  window.postMessage({ type: "APCM_NOTIFICATIONS", notifications }, "*");
}

const _bannerConfig = { onViewData: (path: string) => { window.location.href = path; } };

// ─────────────────────────────────────────────────────────────────────────────

if (window.location.origin === new URL(DASHBOARD_URL).origin) {
  // Initial load — send stored notifications to the React app
  chrome.storage.local.get(NOTIF_KEY, (res) => {
    const notifications = (res[NOTIF_KEY] as NotifEntry[] | undefined) ?? [];
    _postNotifications(notifications);
  });

  // Live updates
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[NOTIF_KEY]) {
      const next = (changes[NOTIF_KEY].newValue as NotifEntry[] | undefined) ?? [];
      _postNotifications(next);
    }
    if (changes[UPLOAD_STATUS_KEY]) {
      const jobs = toJobs(changes[UPLOAD_STATUS_KEY].newValue);
      if (jobs.length) showUploadBanner(cleanOldJobs(jobs), _bannerConfig);
    }
  });

  // Show upload banner on page load if jobs exist
  chrome.storage.local.get(UPLOAD_STATUS_KEY, (res) => {
    const jobs = toJobs(res[UPLOAD_STATUS_KEY]);
    if (jobs.length) {
      const active = cleanOldJobs(jobs);
      if (active.length) showUploadBanner(active, _bannerConfig);
    }
  });

  // Handle messages from React app
  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const { type, id } = (event.data ?? {}) as { type?: string; id?: string };

    if (type === "APCM_REQUEST_NOTIFICATIONS") {
      chrome.storage.local.get(NOTIF_KEY, (res) => _postNotifications((res[NOTIF_KEY] as NotifEntry[] | undefined) ?? []));
    }
    if (type === "APCM_CLEAR_NOTIFICATIONS") {
      chrome.storage.local.set({ [NOTIF_KEY]: [] });
    }
    if (type === "APCM_DISMISS_NOTIFICATION" && id) {
      chrome.storage.local.get(NOTIF_KEY, (res) => {
        const filtered = ((res[NOTIF_KEY] as NotifEntry[] | undefined) ?? []).filter((n) => n.id !== id);
        chrome.storage.local.set({ [NOTIF_KEY]: filtered });
      });
    }
    if (type === "APCM_MARK_ALL_READ") {
      chrome.storage.local.get(NOTIF_KEY, (res) => {
        const updated = ((res[NOTIF_KEY] as NotifEntry[] | undefined) ?? []).map((n) => ({ ...n, read: true }));
        chrome.storage.local.set({ [NOTIF_KEY]: updated });
      });
    }
  });
}

// ─── Sobrus Indicator (Draggable widget) ─────────────────────────────────

function _initSobrusIndicator() {
  if (!window.location.hostname.includes(SOBRUS_HOSTNAME)) return;
  // Badge shows on ALL Sobrus pages — export pages also get the badge (sobrus-ui.ts handles upload progress separately)

  const INDICATOR_ID = "__apcm-sobrus-indicator";

  if (document.getElementById(INDICATOR_ID)) return;

  // ── Pulse animation ──
  if (!document.getElementById("__apcm-indicator-styles")) {
    const style = document.createElement("style");
    style.id = "__apcm-indicator-styles";
    style.textContent = `
      @keyframes __apcm_pulse {
        0%   { box-shadow: 0 0 0 0   rgba(20,184,166,0.6); }
        70%  { box-shadow: 0 0 0 6px rgba(20,184,166,0);   }
        100% { box-shadow: 0 0 0 0   rgba(20,184,166,0);   }
      }
    `;
    document.head.appendChild(style);
  }

  // ── Build widget ──
  const el = document.createElement("div");
  el.id = INDICATOR_ID;
  el.style.cssText = `
    position:fixed;bottom:16px;left:16px;z-index:2147483646;
    display:flex;align-items:center;gap:7px;
    padding:6px 12px 6px 8px;border-radius:10px;
    background:#0f172a;
    border:1px solid rgba(255,255,255,0.1);
    box-shadow:0 4px 16px rgba(0,0,0,0.45),0 0 0 0.5px rgba(255,255,255,0.06);
    font:500 11px/1.4 -apple-system,system-ui,sans-serif;
    color:#e2e8f0;
    backdrop-filter:blur(10px);
    -webkit-backdrop-filter:blur(10px);
  `;

  // APCM logo pill (like Next.js "N")
  const logo = document.createElement("div");
  logo.style.cssText = `
    width:18px;height:18px;border-radius:5px;
    background:#14b8a6;flex-shrink:0;
    display:flex;align-items:center;justify-content:center;
  `;
  logo.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="white"><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm6 4v4H8v2h4v4h2v-4h4v-2h-4V6h-2z"/></svg>`;

  const dot = document.createElement("div");
  dot.style.cssText = `
    width:7px;height:7px;border-radius:50%;flex-shrink:0;
    transition:background .3s;
  `;

  const label = document.createElement("span");
  label.style.cssText = `letter-spacing:0.01em;`;

  el.appendChild(logo);
  el.appendChild(dot);
  el.appendChild(label);
  document.body.appendChild(el);

  // ── Restore saved position ──
  chrome.storage.local.get([INDICATOR_POSITION_KEY], (res) => {
    const pos = res[INDICATOR_POSITION_KEY] as { left: number; top: number } | undefined;
    if (pos) {
      el.style.bottom = "";
      el.style.left = pos.left + "px";
      el.style.top  = pos.top  + "px";
    }
  });

  // ── Drag to reposition ──
  el.style.cursor = "grab";
  let _dragging = false, _ox = 0, _oy = 0;

  el.addEventListener("mousedown", (e) => {
    const r = el.getBoundingClientRect();
    el.style.bottom = "";
    el.style.top  = r.top  + "px";
    el.style.left = r.left + "px";
    _ox = e.clientX - r.left;
    _oy = e.clientY - r.top;
    _dragging = true;
    el.style.cursor = "grabbing";
    e.preventDefault();
  });
  document.addEventListener("mousemove", (e) => {
    if (!_dragging) return;
    el.style.left = (e.clientX - _ox) + "px";
    el.style.top  = (e.clientY - _oy) + "px";
  });
  document.addEventListener("mouseup", () => {
    if (!_dragging) return;
    _dragging = false;
    el.style.cursor = "grab";
    chrome.storage.local.set({
      [INDICATOR_POSITION_KEY]: { left: parseInt(el.style.left), top: parseInt(el.style.top) },
    });
  });

  // ── Update display based on connection ──
  function _setConnected(connected: boolean) {
    if (connected) {
      dot.style.background = "#14b8a6";
      dot.style.animation = "__apcm_pulse 2.5s ease-out infinite";
      label.textContent = "APCM Pharma";
      el.style.borderColor = "rgba(20,184,166,0.35)";
    } else {
      dot.style.background = "#ef4444";
      dot.style.animation = "none";
      dot.style.boxShadow = "none";
      label.textContent = "Non connecté";
      el.style.borderColor = "rgba(239,68,68,0.35)";
    }
  }

  // ── Fetch token from chrome.storage.local (not page localStorage) ──
  chrome.runtime.sendMessage({ action: "GET_TOKEN" }, (res) => {
    _setConnected(!!(res?.token));
  });

  // ── React to login / logout in real-time ──
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !(TOKEN_STORAGE_KEY in changes)) return;
    _setConnected(!!(changes[TOKEN_STORAGE_KEY].newValue));
  });

}

_initSobrusIndicator();

console.log("[Content Script] Ready");
