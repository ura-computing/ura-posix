import { ACTIONS } from "../constants";
import { uploadCsv } from "../lib/api";
import { addNotification, clearToken, getToken, setToken } from "../lib/storage";
import { openOrFocusDashboard } from "../lib/tabs";

console.log("[Background] Service Worker Started");

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log("[Background] Message received:", request.action);

  // ── Token storage ──────────────────────────────────────────────────────────
  if (request.action === ACTIONS.STORE_TOKEN) {
    setToken(request.token).then(() => sendResponse({ success: true }));
    return true;
  }

  if (request.action === ACTIONS.GET_TOKEN) {
    getToken().then((token) => sendResponse({ token }));
    return true;
  }

  if (request.action === ACTIONS.CLEAR_TOKEN) {
    clearToken().then(() => sendResponse({ success: true }));
    return true;
  }

  // ── Upload a single CSV chunk (background can reach localhost, content script cannot) ─
  if (request.action === ACTIONS.UPLOAD_CHUNK) {
    const { csvChunk, fileType } = request as { csvChunk: string; fileType: "achat" | "vente" };
    uploadCsv(fileType, csvChunk)
      .then((data) => sendResponse({ success: true, ...data }))
      .catch((err: Error) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  // ── Save notification after all chunks are done ────────────────────────────
  if (request.action === ACTIONS.SAVE_NOTIFICATION) {
    const { fileType, inserted, skipped } = request as {
      fileType: "achat" | "vente";
      inserted: number;
      skipped: number;
    };
    addNotification({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fileType,
      inserted,
      skipped,
      timestamp: Date.now(),
      read: false,
    }).then(() => openOrFocusDashboard(fileType === "achat" ? "/achat" : "/ventes"));
    return false; // no async response needed
  }

  // ── Area capture → relay to content script ─────────────────────────────────
  if (request.action === ACTIONS.START_AREA_CAPTURE) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        sendResponse({ success: false, error: "Aucun onglet actif trouvé" });
        return;
      }

      chrome.tabs.sendMessage(tab.id, { action: ACTIONS.SELECT_AND_CAPTURE }, (contentResponse) => {
        if (chrome.runtime.lastError) {
          console.error("[Background] Content script error:", chrome.runtime.lastError.message);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        sendResponse(contentResponse);
      });
    });
    return true;
  }
});

console.log("[Background] Ready");
