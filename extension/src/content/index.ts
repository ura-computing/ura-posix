console.log("[Content Script] Loaded");

// ─── Auth token relay ─────────────────────────────────────────────────────────
// 1. On every load: if localStorage already has the token (user was previously
//    logged in), sync it immediately. Covers reinstalls / storage wipes.
const _storedToken = localStorage.getItem("pharmagest_token");
if (_storedToken) {
  chrome.runtime.sendMessage({ action: "STORE_TOKEN", token: _storedToken });
}

// 2. After login/register: authProvider fires this message — store the new token.
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type === "APCM_AUTH_TOKEN" && event.data?.token) {
    chrome.runtime.sendMessage({ action: "STORE_TOKEN", token: event.data.token });
  }
});

// ─── Notifications relay (dashboard only) ────────────────────────────────────

const NOTIF_KEY = "apcm_notifications";
const UPLOAD_STATUS_KEY = "apcm_upload_status";

type NotifEntry = { id: string; fileType: string; inserted: number; skipped: number; read: boolean; timestamp: number };

type UploadStatus = {
  state: "uploading" | "success" | "error";
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

if (window.location.origin === "http://localhost:5173") {
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

// ─── DOM table extraction ─────────────────────────────────────────────────────

interface TableData {
  headers: string[];
  rows: Record<string, string>[];
}

function extractTableInRect(rect: { left: number; top: number; width: number; height: number }): TableData | null {
  const tables = Array.from(document.querySelectorAll<HTMLTableElement>("table"));

  // Find the table whose bounding box overlaps most with the drawn selection
  let best: HTMLTableElement | null = null;
  let bestOverlap = 0;

  for (const table of tables) {
    const b = table.getBoundingClientRect();
    const ox = Math.max(0, Math.min(b.right, rect.left + rect.width) - Math.max(b.left, rect.left));
    const oy = Math.max(0, Math.min(b.bottom, rect.top + rect.height) - Math.max(b.top, rect.top));
    const overlap = ox * oy;
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = table;
    }
  }

  if (!best || bestOverlap === 0) return null;

  const allRows = Array.from(best.querySelectorAll<HTMLTableRowElement>("tr"));
  if (allRows.length < 2) return null;

  // Determine header row: prefer <thead> rows, otherwise first <tr>
  const theadRows = Array.from(best.querySelectorAll<HTMLTableRowElement>("thead tr"));
  const headerRow = theadRows.length > 0 ? theadRows[0] : allRows[0];
  const headers = Array.from(headerRow.querySelectorAll("th, td")).map((c) => c.textContent?.trim() ?? "");

  if (headers.length === 0) return null;

  // Data rows = everything that isn't a header row
  const headerRowSet = new Set(theadRows.length > 0 ? theadRows : [allRows[0]]);
  const dataRows = allRows.filter((r) => !headerRowSet.has(r));

  const rows: Record<string, string>[] = dataRows.map((tr) => {
    const cells = Array.from(tr.querySelectorAll("td, th")).map((c) => c.textContent?.trim() ?? "");
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = cells[i] ?? "";
    });
    return obj;
  }).filter((r) => Object.values(r).some((v) => v !== ""));

  return { headers, rows };
}

// ─── Area selection + extraction ─────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log("[Content Script] Message received:", request);

  if (request.action === "SELECT_AND_CAPTURE") {
    console.log("[Content Script] Starting area selection");

    // Remove any stale overlay
    document.getElementById("__capture-overlay")?.remove();
    document.getElementById("__capture-selection")?.remove();
    document.getElementById("__capture-btn")?.remove();
    document.getElementById("__capture-cancel")?.remove();

    // ── Overlay ──
    const overlay = document.createElement("div");
    overlay.id = "__capture-overlay";
    overlay.style.cssText = `
      position: fixed; inset: 0; z-index: 2147483646;
      cursor: crosshair; background: rgba(0,0,0,0.30);
    `;

    // ── Selection rectangle ──
    const selection = document.createElement("div");
    selection.id = "__capture-selection";
    selection.style.cssText = `
      position: fixed; border: 2px solid #14b8a6;
      background: rgba(20,184,166,0.12); pointer-events: none;
      display: none; z-index: 2147483647;
    `;

    // ── Instruction label ──
    const label = document.createElement("div");
    label.style.cssText = `
      position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
      z-index: 2147483648; background: #0f172a; color: #fff;
      padding: 6px 16px; border-radius: 20px; font: 13px/1.5 system-ui;
      pointer-events: none;
    `;
    label.textContent = "Sélectionnez la zone du tableau";

    // ── Extract button ──
    const processBtn = document.createElement("button");
    processBtn.id = "__capture-btn";
    processBtn.textContent = "Extraire les données";
    processBtn.style.cssText = `
      position: fixed; z-index: 2147483648; display: none;
      background: #14b8a6; color: #fff; border: none;
      border-radius: 8px; padding: 9px 20px;
      font: 600 13px/1 system-ui; cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    `;

    // ── Cancel button ──
    const cancelBtn = document.createElement("button");
    cancelBtn.id = "__capture-cancel";
    cancelBtn.textContent = "Annuler";
    cancelBtn.style.cssText = `
      position: fixed; top: 12px; right: 12px; z-index: 2147483648;
      background: #1e293b; color: #fff; border: none;
      border-radius: 8px; padding: 7px 14px;
      font: 13px/1 system-ui; cursor: pointer;
    `;

    document.body.append(overlay, selection, label, processBtn, cancelBtn);

    let startX = 0, startY = 0, dragging = false;
    let finalRect: { left: number; top: number; width: number; height: number } | null = null;

    const cleanup = () => {
      overlay.remove(); selection.remove(); label.remove();
      processBtn.remove(); cancelBtn.remove();
    };

    cancelBtn.addEventListener("click", () => {
      cleanup();
      sendResponse({ success: false, error: "Annulé par l'utilisateur" });
    });

    const getRect = (x1: number, y1: number, x2: number, y2: number) => ({
      left: Math.min(x1, x2),
      top: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    });

    overlay.addEventListener("mousedown", (e) => {
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      selection.style.display = "block";
      selection.style.left = `${startX}px`;
      selection.style.top = `${startY}px`;
      selection.style.width = "0px";
      selection.style.height = "0px";
      processBtn.style.display = "none";
    });

    overlay.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const r = getRect(startX, startY, e.clientX, e.clientY);
      selection.style.left = `${r.left}px`;
      selection.style.top = `${r.top}px`;
      selection.style.width = `${r.width}px`;
      selection.style.height = `${r.height}px`;
    });

    overlay.addEventListener("mouseup", (e) => {
      if (!dragging) return;
      dragging = false;
      const r = getRect(startX, startY, e.clientX, e.clientY);
      if (r.width < 20 || r.height < 20) { selection.style.display = "none"; return; }
      finalRect = r;

      const btnTop = r.top + r.height + 12;
      const btnLeft = r.left + r.width / 2;
      processBtn.style.display = "block";
      processBtn.style.top = `${Math.min(btnTop, window.innerHeight - 56)}px`;
      processBtn.style.left = `${btnLeft}px`;
      processBtn.style.transform = "translateX(-50%)";
    });

    processBtn.addEventListener("click", () => {
      if (!finalRect) return;
      const data = extractTableInRect(finalRect);
      cleanup();
      if (!data || data.rows.length === 0) {
        sendResponse({ success: false, error: "Aucun tableau trouvé dans la zone sélectionnée" });
      } else {
        sendResponse({ success: true, data });
      }
    });

    return true; // keep message channel open
  }
});

console.log("[Content Script] Ready");
