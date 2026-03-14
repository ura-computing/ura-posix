/**
 * ISOLATED WORLD content script — Sobrus export pages.
 *
 * Intercepts the "Télécharger en CSV" anchor click, then:
 *  1. Fetches the CSV directly from Sobrus (session cookies included).
 *  2. Writes upload status to chrome.storage.local so BOTH this page
 *     and the dashboard can show real-time progress via their banners.
 *  3. Splits the CSV into chunks and sends each via UPLOAD_CHUNK to
 *     the background service worker (which can reach localhost:8000).
 *  4. Sends SAVE_NOTIFICATION when done.
 */

import { ACTIONS, CANCEL_UPLOAD_KEY, UPLOAD_STATUS_KEY } from "../constants";

const CHUNK_SIZE = 500;

/** Detect achat vs vente from the CSV header row — more reliable than URL matching. */
function detectFileType(headerLine: string): "achat" | "vente" {
  const h = headerLine.toLowerCase();
  if (
    h.includes("référence de livraison") ||
    h.includes("bon de livraison") ||
    h.includes("fournisseur")
  ) {
    return "achat";
  }
  return "vente";
}

function isExtensionAlive(): boolean {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

function sendMsg<T>(msg: object): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!isExtensionAlive()) {
      // Write error directly to storage so the banner shows immediately
      chrome.storage.local.set({
        [UPLOAD_STATUS_KEY]: { state: "error", error: "Extension rechargée — veuillez rafraîchir la page", timestamp: Date.now() },
      });
      reject(new Error("context_invalidated"));
      return;
    }
    try {
      chrome.runtime.sendMessage(msg, (res) => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve(res as T);
      });
    } catch (err) {
      reject(err);
    }
  });
}

let uploading = false;

document.addEventListener(
  "click",
  async (e) => {
    const anchor = (e.target as Element).closest<HTMLAnchorElement>(
      'a[download][href*="api.pharma.sobrus.com/reports/exports"]'
    );
    if (!anchor) return;
    if (uploading) return;
    handleExport(anchor.href).catch(() => {
      // All errors are already written to chrome.storage and shown as banners — nothing to do here
    });
  },
  true
);

async function handleExport(apiUrl: string) {
  uploading = true;

  // Placeholder status while we fetch (fileType unknown yet)
  chrome.storage.local.set({
    [UPLOAD_STATUS_KEY]: { state: "uploading", fileType: "achat", current: 0, total: 1, timestamp: Date.now() },
  });

  try {
    // ── 1. Fetch CSV from Sobrus ───────────────────────────────────────────
    let csvText: string;
    try {
      const res = await fetch(apiUrl, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      csvText = await res.text();
    } catch (err) {
      chrome.storage.local.set({
        [UPLOAD_STATUS_KEY]: { state: "error", error: `Téléchargement échoué: ${(err as Error).message}`, timestamp: Date.now() },
      });
      return;
    }

    // ── 2. Detect type from CSV headers ───────────────────────────────────
    const lines = csvText.split("\n");
    const header = lines[0];
    const fileType = detectFileType(header);
    const dataLines = lines.slice(1).filter((l) => l.trim() !== "");

    const setStatus = (state: string, extra: object = {}) => {
      chrome.storage.local.set({
        [UPLOAD_STATUS_KEY]: { state, fileType, timestamp: Date.now(), ...extra },
      });
    };

    if (dataLines.length === 0) {
      setStatus("error", { error: "Fichier CSV vide" });
      return;
    }

    const totalChunks = Math.ceil(dataLines.length / CHUNK_SIZE);
    let totalInserted = 0;
    let totalSkipped = 0;

    // ── 3. Send each chunk to background (background can reach localhost) ──
    for (let i = 0; i < dataLines.length; i += CHUNK_SIZE) {
      // Check if the user requested cancellation via the popup
      const cancelCheck = await new Promise<boolean>((resolve) => {
        chrome.storage.local.get(CANCEL_UPLOAD_KEY, (res) => resolve(!!(res[CANCEL_UPLOAD_KEY])));
      });
      if (cancelCheck) {
        chrome.storage.local.remove(CANCEL_UPLOAD_KEY);
        setStatus("cancelled", { inserted: totalInserted, skipped: totalSkipped });
        return;
      }

      const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
      setStatus("uploading", { current: chunkNum, total: totalChunks });

      const csvChunk = [header, ...dataLines.slice(i, i + CHUNK_SIZE)].join("\n");

      try {
        const res = await sendMsg<{ success: boolean; inserted?: number; skipped?: number; error?: string }>({
          action: ACTIONS.UPLOAD_CHUNK,
          csvChunk,
          fileType,
        });
        if (!res.success) throw new Error(res.error ?? "Erreur inconnue");
        totalInserted += res.inserted ?? 0;
        totalSkipped += res.skipped ?? 0;
      } catch (err) {
        setStatus("error", { error: (err as Error).message });
        return;
      }
    }

    // ── 4. Success ─────────────────────────────────────────────────────────
    setStatus("success", { inserted: totalInserted, skipped: totalSkipped });

    if (isExtensionAlive()) {
      chrome.runtime.sendMessage({
        action: ACTIONS.SAVE_NOTIFICATION,
        fileType,
        inserted: totalInserted,
        skipped: totalSkipped,
      });
    }
  } finally {
    uploading = false;
  }
}
