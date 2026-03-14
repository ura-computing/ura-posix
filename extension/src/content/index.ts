import { ACTIONS, SOBRUS_HOSTNAME, INDICATOR_POSITION_KEY, DASHBOARD_URL } from "../constants";

console.log("[Content Script] Loaded");

// ─── Auth token relay ─────────────────────────────────────────────────────────
// 1. On every load: if sessionStorage already has the token (user is logged in),
//    sync it immediately to chrome.storage. Covers reinstalls / storage wipes.
function _send(msg: object) {
  try {
    if (chrome.runtime?.id) chrome.runtime.sendMessage(msg);
  } catch { /* extension context invalidated — silently ignore */ }
}

const _storedToken = sessionStorage.getItem("pharmagest_token");
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

type UploadStatus = {
  state: "uploading" | "success" | "error" | "cancelled";
  fileType: "achat" | "vente";
  current?: number;
  total?: number;
  inserted?: number;
  skipped?: number;
  error?: string;
  timestamp?: number;
};

function _postNotifications(notifications: unknown[]) {
  window.postMessage({ type: "APCM_NOTIFICATIONS", notifications }, "*");
}

// ── Upload progress / success / error banner (same on Sobrus + dashboard) ────

function _showUploadBanner(status: UploadStatus) {
  const BANNER_ID = "__apcm-upload-banner";
  let el = document.getElementById(BANNER_ID);

  if (!document.getElementById("__apcm-dash-styles")) {
    const s = document.createElement("style");
    s.id = "__apcm-dash-styles";
    s.textContent = `
      @keyframes __apcm-spin { to { transform: rotate(360deg); } }
      @keyframes __apcm_up { from { opacity:0;transform:translateY(12px) } to { opacity:1;transform:none } }
    `;
    document.head.appendChild(s);
  }

  if (!el) {
    el = document.createElement("div");
    el.id = BANNER_ID;
    el.style.cssText = `
      position:fixed;bottom:24px;right:24px;z-index:2147483647;
      background:#0f172a;color:#f1f5f9;border-radius:12px;
      padding:10px 40px 10px 16px;
      font:600 13px/1.5 system-ui,sans-serif;
      box-shadow:0 8px 24px rgba(0,0,0,0.4);
      max-width:320px;border:1px solid rgba(20,184,166,0.35);
      pointer-events:auto;animation:__apcm_up .3s ease;
    `;
    el.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).id === "__apcm-x") {
        el!.style.transition = "opacity .3s";
        el!.style.opacity = "0";
        setTimeout(() => el!.remove(), 300);
      }
    });
    document.body.appendChild(el);
  }

  const CLOSE = `<button id="__apcm-x" aria-label="Fermer" style="
    position:absolute;top:7px;right:8px;background:none;border:none;
    color:#94a3b8;cursor:pointer;font-size:17px;line-height:1;padding:2px 5px;border-radius:4px
  ">×</button>`;
  const SPINNER = `<span style="width:14px;height:14px;border-radius:50%;flex-shrink:0;border:2px solid rgba(20,184,166,0.3);border-top-color:#14b8a6;animation:__apcm-spin 0.7s linear infinite;display:inline-block"></span>`;
  const DOT = (c: string) => `<span style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${c};display:inline-block;margin-top:3px"></span>`;

  const section = status.fileType === "achat" ? "les achats" : "les ventes";
  const path = status.fileType === "achat" ? "/achat" : "/ventes";

  if (status.state === "uploading") {
    const hasChunks = (status.total ?? 0) > 1;
    const label = hasChunks ? `Lot ${status.current}/${status.total}` : "Import en cours";
    const pct = hasChunks ? Math.round((status.current! / status.total!) * 100) : null;

    const existingFill = el.querySelector<HTMLElement>("#__apcm-fill");
    const existingLabel = el.querySelector<HTMLElement>("#__apcm-label");
    if (existingFill && existingLabel && pct !== null) {
      existingFill.style.width = `${pct}%`;
      existingLabel.textContent = `${label}…`;
      return;
    }

    el.innerHTML = `
      ${CLOSE}
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
  } else if (status.state === "success") {
    const skippedNote = (status.skipped ?? 0) > 0
      ? `<br><span style="color:#94a3b8;font-weight:400">${status.skipped} doublon(s) ignoré(s)</span>`
      : "";
    el.innerHTML = `
      ${CLOSE}
      <div style="display:flex;align-items:flex-start;gap:8px">
        ${DOT("#22c55e")}
        <span>
          <strong>${status.inserted ?? 0}</strong> ligne(s) importée(s) dans ${section}.${skippedNote}<br>
          <a id="__apcm-link" style="color:#14b8a6;cursor:pointer;text-decoration:underline;font-weight:400">Voir les données →</a>
        </span>
      </div>`;
    el.querySelector("#__apcm-link")?.addEventListener("click", () => {
      window.location.href = path;
      el!.remove();
    });
    const hide = () => {
      el!.style.transition = "opacity .4s";
      el!.style.opacity = "0";
      setTimeout(() => el!.remove(), 500);
    };
    let t = setTimeout(hide, 12_000);
    el.addEventListener("mouseenter", () => clearTimeout(t));
    el.addEventListener("mouseleave", () => { t = setTimeout(hide, 12_000); });
  } else if (status.state === "cancelled") {
    const note = (status.inserted ?? 0) > 0
      ? `<br><span style="color:#94a3b8;font-weight:400">${status.inserted} ligne(s) déjà importée(s)</span>`
      : "";
    el.innerHTML = `
      ${CLOSE}
      <div style="display:flex;align-items:flex-start;gap:8px">
        ${DOT("#f59e0b")}
        <span>Import annulé.${note}</span>
      </div>`;
    setTimeout(() => {
      el!.style.transition = "opacity .4s";
      el!.style.opacity = "0";
      setTimeout(() => el!.remove(), 500);
    }, 6_000);
  } else {
    el.innerHTML = `
      ${CLOSE}
      <div style="display:flex;align-items:center;gap:8px">
        ${DOT("#ef4444")}
        <span style="font-weight:400">${status.error ?? "Import échoué"}</span>
      </div>`;
    setTimeout(() => {
      el!.style.transition = "opacity .4s";
      el!.style.opacity = "0";
      setTimeout(() => el!.remove(), 500);
    }, 8_000);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function _showImportToast(n: { fileType: string; inserted: number; skipped: number }) {
  if (document.getElementById("__apcm-upload-banner")) return; // upload banner already visible
  const id = "__apcm-import-toast";
  document.getElementById(id)?.remove();

  const s = document.createElement("style");
  s.textContent = `@keyframes __apcm_in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`;
  document.head.appendChild(s);

  const el = document.createElement("div");
  el.id = id;
  el.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:2147483647;
    background:#0f172a;color:#f1f5f9;border-radius:12px;
    padding:10px 40px 10px 16px;
    font:600 13px/1.5 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,0.4);
    max-width:320px;border:1px solid rgba(20,184,166,0.35);
    display:flex;align-items:flex-start;gap:8px;
    animation:__apcm_in .3s ease;pointer-events:auto;
  `;

  const section = n.fileType === "achat" ? "les achats" : "les ventes";
  const path = n.fileType === "achat" ? "/achat" : "/ventes";
  const skippedNote = n.skipped > 0
    ? `<br><span style="color:#94a3b8;font-weight:400">${n.skipped} doublon(s) ignoré(s)</span>`
    : "";

  el.innerHTML = `
    <button id="__apcm-toast-close" aria-label="Fermer" style="
      position:absolute;top:7px;right:8px;background:none;border:none;
      color:#94a3b8;cursor:pointer;font-size:17px;line-height:1;padding:2px 5px;border-radius:4px
    ">×</button>
    <span style="width:8px;height:8px;border-radius:50%;background:#22c55e;flex-shrink:0;margin-top:4px;display:inline-block"></span>
    <span>
      <strong>${n.inserted}</strong> ligne(s) importée(s) dans ${section}.${skippedNote}<br>
      <a id="__apcm-toast-link" style="color:#14b8a6;cursor:pointer;text-decoration:underline;font-weight:400">
        Voir les données →
      </a>
    </span>
  `;

  document.body.appendChild(el);

  el.querySelector("#__apcm-toast-close")?.addEventListener("click", () => el.remove());
  el.querySelector("#__apcm-toast-link")?.addEventListener("click", () => {
    window.location.href = path;
    el.remove();
  });

  let hideTimer: ReturnType<typeof setTimeout>;
  const scheduleHide = () => {
    hideTimer = setTimeout(() => {
      el.style.transition = "opacity .4s";
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 500);
    }, 12_000);
  };
  scheduleHide();
  el.addEventListener("mouseenter", () => clearTimeout(hideTimer));
  el.addEventListener("mouseleave", scheduleHide);
}

if (window.location.origin === new URL(DASHBOARD_URL).origin) {
  // Initial load — send stored notifications to the React app
  // Also show toast for any very recent unread notification (covers the case where
  // the background saved a notification and then navigated to this tab — onChanged
  // won't fire because the save already happened before this script ran).
  let _prevLen = 0;
  chrome.storage.local.get(NOTIF_KEY, (res) => {
    const notifications = (res[NOTIF_KEY] as NotifEntry[] | undefined) ?? [];
    _postNotifications(notifications);
    _prevLen = notifications.length;
    const recent = notifications.find((n) => !n.read && Date.now() - n.timestamp < 30_000);
    if (recent) _showImportToast(recent);
  });

  // Live updates
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes[NOTIF_KEY]) {
      const next = (changes[NOTIF_KEY].newValue as NotifEntry[] | undefined) ?? [];
      _postNotifications(next);
      if (next.length > _prevLen) _showImportToast(next[0]);
      _prevLen = next.length;
    }
    if (changes[UPLOAD_STATUS_KEY]) {
      const status = changes[UPLOAD_STATUS_KEY].newValue as UploadStatus | undefined;
      if (status) _showUploadBanner(status);
    }
  });

  // Show upload banner on page load if an upload is in progress or just finished
  chrome.storage.local.get(UPLOAD_STATUS_KEY, (res) => {
    const status = res[UPLOAD_STATUS_KEY] as UploadStatus | undefined;
    if (status && status.timestamp && Date.now() - status.timestamp < 60_000) {
      _showUploadBanner(status);
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
    if (area !== "local" || !("pharmagest_token" in changes)) return;
    _setConnected(!!(changes["pharmagest_token"].newValue));
  });

}

_initSobrusIndicator();

console.log("[Content Script] Ready");
