import { ACTIONS, TOKEN_STORAGE_KEY as TOKEN_KEY } from "../constants";

console.log("[Background] Service Worker Started");

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log("[Background] Message received:", request.action);

  // ── Token storage ──────────────────────────────────────────────────────────
  if (request.action === ACTIONS.STORE_TOKEN) {
    chrome.storage.local.set({ [TOKEN_KEY]: request.token }, () => {
      console.log("[Background] Token stored");
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === ACTIONS.GET_TOKEN) {
    chrome.storage.local.get(TOKEN_KEY, (result) => {
      sendResponse({ token: result[TOKEN_KEY] ?? null });
    });
    return true;
  }

  if (request.action === ACTIONS.CLEAR_TOKEN) {
    chrome.storage.local.remove(TOKEN_KEY, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // ── Area capture → relay to content script ─────────────────────────────────
  // Popup sends START_AREA_CAPTURE → background finds active tab →
  // sends SELECT_AND_CAPTURE to content script → relays result back to popup.
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
