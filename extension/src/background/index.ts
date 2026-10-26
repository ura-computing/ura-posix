/** Service worker: receives the Sobrus files (content script), « Annuler » and « Importer tout
 *  l'historique » (popup). Backend calls run here: host permission on VITE_BACKEND_URL = no CORS, the
 *  session cookies are sent. */
import type { ExtensionMessage } from "@/types";
import { EXPORT_PAGES, FULL_EXPORT_KEY, type FullExport } from "@/utils/sobrusExport";

import { cancel, downloadFailed, enqueue, markInterrupted } from "./importer";

void markInterrupted();

chrome.runtime.onMessage.addListener((msg: ExtensionMessage, _sender, sendResponse) => {
  switch (msg.type) {
    case "IMPORT_CSV":
      void enqueue(msg.filename, msg.text).then((id) => sendResponse({ id }));
      return true; // answers later
    case "DOWNLOAD_FAILED":
      void downloadFailed(msg.filename);
      return false;
    case "CANCEL_IMPORT":
      void cancel(msg.id);
      return false;
    case "START_FULL_EXPORT": {
      // The content script of each export page reads this and does its kind (content/sobrus.ts).
      const state: FullExport = { kinds: EXPORT_PAGES.map((p) => p.kind), log: [], done: false };
      void chrome.storage.local
        .set({ [FULL_EXPORT_KEY]: state })
        .then(() => chrome.tabs.create({ url: EXPORT_PAGES[0].url }));
      return false;
    }
  }
});
