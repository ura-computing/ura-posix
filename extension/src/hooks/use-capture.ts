import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_URL, ENDPOINTS, QUERY_KEYS } from "../constants";

interface TableData {
  headers: string[];
  rows: Record<string, string>[];
}

type TableType = "achat" | "ventes";

interface CaptureAndUploadArgs {
  tableType: TableType;
  token: string;
}

interface CaptureAndUploadResult {
  inserted: number;
  tableType: TableType;
  preview: TableData;
}

function sendMsg<T>(msg: object): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(res as T);
    });
  });
}

async function captureAndUpload({ tableType, token }: CaptureAndUploadArgs): Promise<CaptureAndUploadResult> {
  const captureResult = await sendMsg<{ success: boolean; data?: TableData; error?: string }>({
    action: "START_AREA_CAPTURE",
  });

  if (!captureResult.success || !captureResult.data) {
    throw new Error(captureResult.error ?? "Echec de la capture");
  }

  const tableData = captureResult.data;
  const endpoint = tableType === "achat" ? ENDPOINTS.uploads.achatJson : ENDPOINTS.uploads.venteJson;

  const res = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ rows: tableData.rows }),
  });

  if (res.status === 401) throw new Error("SESSION_EXPIRED");

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Erreur serveur");
  }

  const data = await res.json();
  return { inserted: data.inserted, tableType, preview: tableData };
}

export function useCaptureAndUpload() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: captureAndUpload,
    onError: (err) => {
      if ((err as Error).message === "SESSION_EXPIRED") {
        queryClient.setQueryData(QUERY_KEYS.token, null);
      }
    },
  });
}
