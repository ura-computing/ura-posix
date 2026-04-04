/**
 * ISOLATED WORLD content script — Sobrus export pages.
 *
 * Delegates all banner rendering to the shared upload-banner module.
 * The only difference from the dashboard: success link opens a new tab.
 */

import { DASHBOARD_URL, UPLOAD_STATUS_KEY } from "../constants";
import { showUploadBanner, cleanOldJobs } from "./uploadBanner";
import type { UploadJob } from "./sobrusExport";

function toJobs(raw: unknown): UploadJob[] {
  return Array.isArray(raw) ? raw : [];
}

const _bannerConfig = {
  onViewData: (path: string) => {
    chrome.tabs.create({ url: `${DASHBOARD_URL}${path}` });
  },
};

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes[UPLOAD_STATUS_KEY]) return;
  const jobs = toJobs(changes[UPLOAD_STATUS_KEY].newValue);
  if (jobs.length) showUploadBanner(cleanOldJobs(jobs), _bannerConfig);
});

chrome.storage.local.get(UPLOAD_STATUS_KEY, (res) => {
  const raw = toJobs(res[UPLOAD_STATUS_KEY]);
  const jobs = cleanOldJobs(raw);
  if (jobs.length < raw.length) {
    chrome.storage.local.set({ [UPLOAD_STATUS_KEY]: jobs });
  }
  if (jobs.length) showUploadBanner(jobs, _bannerConfig);
});
