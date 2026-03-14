import { useEffect, useState } from "react";
import { UPLOAD_STATUS_KEY } from "../constants";

export type UploadStatus = {
  state: "uploading" | "success" | "error" | "cancelled";
  fileType: "achat" | "vente";
  current?: number;
  total?: number;
  inserted?: number;
  skipped?: number;
  error?: string;
  timestamp?: number;
} | null;

export function useUploadStatus() {
  const [status, setStatus] = useState<UploadStatus>(null);

  useEffect(() => {
    // Read initial status — only show if recent (< 60s)
    chrome.storage.local.get(UPLOAD_STATUS_KEY, (res) => {
      const s = res[UPLOAD_STATUS_KEY] as UploadStatus | undefined;
      if (s && s.timestamp && Date.now() - s.timestamp < 60_000) {
        setStatus(s);
      }
    });

    // Live updates
    const onChange = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area !== "local" || !(UPLOAD_STATUS_KEY in changes)) return;
      const s = changes[UPLOAD_STATUS_KEY].newValue as UploadStatus | undefined;
      setStatus(s ?? null);
    };

    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  return status;
}
