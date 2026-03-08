import { DASHBOARD_URL } from "../constants";

export async function openOrFocusDashboard(path: string): Promise<void> {
  const targetUrl = `${DASHBOARD_URL}${path}`;
  const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
    chrome.tabs.query({ url: `${DASHBOARD_URL}/*` }, resolve);
  });
  const existing = tabs.find((t) => t.url?.startsWith(DASHBOARD_URL));
  if (existing?.id) {
    chrome.tabs.update(existing.id, { url: targetUrl, active: true });
    if (existing.windowId) chrome.windows.update(existing.windowId, { focused: true });
  } else {
    chrome.tabs.create({ url: targetUrl });
  }
}
