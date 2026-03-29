/**
 * ISOLATED WORLD content script — Sobrus export pages.
 *
 * Delegates all banner rendering to the shared upload-banner module.
 * The only difference from the dashboard: success link opens a new tab.
 */

import { DASHBOARD_URL, UPLOAD_STATUS_KEY } from "../constants";
import { showUploadBanner, type UploadStatus } from "./upload-banner";

const _bannerConfig = {
  onViewData: (path: string) => {
    chrome.tabs.create({ url: `${DASHBOARD_URL}${path}` });
  },
};

// ── Listen to upload status changes ──────────────────────────────────────────

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[UPLOAD_STATUS_KEY]) return;
  const status = changes[UPLOAD_STATUS_KEY].newValue as UploadStatus | undefined;
  if (status) showUploadBanner(status, _bannerConfig);
});

// If the page loaded while an upload was already in progress, show it immediately
chrome.storage.local.get(UPLOAD_STATUS_KEY, (res) => {
  const status = res[UPLOAD_STATUS_KEY] as UploadStatus | undefined;
  if (status?.state === "uploading" || status?.state === "cancelled") {
    showUploadBanner(status, _bannerConfig);
  }
});
