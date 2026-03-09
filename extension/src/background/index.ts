import { ACTIONS, DASHBOARD_URL } from "../constants";
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
    clearToken().then(() => {
      sendResponse({ success: true });
      // Notify any open dashboard tabs so they log out too
      chrome.tabs.query({ url: `${DASHBOARD_URL}/*` }, (tabs) => {
        tabs.forEach(t => {
          if (t.id) chrome.tabs.sendMessage(t.id, { type: "APCM_FORCE_LOGOUT" });
        });
      });
    });
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

});

console.log("[Background] Ready");
