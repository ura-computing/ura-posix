import { useEffect, useState } from "react";
import { UPLOAD_STATUS_KEY } from "../constants";
import type { UploadJob } from "../content/sobrusExport";

export function useUploadStatus() {
  const [jobs, setJobs] = useState<UploadJob[]>([]);

  useEffect(() => {
    chrome.storage.local.get(UPLOAD_STATUS_KEY, (res) => {
      const raw = res[UPLOAD_STATUS_KEY];
      if (Array.isArray(raw) && raw.length) setJobs(raw);
    });

    const onChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== "local" || !(UPLOAD_STATUS_KEY in changes)) return;
      const raw = changes[UPLOAD_STATUS_KEY].newValue;
      setJobs(Array.isArray(raw) ? raw : []);
    };

    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  const activeJob = jobs.find((j) => j.state === "uploading") ?? null;
  const hasActive = jobs.some((j) => j.state === "uploading" || j.state === "queued");

  return { jobs, activeJob, hasActive };
}
