console.log("[Content Script] Loaded");

// ─── Auth token relay ─────────────────────────────────────────────────────────
// After the user logs into the dashboard, authProvider posts this message.
// We catch it here and forward the token to the background for storage.
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type === "APCM_AUTH_TOKEN" && event.data?.token) {
    chrome.runtime.sendMessage({ action: "STORE_TOKEN", token: event.data.token });
  }
});

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
