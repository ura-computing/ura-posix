/** The PharmaGest app (VITE_FRONTEND_URL, read at build time). */
const FRONTEND_URL = (import.meta.env.VITE_FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

export const appUrl = (path: string) => `${FRONTEND_URL}${path}`;

/** Opens a page of the app in a new tab: `openApp("/imports")` (popup; a content script uses `appUrl`). */
export const openApp = (path: string) => chrome.tabs.create({ url: appUrl(path) });
